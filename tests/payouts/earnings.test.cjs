const test = require('node:test');
const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright-core');

const project = 'https://mqlzsxwntsnhwfxbyyaq.supabase.co';

function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function expectStatus(response, status) {
  if (response.status() !== status) assert.fail('Expected ' + status + ', received ' + response.status() + ' at ' + response.url());
}

test('completed session appears in earnings, clears the hold and is marked processed once', { timeout: 240000 }, async t => {
  const env = loadEnvConfig(process.cwd(), true).combinedEnv;
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin, project);
  const db = createClient(project, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  checked(await db.from('payouts').select('updated_at').limit(0));
  const browser = await chromium.launch({ executablePath: chromium.executablePath() });
  t.after(() => browser.close());
  const page = () => browser.newPage({ baseURL: 'http://localhost:3000' });
  const [host, driver, reviewer] = await Promise.all([page(), page(), page()]);
  const accounts = [];
  const chargerId = randomUUID();
  const bookingId = randomUUID();
  const title = 'QA earnings ' + chargerId.slice(0, 8);
  const upi = 'qa' + chargerId.slice(0, 8) + '@example';
  t.after(async () => {
    if (!accounts.length) return;
    checked(await db.from('audit_log').delete().in('admin_user_id', accounts));
    checked(await db.from('notifications').delete().in('user_id', accounts));
    checked(await db.from('payouts').delete().in('user_id', accounts));
    checked(await db.from('bookings').delete().eq('id', bookingId));
    checked(await db.from('chargers').delete().eq('id', chargerId));
    checked(await db.from('kyc_submissions').delete().in('user_id', accounts));
    for (const id of accounts) checked(await db.auth.admin.deleteUser(id));
    checked(await db.from('users').delete().in('id', accounts));
  });

  async function register(client, role) {
    const username = 'qa_' + randomUUID().replaceAll('-', '').slice(0, 20);
    const pin = String(randomInt(1000, 10000));
    const credentials = { username, pin };
    const response = await client.request.post('/api/auth/pin', { data: {
      ...credentials, action: 'register', phone: '9' + randomInt(100000000, 1000000000),
    } });
    const user = checked(await db.from('users').select('id').eq('username', username).maybeSingle());
    if (user) accounts.push(user.id);
    await expectStatus(response, 200);
    assert.ok(user);
    await expectStatus(await client.request.patch('/api/profile', { data: { name: 'Journey ' + role } }), 200);
    if (role === 'Host') {
      await expectStatus(await client.request.post('/api/profile/enable-hosting'), 200);
    } else if (role === 'Admin') {
      checked(await db.from('users').update({ is_admin: true }).eq('id', user.id));
      checked(await db.auth.admin.updateUserById(user.id, { user_metadata: { is_admin: true } }));
    }
    await expectStatus(await client.request.post('/api/auth/pin', { data: { ...credentials, action: 'login' } }), 200);
    return user.id;
  }

  const hostId = await register(host, 'Host');
  const driverId = await register(driver, 'Driver');
  const adminId = await register(reviewer, 'Admin');
  checked(await db.from('users').update({ kyc_status: 'approved' }).eq('id', hostId));
  const document = 'https://example.invalid/synthetic.png';
  checked(await db.from('kyc_submissions').insert({
    user_id: hostId, status: 'approved', upi_id: upi, aadhaar_photo_url: document,
    pan_photo_url: document, selfie_url: document, pan_number: 'AAAAA0000A', aadhaar_last_4: '0000',
  }));
  checked(await db.from('chargers').insert({
    id: chargerId, lender_id: hostId, title, charger_type: 'AC_7kW', connector_types: ['CCS2'],
    price_per_kwh: 12, address: 'Synthetic fixture in New Delhi', latitude: 28.6, longitude: 77.2, status: 'active',
  }));
  checked(await db.from('availability_slots').insert({
    charger_id: chargerId, day_of_week: [0, 1, 2, 3, 4, 5, 6], start_time: '00:00', end_time: '23:59',
  }));
  const hoursAgo = hours => new Date(Date.now() - hours * 3600000).toISOString();
  const start = hoursAgo(0.5);
  checked(await db.from('bookings').insert({
    id: bookingId, charger_id: chargerId, driver_id: driverId, lender_id: hostId,
    confirmation_code: bookingId.slice(0, 8), scheduled_start: start, scheduled_end: hoursAgo(0),
    started_at: start, actual_start: start, status: 'in_progress',
  }));
  checked(await db.from('payments').insert({
    booking_id: bookingId, gross_amount: 4200, platform_fee: 630, lender_payout: 3570, status: 'paid',
  }));

  const end = '/api/bookings/' + bookingId + '/end';
  const awaiting = await host.request.post(end);
  await expectStatus(awaiting, 200);
  assert.equal((await awaiting.json()).status, 'awaiting_end_confirmation');
  await expectStatus(await driver.request.post(end), 200);
  await expectStatus(await driver.request.post(end), 409);
  const booking = checked(await db.from('bookings').select('status,actual_end').eq('id', bookingId).single());
  assert.equal(booking.status, 'completed');
  assert.ok(booking.actual_end);
  const payout = checked(await db.from('payouts').select('*').eq('user_id', hostId).single());
  assert.equal(payout.status, 'pending');
  assert.deepEqual(payout.booking_ids, [bookingId]);
  assert.equal(payout.bank_or_upi, 'UPI: ' + upi);
  assert.equal(payout.amount_paise, 3570);
  const summary = label => host.getByText(label, { exact: true }).locator('..').locator('p').last();
  await host.goto('/lender/earnings');
  await host.getByText(title, { exact: true }).waitFor();
  assert.equal((await summary('Total earned').innerText()).trim(), '₹35.70');
  assert.equal((await summary('Pending payout').innerText()).trim(), '₹35.70');
  await host.getByText('₹42', { exact: true }).waitFor();
  await host.getByText('−₹6.30', { exact: true }).waitFor();
  const statementUrl = '/api/lender/bookings/' + bookingId + '/statement';
  await expectStatus(await driver.request.get(statementUrl), 404);
  const statement = await host.request.get(statementUrl);
  await expectStatus(statement, 200);
  assert.equal((await statement.body()).subarray(0, 5).toString(), '%PDF-');
  await host.getByRole('link', { name: /View detailed payout history/ }).click();
  await host.getByText(title, { exact: true }).waitFor();

  const mark = '/api/admin/payouts/' + payout.id + '/mark-processed';
  await expectStatus(await host.request.post(mark), 403);
  await reviewer.goto('/admin/payouts');
  const card = reviewer.getByText(payout.bank_or_upi, { exact: true }).locator('../..');
  const button = card.getByRole('button', { name: 'Mark processed' });
  async function markFromQueue() {
    const [response] = await Promise.all([
      reviewer.waitForResponse(r => r.url().endsWith(mark) && r.request().method() === 'POST'),
      button.click(),
    ]);
    return response;
  }
  await card.getByText('₹35.70', { exact: true }).waitFor();
  await expectStatus(await markFromQueue(), 409);
  await reviewer.getByText(/24 hours after session completion/).waitFor();

  // Simulate elapsed time only on this booking, preserving its original duration.
  const earlier = hoursAgo(25.5);
  const later = hoursAgo(25);
  checked(await db.from('bookings').update({
    actual_start: earlier, started_at: earlier, scheduled_start: earlier,
    actual_end: later, ended_at: later, end_initiated_at: later, scheduled_end: later,
  }).eq('id', bookingId));
  checked(await db.from('payouts').update({ amount_paise: 3571 }).eq('id', payout.id));
  const mismatch = await reviewer.request.post(mark);
  await expectStatus(mismatch, 409);
  assert.match((await mismatch.json()).error, /payout amount/i);
  const paymentRow = async () => checked(await db.from('payments').select('*').eq('booking_id', bookingId).single());
  assert.equal((await paymentRow()).payout_released_at, null);
  checked(await db.from('payouts').update({ amount_paise: 3570 }).eq('id', payout.id));

  await expectStatus(await markFromQueue(), 200);
  await button.waitFor({ state: 'detached' });
  await expectStatus(await reviewer.request.post(mark), 409);
  const processed = checked(await db.from('payouts').select('*').eq('id', payout.id).single());
  const released = await paymentRow();
  assert.equal(processed.status, 'completed');
  assert.ok(processed.processed_at);
  assert.equal(released.payout_released_at, processed.processed_at);
  assert.equal(released.status, 'transferred');
  assert.equal(released.razorpay_transfer_id, null);
  assert.equal(processed.razorpay_payout_id, null);
  const audit = checked(await db.from('audit_log').select('metadata').eq('admin_user_id', adminId)
    .eq('target_user_id', hostId).eq('action_type', 'payout_processed').single());
  assert.deepEqual(audit.metadata, { payout_id: payout.id, amount_paise: 3570 });
  const notice = checked(await db.from('notifications').select('data').eq('user_id', hostId).eq('type', 'payout_processed').single());
  assert.deepEqual(notice.data, { ...audit.metadata, booking_count: 1 });

  await host.reload();
  await host.getByText('No pending payouts.').waitFor();
  await host.getByRole('button', { name: 'Processed', exact: true }).click();
  await host.getByText(payout.bank_or_upi, { exact: true }).waitFor();
  await host.getByText('₹35.70', { exact: true }).waitFor();
  await host.goto('/lender/earnings');
  await host.getByText('Payout marked processed', { exact: true }).waitFor();
  assert.equal((await summary('Total earned').innerText()).trim(), '₹35.70');
  assert.equal((await summary('Pending payout').innerText()).trim(), '₹0');
  const finalStatement = await host.request.get(statementUrl);
  await expectStatus(finalStatement, 200);
  assert.equal((await finalStatement.body()).subarray(0, 5).toString(), '%PDF-');
});
