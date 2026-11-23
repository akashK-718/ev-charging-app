const assert = require('node:assert/strict');
const test = require('node:test');
const { NextResponse } = require('next/server');
const { loadHandler } = require('./support/load-handler.cjs');

const passwordRules = loadHandler('src/lib/auth/password.ts');
const profile = { id: 'driver-id', username: 'new_driver', role: 'driver', is_admin: false, name: null };
const password = 'test-only, space at end ';
const session = { access_token: 'test-access', refresh_token: 'test-refresh' };

function post(POST, body) {
  return POST(new Request('http://localhost/api/auth', { method: 'POST', body: JSON.stringify(body) }));
}

function passwordHandler({ locked = false, duplicates = [], createError, signInError, onboarded = false } = {}) {
  const calls = [];
  let lookup = 0;
  const { POST } = loadHandler('src/app/api/auth/password/route.ts', {
    'next/server': { NextResponse },
    '@/lib/auth/password': passwordRules,
    '@/lib/app-settings': { readKillSwitch: async () => true },
    '@/lib/edge-config': { isEmergencyLockdown: async () => locked },
    '@/lib/supabase/server': {
      createAdminClient: () => ({
        from(table) {
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

const signup = { action: 'register', username: '  New_Driver  ', phone: '9000000000', password };

test('password registration provisions a driver with a canonical contact number and returns an onboarding session', async () => {
  const { POST, calls } = passwordHandler();
  const response = await post(POST, signup);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { onboarded: false, isAdmin: false, session } });
  assert.deepEqual(calls, [
    ['username', 'username', 'new_driver'],
    ['phone', 'phone', ['919000000000', '+919000000000']],
    ['register', {
      email: 'new_driver@username.auth.local', password, email_confirm: true,
      user_metadata: { role: 'driver', onboarded: false },
      app_metadata: { kirin_username: 'new_driver', kirin_contact_phone: '919000000000' },
    }],
    ['login', { email: 'new_driver@username.auth.local', password }],
  ]);
});

test('case-insensitive password login needs neither a phone number nor a registration lookup', async () => {
  const { POST, calls } = passwordHandler({ locked: true, onboarded: true });
  const response = await post(POST, { action: 'login', username: 'NEW_Driver', password });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.onboarded, true);
  assert.deepEqual(calls, [['login', { email: 'new_driver@username.auth.local', password }]]);
});

test('registration rejects an existing phone and handles a duplicate that wins during provisioning', async () => {
  const duplicatePhone = passwordHandler({ duplicates: [null, profile] });
  assert.equal((await post(duplicatePhone.POST, signup)).status, 409);
  assert.equal(duplicatePhone.calls.length, 2);

  const race = passwordHandler({ duplicates: [null, null, profile], createError: { code: 'unexpected_failure' } });
  assert.equal((await post(race.POST, signup)).status, 409);
  assert.equal(race.calls.filter(([kind]) => kind === 'register').length, 1);
  assert.ok(!race.calls.some(([kind]) => kind === 'login'));
});

test('registration checks the phone and password length before creating an account', async () => {
  const { POST, calls } = passwordHandler();
  assert.equal((await post(POST, { ...signup, phone: '' })).status, 400);
  assert.equal((await post(POST, { ...signup, password: '🔒'.repeat(19) })).status, 400);
  assert.deepEqual(calls, []);
});

test('login masks invalid credentials and preserves provider rate limiting', async () => {
  const login = { ...signup, action: 'login' };
  const invalid = await post(passwordHandler({ signInError: { status: 400 } }).POST, login);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Incorrect username or password.' });
  assert.equal((await post(passwordHandler({ signInError: { status: 429 } }).POST, login)).status, 429);
});

test('OTP verification directs password accounts to password sign-in before any credential writes', async () => {
  const { POST } = loadHandler('src/app/api/auth/verify-otp/route.ts', {
    'next/server': { NextResponse },
    '@/lib/msg91': { verifyOtp: async () => ({ verified: true }) },
    '@/lib/app-settings': { readKillSwitch: async () => true },
    '@/lib/edge-config': { isEmergencyLockdown: async () => false },
    '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
    }) }) },
  });
  const response = await post(POST, { phone: '9000000000', otp: '000000' });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PASSWORD_ACCOUNT');
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
