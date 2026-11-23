const assert = require('node:assert/strict');
const test = require('node:test');
const { NextResponse } = require('next/server');
const { createHmac } = require('node:crypto');
const { loadHandler } = require('./support/load-handler.cjs');

const validation = loadHandler('src/lib/auth/validation.ts');
const pinRules = loadHandler('src/lib/auth/pin.ts', { './validation': validation });
const profile = { id: 'driver-id', username: 'new_driver', role: 'driver', is_admin: false, name: null };
const testSecret = 'isolated-username-pin-test-secret';
const pin = '0735';
const pinPassword = 'Kirin!1-' + createHmac('sha256', testSecret)
  .update(`kirin:username-pin:v1:new_driver:${pin}`).digest('hex');
const session = { access_token: 'test-access', refresh_token: 'test-refresh' };

test.before(() => { process.env.SUPABASE_PHONE_PASSWORD_SECRET = testSecret; });

function post(POST, body) {
  return POST(new Request('http://localhost/api/auth', { method: 'POST', body: JSON.stringify(body) }));
}

function pinHandler({
  locked = false, duplicates = [], createError, signInError, onboarded = false,
  allowed = true, guardError,
} = {}) {
  const calls = [];
  let lookup = 0;
  const { POST } = loadHandler('src/app/api/auth/pin/route.ts', {
    'next/server': { NextResponse },
    'node:crypto': { createHmac },
    '@/lib/auth/pin': pinRules,
    '@/lib/auth/validation': validation,
    '@/lib/app-settings': { readKillSwitch: async () => true },
    '@/lib/edge-config': { isEmergencyLockdown: async () => locked },
    '@/lib/supabase/server': {
      createAdminClient: () => ({
        async rpc(name, args) {
          assert.equal(name, 'reserve_pin_sign_in_attempt');
          calls.push(['reserve', args.p_username]);
          return { data: allowed, error: guardError };
        },
        from(table) {
          if (table === 'pin_sign_in_attempts') return { delete: () => ({
            async eq(field, value) {
              calls.push(['reset', field, value]);
              return { error: null };
            },
          }) };
          assert.equal(table, 'users');
          const query = {
            select: () => query,
            eq(field, value) { calls.push(['username', field, value]); return query; },
            in(field, value) { calls.push(['phone', field, value]); return query; },
            limit: () => query,
            async maybeSingle() { return { data: duplicates[lookup++] ?? null, error: null }; },
          };
          return query;
        },
        auth: { admin: { async createUser(attributes) {
          calls.push(['register', attributes]);
          return { error: createError };
        } } },
      }),
      createClient: () => ({ auth: { async signInWithPassword(credentials) {
        calls.push(['login', credentials]);
        return {
          data: signInError ? { session: null, user: null } : { session, user: { user_metadata: { onboarded } } },
          error: signInError,
        };
      } } }),
    },
  });
  return { POST, calls };
}

const signup = { action: 'register', username: '  New_Driver  ', phone: '9000000000', pin };

test('PIN registration provisions a driver with a canonical phone and a derived credential', async () => {
  const { POST, calls } = pinHandler();
  const response = await post(POST, signup);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { onboarded: false, isAdmin: false, session } });
  assert.deepEqual(calls, [
    ['username', 'username', 'new_driver'],
    ['phone', 'phone', ['919000000000', '+919000000000']],
    ['reserve', 'new_driver'],
    ['register', {
      email: 'new_driver@username.auth.local', password: pinPassword, email_confirm: true,
      user_metadata: { role: 'driver', onboarded: false },
      app_metadata: { kirin_username: 'new_driver', kirin_contact_phone: '919000000000' },
    }],
    ['login', { email: 'new_driver@username.auth.local', password: pinPassword }],
  ]);
});

