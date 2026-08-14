import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/msg91';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isEmergencyLockdown } from '@/lib/edge-config';
import { readKillSwitch } from '@/lib/app-settings';

if (!process.env.SUPABASE_PHONE_PASSWORD_SECRET) {
  console.warn(
    '[verify-otp] SUPABASE_PHONE_PASSWORD_SECRET is not set. OTP verification will fail.'
  );
}

async function derivePassword(phone: string): Promise<string> {
  const secret = process.env.SUPABASE_PHONE_PASSWORD_SECRET;
  if (!secret) {
    throw new Error('[verify-otp] SUPABASE_PHONE_PASSWORD_SECRET is not set. Cannot derive auth password.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(phone));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Supabase Auth uses email+password internally — phone auth requires configuring an SMS
// provider (Twilio etc.) which we don't need. We derive a stable fake email from the phone
// number so we get a real Supabase Auth session using the default Email provider, which
// requires zero Supabase dashboard configuration beyond creating the project.
function phoneToAuthEmail(fullPhone: string): string {
  return `${fullPhone}@auth.local`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { phone, otp } = body as Record<string, string>;

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Invalid phone number', code: 'INVALID_PHONE' },
      { status: 400 },
    );
  }

  if (!/^\d{4,6}$/.test(otp)) {
    return NextResponse.json(
      { error: 'Invalid OTP format', code: 'INVALID_OTP' },
      { status: 400 },
    );
  }

  const fullPhone = `91${phone}`;

  const verification = await verifyOtp(fullPhone, otp);
  if (!verification.verified) {
    const isExpired = verification.message?.toLowerCase().includes('expir') ?? false;
    return NextResponse.json(
      {
        error: isExpired ? 'This code has expired. Request a new code.' : 'Incorrect OTP. Please try again.',
        code: isExpired ? 'EXPIRED_OTP' : 'INVALID_OTP',
      },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const password = await derivePassword(fullPhone);
  const email = phoneToAuthEmail(fullPhone);

  // Look up in our users table to determine isNewUser
  const { data: existingProfile } = await adminSupabase
    .from('users')
    .select('id, role, name, is_admin')
    .eq('phone', fullPhone)
    .maybeSingle();

  // Registrations kill switch only blocks brand-new accounts — existing users
  // must always be able to sign in regardless of this flag.
  if (!existingProfile) {
    const [locked, registrationsEnabled] = await Promise.all([
      isEmergencyLockdown(),
      readKillSwitch('allow_registrations'),
    ]);
    if (locked) {
      return NextResponse.json(
        { error: 'Service is temporarily unavailable.' },
        { status: 503 },
      );
    }
    if (!registrationsEnabled) {
      return NextResponse.json(
        { error: 'New registrations are temporarily unavailable.' },
        { status: 503 },
      );
    }
  }

  let userId: string;
  let role: string;
  let isAdmin: boolean;
  let isNewUser: boolean;
  let userName: string | null = null;

  if (existingProfile) {
    userId = existingProfile.id;
    role = existingProfile.role;
    isAdmin = (existingProfile as { is_admin: boolean }).is_admin ?? false;
    isNewUser = false;
    userName = existingProfile.name ?? null;

    const profile = existingProfile as { name: string | null; is_admin: boolean };
    const metaUpdate = {
      role,
      is_admin: isAdmin,
      ...(profile.name ? { name: profile.name } : {}),
    };

    // Step 1: create auth.users entry if absent (migration path for accounts that
    // predate this OTP flow, or were inserted directly into public.users).
    // "User already registered" error is intentionally ignored.
    // Step 1: create auth.users entry if absent (migration path for accounts that
    // predate this OTP flow, or were inserted directly into public.users).
    // "User already registered" error is intentionally ignored.
    await adminSupabase.auth.admin.createUser({
      id: userId,
      email,
      email_confirm: true,
      password,
      user_metadata: metaUpdate,
    });

    // Step 2: sync password + metadata. Fixes grant_admin accounts whose auth.users
    // row was created with a placeholder password, and keeps JWT metadata in sync.
    // app_metadata must be set — if null, Supabase returns unexpected_failure on sign-in.
    await adminSupabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: metaUpdate,
      app_metadata: { provider: 'email', providers: ['email'] },
    });
  } else {
    // New user — create in Supabase Auth first to get the canonical UUID
    const { data: authData, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      // onboarded:false marks this account as mid-welcome-flow; cleared once they pick a role.
      user_metadata: { role: 'driver', onboarded: false },
    });

    if (createError || !authData.user) {
      console.error('[verify-otp] auth.admin.createUser failed:', createError);
      return NextResponse.json(
        { error: 'Could not create account. Please try again.' },
        { status: 500 },
      );
    }

    userId = authData.user.id;

    // Create profile row with the same UUID as auth.users (required for RLS auth.uid() = id)
    const { data: newProfile, error: insertError } = await adminSupabase
      .from('users')
      .insert({ id: userId, phone: fullPhone })
      .select('id, role')
      .single();

    if (insertError || !newProfile) {
      console.error('[verify-otp] users table insert failed:', insertError);
      return NextResponse.json(
        { error: 'Could not create account. Please try again.' },
        { status: 500 },
      );
    }

    role = newProfile.role;
    isAdmin = false;
    isNewUser = true;
  }

  // Sign in with email+password to create a real Supabase Auth session.
  // createClient() uses cookies() from next/headers so session cookies are set on the response.
  // The access_token and refresh_token are also returned to the client so it can call
  // setSession() on the browser Supabase singleton, which is the only mechanism that fires
  // SIGNED_IN on onAuthStateChange — getSession() does not notify subscribers.
  const supabase = createClient();
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.session) {
    console.error('[verify-otp] signInWithPassword failed:', signInError);
    return NextResponse.json(
      { error: 'Authentication error. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      userId,
      role,
      isNewUser,
      isAdmin,
      name: userName,
      // Returned so the browser client can call setSession() to fire SIGNED_IN immediately.
      // Sending tokens over HTTPS is the standard Supabase pattern (same as supabase.auth.signIn).
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    },
  });
}
