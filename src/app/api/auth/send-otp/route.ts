import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/msg91';

/**
 * POST /api/auth/send-otp
 * Body: { phone: string }  — 10-digit Indian number
 */
export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const fullPhone = `91${phone}`;
    const result = await sendOtp(fullPhone);

    if (result.type !== 'success') {
      return NextResponse.json(
        { error: result.message || 'Failed to send OTP' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, requestId: result.request_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
