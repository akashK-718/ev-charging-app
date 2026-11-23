const test = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');
const constants = loadHandler('src/lib/constants.ts');
const { computeSessionEstimate } = loadHandler('src/lib/bookings/session-estimate.ts');
const { formatINR } = loadHandler('src/lib/currency.ts');
const bookingPrice = loadHandler('src/lib/bookings/price.ts');

function fixture(chargerType, price) {
  const orders = [];
  const tables = [];
  const charger = { id: 'charger-test', lender_id: 'host-test', status: 'active',
    price_per_kwh: price, charger_type: chargerType, deleted_at: null };
  const admin = { from(table) {
    tables.push(table);
    assert.ok(['vehicles', 'chargers', 'bookings'].includes(table));
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; },
      lt() { return query; }, gt() { return Promise.resolve({ count: 0 }); },
      single() { return Promise.resolve({ data: charger }); },
      maybeSingle() { return Promise.resolve({ data: { id: 'vehicle-test' } }); },
    };
    return query;
  } };
  const { POST } = loadHandler('src/app/api/payments/create-order/route.ts', {
    'next/server': { NextResponse },
    'node:crypto': require('node:crypto'),
    '@/lib/constants': constants,
    '@/lib/bookings/price': bookingPrice,
    '@/lib/supabase/server': {
      createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'driver-test' } } }) } }),
      createAdminClient: () => admin,
    },
    '@/lib/razorpay': {
      getRazorpayKeyId: () => 'rzp_test_key',
      getRazorpay: () => ({ orders: { create: async input => {
        orders.push(input); return { id: 'order_test' };
      } } }),
    },
    '@/lib/bookings/availability': {
      getPlatformMaxBookingDurationHours: () => 12,
      getBookingBufferMinutes: () => 15,
    },
    '@/lib/edge-config': { isEmergencyLockdown: async () => false },
    '@/lib/app-settings': { readKillSwitch: async () => true },
  });
  return { POST, orders, tables };
}

const cases = [
  ['AC_3.3kW', 15, 60, 3.3, 4950, 743, 4207],
  ['AC_7kW', 15, 60, 7, 10500, 1575, 8925],
  ['AC_22kW', 15, 60, 22, 33000, 4950, 28050],
  ['DC_fast', 15, 60, 50, 75000, 11250, 63750],
  ['AC_7kW', 15, 15, 1.75, 2625, 394, 2231],
  ['AC_7kW', 15, 720, 84, 126000, 18900, 107100],
  ['AC_3.3kW', 9.99, 30, 1.65, 1648, 247, 1401],
];
for (const [power, price, minutes, kwh, gross, fee, payout] of cases) {
  test(`BOOK-01: ${power}, ${minutes} minutes at ₹${price} creates the expected order`, async () => {
    const { POST, orders, tables } = fixture(power, price);
    const start = new Date(Date.now() + 86400000);
    const end = new Date(start.getTime() + minutes * 60000);
    const payload = { charger_id: 'charger-test', scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(), vehicle_id: 'vehicle-test', constraint_type: 'duration', constraint_value: minutes };
    const response = await POST(new Request('http://localhost/api/payments/create-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.estimated_kwh, kwh);
    assert.equal(data.gross_amount, gross);
    assert.equal(data.platform_fee, fee);
    assert.equal(data.lender_payout, payout);
    assert.equal(data.gross_amount, data.platform_fee + data.lender_payout);
    assert.equal(data.razorpay_order_id, 'order_test');
    assert.equal(data.currency, 'INR');
    for (const key of Object.keys(payload)) assert.equal(data[key], payload[key]);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].amount, gross);
    assert.equal(orders[0].currency, 'INR');
    assert.deepEqual(orders[0].notes, {
      ...payload,
      constraint_value: String(minutes),
      kirin_booking: '1',
      driver_id: 'driver-test',
      lender_id: 'host-test',
      platform_fee: String(fee),
    });
    assert.equal(orders[0].partial_payment, false);
    assert.deepEqual(tables, ['vehicles', 'chargers', 'bookings']);
    // The adapters expose no insert/update method: order creation must not create a booking.
  });
}

test('SESSION-01: a 7 kW session at ₹15 progresses from zero to one hour', () => {
  assert.deepEqual(computeSessionEstimate('AC_7kW', 15, 0), { estimatedKwh: 0, estimatedCostRupees: 0 });
  assert.deepEqual(computeSessionEstimate('AC_7kW', 15, 1800000), { estimatedKwh: 3.5, estimatedCostRupees: 53 });
  assert.deepEqual(computeSessionEstimate('AC_7kW', 15, 3600000), { estimatedKwh: 7, estimatedCostRupees: 105 });
});
test('MONEY-01: checkout, commission and payout retain paise at display', () => {
  assert.equal(formatINR(10500), '₹105');
  assert.equal(formatINR(1575), '₹15.75');
  assert.equal(formatINR(8925), '₹89.25');
});

test('a budget quote stays within the selected amount after energy rounding', () => {
  const minutes = bookingPrice.getBudgetDuration('AC_7kW', 12, 200);
  const { amount } = bookingPrice.getBookingPrice('AC_7kW', 12, minutes);
  assert.equal(amount, 19992);
  assert.equal(formatINR(amount), '₹199.92');
});
