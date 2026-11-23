const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');
const constants = loadHandler('src/lib/constants.ts');
const start = new Date('2026-11-24T00:00:00Z');
const at = minutes => new Date(+start + minutes * 60000).toISOString();

function availability(rows, error = null) {
  const db = { from(table) {
    assert.equal(table, 'bookings');
    let found = rows.map(([begin, end, status = 'confirmed', charger = 'local']) => ({
      scheduled_start: at(begin), scheduled_end: at(end), status, charger_id: charger,
    }));
    const query = {
      select() { return query; },
      eq(key, value) { found = found.filter(row => row[key] === value); return query; },
      in(key, values) { found = found.filter(row => values.includes(row[key])); return query; },
      gt(key, value) { found = found.filter(row => row[key] > value); return query; },
      order(key, options) {
        assert.ok(options.ascending);
        found.sort((a, b) => a[key].localeCompare(b[key]));
        return query;
      },
      limit(n) { found = found.slice(0, n); return query; },
      async maybeSingle() { return { data: found[0] ?? null, error }; },
    };
    return query;
  } };
  return loadHandler('src/lib/bookings/availability.ts', {
    '@/lib/constants': constants, '@/lib/supabase/server': { createAdminClient: () => db },
  });
}

for (const [name, rows, minutes] of [
  ['empty schedule', [], 720],
  ['active session at the requested start', [[0, 60, 'in_progress']], 0],
  ['overlapping reservation', [[-45, 5]], 0],
  ['still in the turnaround buffer', [[-60, -14]], 0],
  ['exact end of the turnaround buffer', [[-60, -15]], 720],
  ['next reservation leaves exactly 30 minutes', [[45, 90, 'pending']], 30],
  ['later bookings cannot hide an earlier conflict', [[180, 250], [45, 90], [-1, 59]], 0],
  ['ignore other chargers and cancelled bookings', [[0, 60, 'confirmed', 'other'], [0, 60, 'cancelled']], 720],
]) {
  test(`availability: ${name}`, async () => {
    const { maxEnd } = await availability(rows).computeMaxEndTime('local', start);
    assert.equal(maxEnd.toISOString(), at(minutes));
  });
}

test('a failed availability read returns a retryable API response', async () => {
  const { GET } = loadHandler('src/app/api/chargers/[id]/availability-window/route.ts', {
    'next/server': { NextResponse }, '@/lib/bookings/availability': availability([], { message: 'offline' }),
    '@/lib/supabase/server': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'driver' } } }) } }) },
  });
  const result = await GET(new NextRequest('http://localhost/?start=' + start.toISOString()), { params: { id: 'local' } });
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /try again/i);
});