test('a password submission cannot register or sign in', async () => {
  const { POST, calls } = pinHandler();
  for (const action of ['register', 'login']) {
    const response = await post(POST, {
      action, username: signup.username, phone: signup.phone, password: 'old-test-password',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Enter your PIN.', field: 'pin' });
  }
  assert.deepEqual(calls, []);
});

test('registration rejects an existing phone and handles a duplicate that wins during provisioning', async () => {
  const duplicatePhone = pinHandler({ duplicates: [null, profile] });
  assert.equal((await post(duplicatePhone.POST, signup)).status, 409);
  assert.equal(duplicatePhone.calls.length, 2);

  const race = pinHandler({ duplicates: [null, null, profile], createError: { code: 'unexpected_failure' } });
  assert.equal((await post(race.POST, signup)).status, 409);
  assert.equal(race.calls.filter(([kind]) => kind === 'register').length, 1);
  assert.ok(!race.calls.some(([kind]) => kind === 'login'));
});

test('registration reports the missing phone or invalid PIN before creating an account', async () => {
  const { POST, calls } = pinHandler();
  const missingPhone = await post(POST, { ...signup, phone: '' });
  assert.equal(missingPhone.status, 400);
  assert.deepEqual(await missingPhone.json(), { error: 'Enter your phone number.', field: 'phone' });
  const invalidPin = await post(POST, { ...signup, pin: '12345' });
  assert.equal(invalidPin.status, 400);
  assert.deepEqual(await invalidPin.json(), { error: 'Enter a 4-digit PIN.', field: 'pin' });
  assert.deepEqual(calls, []);
});

test('PIN sign-in preserves leading zeros and resets the limit only after successful authentication', async () => {
  const login = { action: 'login', username: 'NEW_Driver', pin };
  const allowed = pinHandler({ onboarded: true });
  assert.equal((await post(allowed.POST, login)).status, 200);
  assert.deepEqual(allowed.calls, [
    ['reserve', 'new_driver'],
    ['login', { email: 'new_driver@username.auth.local', password: pinPassword }],
    ['reset', 'username', 'new_driver'],
  ]);
  const denied = pinHandler({ allowed: false });
  assert.equal((await post(denied.POST, login)).status, 429);
  assert.deepEqual(denied.calls, [['reserve', 'new_driver']]);
  const wrongPin = pinHandler({ signInError: { status: 400 } });
  assert.deepEqual(await (await post(wrongPin.POST, login)).json(), { error: 'Incorrect username or PIN.' });
  assert.ok(!wrongPin.calls.some(([action]) => action === 'reset'));
});

test('PIN signup and login return a safe error when the attempt guard is unavailable', async () => {
  for (const body of [signup, { ...signup, action: 'login' }]) {
    const fixture = pinHandler({ guardError: { code: 'PGRST202' } });
    assert.equal((await post(fixture.POST, body)).status, 503);
    assert.ok(!fixture.calls.some(([action]) => action === 'register' || action === 'login'));
  }
});

test('login masks invalid credentials and preserves provider rate limiting', async () => {
  const login = { username: signup.username, action: 'login', pin };
  const invalid = await post(pinHandler({ signInError: { status: 400 } }).POST, login);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Incorrect username or PIN.' });
  assert.equal((await post(pinHandler({ signInError: { status: 429 } }).POST, login)).status, 429);
});

test('OTP verification rejects username accounts before any credential writes', async () => {
  const { POST } = loadHandler('src/app/api/auth/verify-otp/route.ts', {
    'next/server': { NextResponse },
    '@/lib/msg91': { verifyOtp: async () => ({ verified: true }) },
    '@/lib/auth/validation': validation,
    '@/lib/app-settings': { readKillSwitch: async () => true },
    '@/lib/edge-config': { isEmergencyLockdown: async () => false },
    '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }) }) },
  });
  const response = await post(POST, { phone: '9000000000', otp: '000000' });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'USERNAME_ACCOUNT');
});

test('an existing OTP account still signs in with its original Supabase identity', async t => {
  const previous = process.env.SUPABASE_PHONE_PASSWORD_SECRET;
  process.env.SUPABASE_PHONE_PASSWORD_SECRET = 'isolated-otp-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.SUPABASE_PHONE_PASSWORD_SECRET;
    else process.env.SUPABASE_PHONE_PASSWORD_SECRET = previous;
  });
  const { POST } = loadHandler('src/app/api/auth/verify-otp/route.ts', {
    'next/server': { NextResponse },
    '@/lib/msg91': { verifyOtp: async () => ({ verified: true }) },
    '@/lib/auth/validation': validation,
    '@/lib/app-settings': { readKillSwitch: async () => { throw new Error('Returning user checked signup gate'); } },
    '@/lib/edge-config': { isEmergencyLockdown: async () => false },
    '@/lib/supabase/server': {
      createAdminClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: { ...profile, username: null, name: 'Test Driver' } }),
        }) }) }),
        auth: { admin: {
          createUser: async input => assert.equal(input.id, profile.id),
          updateUserById: async id => assert.equal(id, profile.id),
        } },
      }),
      createClient: () => ({ auth: { async signInWithPassword({ email }) {
        assert.equal(email, '919000000000@auth.local');
        return { data: { session }, error: null };
      } } }),
    },
  });
  const response = await post(POST, { phone: '9000000000', otp: '000000' });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    userId: profile.id, role: 'driver', isNewUser: false, isAdmin: false, name: 'Test Driver', session,
  });
});
