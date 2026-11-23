const test = require('node:test');
const assert = require('node:assert/strict');
const { NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');

function queue(isAdmin, submissions = []) {
  const { GET } = loadHandler('src/app/api/admin/kyc/route.ts', {
    'next/server': { NextResponse },
    '@/lib/admin': { getAdminUser: async () => isAdmin ? { id: 'reviewer' } : null },
    '@/lib/supabase/server': { createAdminClient() {
      assert.ok(isAdmin);
      return { from(table) {
        const rows = { kyc_submissions: submissions, users: [{ id: 'host', name: 'Host' }],
          chargers: [{ lender_id: 'host', status: 'draft', deleted_at: null }] };
        let filtered = rows[table];
        const query = {
          select() { return query; }, order() { return query; },
          eq(key, value) { filtered = filtered.filter(row => row[key] === value); return query; },
          is(key, value) { return query.eq(key, value); },
          in(key, values) { filtered = filtered.filter(row => values.includes(row[key])); return query; },
          then(resolve) { resolve({ data: filtered }); },
        };
        return query;
      } };
    } },
  });
  return params => GET(new Request('http://localhost/api/admin/kyc' + params));
}

test('KYC queue shows pending submissions by default and explicitly supports all statuses', async () => {
  const read = queue(true, [{ id: 'a', user_id: 'host', status: 'pending' }, { id: 'b', user_id: 'host', status: 'approved' }]);
  const pending = await (await read('')).json();
  assert.deepEqual(pending.data.map(s => [s.id, s.users.name, s.draft_count]), [['a', 'Host', 1]]);
  assert.deepEqual((await (await read('?status=all')).json()).data.map(s => s.id), ['a', 'b']);
  assert.deepEqual((await (await read('?status=rejected')).json()).data, []);
});

test('KYC queue rejects an invalid filter and requires an admin for reads', async () => {
  assert.equal((await queue(true)('?status=typo')).status, 400);
  assert.equal((await queue(false)('?status=all')).status, 403);
});
