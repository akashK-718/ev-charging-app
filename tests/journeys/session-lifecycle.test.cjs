const test = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');

function fixture() {
  const now = Date.now();
  const booking = { id: 'booking', charger_id: 'charger', driver_id: 'driver', lender_id: 'host',
    created_at: new Date(now).toISOString(), scheduled_start: new Date(now).toISOString(),
    scheduled_end: new Date(now + 3600000).toISOString(), status: 'pending' };
  const notifications = [];
  const payouts = [];
  let actor;
  let competingStatus;
  const db = { from(table) {
    const filters = [];
    let patch;
    const query = {
      select: () => query,
      eq(key, value) { filters.push([key, value]); return query; },
      in() { assert.equal(table, 'app_settings'); return Promise.resolve({ data: [] }); },
      update(values) { patch = values; return query; },
      async single() {
        if (table === 'chargers') return { data: { title: 'Test charger', charger_type: 'AC_7kW', latitude: 19, longitude: 73 } };
        assert.equal(table, 'bookings');
        return { data: filters.every(([key, value]) => booking[key] === value) ? { ...booking } : null };
      },
      async maybeSingle() {
        assert.equal(table, 'bookings');
        assert.ok(patch);
        if (competingStatus) { booking.status = competingStatus; competingStatus = undefined; }
        if (!filters.every(([key, value]) => booking[key] === value)) return { data: null };
        Object.assign(booking, patch);
        return { data: { id: booking.id } };
      },
    };
    return query;
  } };
  const adapters = {
    'next/server': { NextResponse },
    '@/lib/supabase/server': { createAdminClient: () => db, createClient: () => ({
      auth: { getUser: async () => ({ data: { user: actor ? { id: actor } : null } }) },
    }) },
    '@/lib/constants': loadHandler('src/lib/constants.ts'),
    '@/lib/haversine': loadHandler('src/lib/haversine.ts'),
    '@/lib/bookings/auto-reject': { runAutoRejectSweep: async () => {} },
    '@/lib/bookings/auto-no-show': { runAutoNoShowSweep: async () => {} },
    '@/lib/bookings/flag-for-review': { runFlagForReviewSweep: async () => {} },
    '@/lib/bookings/queue-payout': { queuePayoutForBooking: async (_db, id) => payouts.push(id) },
    '@/lib/notifications/push': { sendPushNotification: async value => notifications.push(value) },
    '@/lib/razorpay': { refundPayment: assert.fail },
  };
  const routes = {};
  for (const action of ['accept', 'reject', 'start', 'end']) {
    const base = ['accept', 'reject'].includes(action) ? 'lender/bookings' : 'bookings';
    routes[action] = loadHandler(`src/app/api/${base}/[id]/${action}/route.ts`, adapters).POST;
  }
  return { booking, notifications, payouts, race(nextStatus) { competingStatus = nextStatus; },
    async act(user, action, body = { latitude: 19, longitude: 73, reason: 'Unavailable' }) {
      actor = user;
      const res = await routes[action](new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), { params: { id: booking.id } });
      return res.status;
    } };
}

test('host accepts and initiates, driver confirms start and end, payout is queued once', async () => {
  const { act, booking, payouts } = fixture();
  for (const [user, action, next] of [
    ['host', 'accept', 'confirmed'], ['host', 'start', 'awaiting_driver_confirmation'],
    ['driver', 'start', 'in_progress'], ['host', 'end', 'awaiting_end_confirmation'], ['driver', 'end', 'completed'],
  ]) {
    assert.equal(await act(user, action), 200);
    assert.equal(booking.status, next);
  }
  assert.ok(booking.started_at && booking.ended_at && booking.confirmed_at);
  assert.equal(await act('driver', 'end'), 409);
  assert.deepEqual(payouts, ['booking']);
});

test('driver can stop directly during charging', async () => {
  const { act, booking, payouts } = fixture();
  booking.status = 'in_progress';
  assert.equal(await act('driver', 'end'), 200);
  assert.equal(booking.status, 'completed');
  assert.deepEqual(payouts, ['booking']);
});

for (const [status, user, action, expected] of [
  ['pending', null, 'accept', 401], ['pending', 'driver', 'accept', 404],
  ['confirmed', 'driver', 'start', 403], ['confirmed', 'unrelated', 'start', 403],
  ['awaiting_end_confirmation', 'host', 'end', 403], ['cancelled', 'host', 'start', 409],
  ['confirmed', 'host', 'accept', 409], ['pending', 'driver', 'end', 409],
]) {
  test(`${user} cannot ${action} a ${status} booking`, async () => {
    const f = fixture();
    f.booking.status = status;
    assert.equal(await f.act(user, action), expected);
    assert.equal(f.booking.status, status);
    assert.equal(f.notifications.length + f.payouts.length, 0);
  });
}

for (const [status, user, action, winner] of [
  ['pending', 'host', 'accept', 'cancelled'], ['pending', 'host', 'reject', 'confirmed'],
  ['confirmed', 'host', 'start', 'cancelled'], ['awaiting_driver_confirmation', 'driver', 'start', 'no_show'],
  ['in_progress', 'host', 'end', 'completed'],
]) {
  test(`a concurrent transition to ${winner} wins over a stale ${action} request from ${status}`, async () => {
    const f = fixture();
    f.booking.status = status;
    f.race(winner);
    assert.equal(await f.act(user, action), 409);
    assert.equal(f.booking.status, winner);
    assert.equal(f.notifications.length + f.payouts.length, 0);
  });
}

test('start grace period and driver proximity checks leave the booking available for retry', async () => {
  const f = fixture();
  f.booking.status = 'confirmed';
  f.booking.scheduled_start = new Date(Date.now() + 7200000).toISOString();
  assert.equal(await f.act('host', 'start'), 409);
  f.booking.scheduled_start = new Date().toISOString();
  assert.equal(await f.act('host', 'start'), 200);
  assert.equal(await f.act('driver', 'start', { latitude: 16, longitude: 71 }), 409);
  assert.equal(f.booking.status, 'awaiting_driver_confirmation');
  assert.equal(await f.act('driver', 'start'), 200);
});

test('missing or short rejection reasons keep the request pending', async () => {
  const f = fixture();
  for (const reason of [null, {}, { reason: 'short' }]) {
    assert.equal(await f.act('host', 'reject', reason), 400);
    assert.equal(f.booking.status, 'pending');
  }
});
