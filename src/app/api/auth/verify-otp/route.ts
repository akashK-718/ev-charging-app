import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/msg91';

/**
 * POST /api/auth/verify-otp
 * Body: { phone: string, otp: string }
 *
 * On success, creates/finds a user record and sets the session cookie.
 * TODO (Milestone 1): wire up session + Supabase user upsert.
 */
export async function POST(request: NextRequest) {
  const { phone, otp } = await request.json();
  const result = await verifyOtp(`91${phone}`, otp);

  if (!result.verified) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  // TODO: upsert user, create session, set cookie.
  return NextResponse.json({ ok: true });
}
