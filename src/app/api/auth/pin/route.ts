import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readKillSwitch } from '@/lib/app-settings';
import {
  normalizeUsername, usernameEmail, validatePin, validateUsername,
} from '@/lib/auth/pin';
import type { PinField, PinSession } from '@/lib/auth/pin';
import { AUTH_MESSAGES, validateMobile } from '@/lib/auth/validation';
import { isEmergencyLockdown } from '@/lib/edge-config';
import { createAdminClient, createClient } from '@/lib/supabase/server';

function failure(error: string, status: number, field?: PinField) {
  return NextResponse.json({ error, ...(field && { field }) }, { status });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return failure(AUTH_MESSAGES.invalidRequest, 400);
  }

  const { action, username: rawUsername, pin: rawPin, phone: rawPhone } = body as Record<string, unknown>;
  if (action !== 'register' && action !== 'login') return failure(AUTH_MESSAGES.invalidRequest, 400);

  const username = typeof rawUsername === 'string' ? normalizeUsername(rawUsername) : '';
  const usernameError = validateUsername(username);
  if (usernameError) return failure(usernameError, 400, 'username');
  const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
  if (action === 'register') {
    const phoneError = validateMobile(phone);
    if (phoneError) return failure(phoneError, 400, 'phone');
  }

  const pin = typeof rawPin === 'string' ? rawPin : '';
  const pinError = validatePin(pin);
  if (pinError) return failure(pinError, 400, 'pin');
  const secret = process.env.SUPABASE_PHONE_PASSWORD_SECRET;
  if (!secret) {
    console.error('[username auth] Missing secret for PIN authentication');
    return failure(action === 'register' ? AUTH_MESSAGES.register : AUTH_MESSAGES.signIn, 503);
  }
  // Supabase receives an account-specific credential derived on the server.
  const password = 'Kirin!1-' + createHmac('sha256', secret)
    .update(`kirin:username-pin:v1:${username}:${pin}`).digest('hex');

  const admin = createAdminClient();
  if (action === 'login') {
    const { data: allowed, error } = await admin.rpc('reserve_pin_sign_in_attempt', { p_username: username });
    if (error) {
      console.error('[username auth] Could not reserve PIN attempt:', error.code);
      return failure(AUTH_MESSAGES.signIn, 503);
    }
    if (!allowed) return failure(AUTH_MESSAGES.rateLimit, 429);
  }
  const email = usernameEmail(username);
  if (action === 'register') {
    const [locked, registrationsEnabled] = await Promise.all([
      isEmergencyLockdown(), readKillSwitch('allow_registrations'),
    ]);
    if (locked || !registrationsEnabled) return failure('New registrations are temporarily unavailable.', 503);

    const fullPhone = `91${phone}`;
    const findDuplicates = () => Promise.all([
      admin.from('users').select('id').eq('username', username).maybeSingle(),
      admin.from('users').select('id').in('phone', [fullPhone, `+${fullPhone}`]).limit(1).maybeSingle(),
    ]);
    const unavailable = 'That username or phone number is already in use.';
    const before = await findDuplicates();
    if (before.some(result => result.error)) return failure('Could not check account availability. Please try again.', 503);
    if (before.some(result => result.data)) return failure(unavailable, 409);

    // A new PIN account must be able to return through the rate-limited login.
    const { error: guardError } = await admin.rpc('reserve_pin_sign_in_attempt', { p_username: username });
    if (guardError) {
      console.error('[username auth] PIN attempt guard unavailable:', guardError.code);
      return failure(AUTH_MESSAGES.register, 503);
    }

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'driver', onboarded: false },
      app_metadata: { kirin_username: username, kirin_contact_phone: fullPhone },
    });
    if (error) {
      // The database constraints settle concurrent attempts after the precheck.
      const after = await findDuplicates();
      if (after.some(result => result.data) || error.code === 'email_exists' || error.code === 'user_already_exists') {
        return failure(unavailable, 409);
      }
      if (error.status === 429) return failure(AUTH_MESSAGES.rateLimit, 429);
      return failure(AUTH_MESSAGES.register, 503);
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.status === 429) return failure(AUTH_MESSAGES.rateLimit, 429);
  if (error || !data.session || !data.user) {
    if (action === 'register') return failure('Account created. Sign in with your username and PIN to continue.', 503);
    if (error && (!error.status || error.status >= 500)) return failure(AUTH_MESSAGES.signIn, 503);
    return failure('Incorrect username or PIN.', 401);
  }

  if (action === 'login') {
    const { error: resetError } = await admin.from('pin_sign_in_attempts').delete().eq('username', username);
    if (resetError) console.warn('[username auth] Could not reset PIN attempts:', resetError.code);
  }

  const metadata = data.user.user_metadata;
  return NextResponse.json({
    data: {
      onboarded: metadata.onboarded === true || (metadata.onboarded == null && Boolean(metadata.name)),
      isAdmin: metadata.is_admin === true,
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    } satisfies PinSession,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
