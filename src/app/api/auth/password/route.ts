import { NextResponse } from 'next/server';
import { readKillSwitch } from '@/lib/app-settings';
import {
  MOBILE_PATTERN, normalizeUsername, passwordByteLength, PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH, USERNAME_PATTERN, usernameEmail,
} from '@/lib/auth/password';
import type { PasswordSession } from '@/lib/auth/password';
import { isEmergencyLockdown } from '@/lib/edge-config';
import { createAdminClient, createClient } from '@/lib/supabase/server';

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return failure('Invalid request body.', 400);
  }

  const { action, username: rawUsername, password, phone: rawPhone } = body as Record<string, unknown>;
  if (action !== 'register' && action !== 'login') return failure('Invalid request.', 400);

  const username = typeof rawUsername === 'string' ? normalizeUsername(rawUsername) : '';
  const validCredentials = USERNAME_PATTERN.test(username) && typeof password === 'string' &&
    password.length > 0 && passwordByteLength(password) <= PASSWORD_MAX_BYTES;
  const invalidLogin = 'Incorrect username or password.';
  if (action === 'login' && !validCredentials) return failure(invalidLogin, 401);
  if (typeof password !== 'string') return failure('Enter a password.', 400);

  const email = usernameEmail(username);
  if (action === 'register') {
    if (!USERNAME_PATTERN.test(username)) {
      return failure('Use 3–30 letters, numbers, or underscores, starting with a letter.', 400);
    }
    if (!validCredentials || Array.from(password).length < PASSWORD_MIN_LENGTH) {
      return failure('Use at least 12 characters and at most 72 bytes for your password.', 400);
    }
    const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
    if (!MOBILE_PATTERN.test(phone)) return failure('Enter a valid 10-digit Indian mobile number.', 400);

    const [locked, registrationsEnabled] = await Promise.all([
      isEmergencyLockdown(), readKillSwitch('allow_registrations'),
    ]);
    if (locked || !registrationsEnabled) return failure('New registrations are temporarily unavailable.', 503);

    const fullPhone = `91${phone}`;
    const admin = createAdminClient();
    const findDuplicates = () => Promise.all([
      admin.from('users').select('id').eq('username', username).maybeSingle(),
      admin.from('users').select('id').in('phone', [fullPhone, `+${fullPhone}`]).limit(1).maybeSingle(),
    ]);
    const unavailable = 'That username or phone number is already in use.';
    const before = await findDuplicates();
    if (before.some(result => result.error)) return failure('Could not check account availability. Please try again.', 503);
    if (before.some(result => result.data)) return failure(unavailable, 409);

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
      if (error.status === 429) return failure('Too many attempts. Please try again later.', 429);
      return failure('Could not create your account. Please try again.', 503);
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.status === 429) return failure('Too many attempts. Please try again later.', 429);
  if (error || !data.session || !data.user) {
    if (action === 'register') return failure('Account created. Sign in with your username and password to continue.', 503);
    if (error && (!error.status || error.status >= 500)) return failure('Sign-in is temporarily unavailable. Please try again.', 503);
    return failure(invalidLogin, 401);
  }

  const metadata = data.user.user_metadata;
  return NextResponse.json({
    data: {
      onboarded: metadata.onboarded === true || (metadata.onboarded == null && Boolean(metadata.name)),
      isAdmin: metadata.is_admin === true,
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    } satisfies PasswordSession,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
