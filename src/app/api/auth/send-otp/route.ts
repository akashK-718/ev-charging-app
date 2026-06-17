import { NextRequest, NextResponse } from 'next/server';
import { sendOtp } from '@/lib/msg91';

// TODO: Add rate limiting here — 3 OTPs per phone per hour (Upstash Redis)

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }

  const rawPhone = (body as Record<string, unknown>)?.phone;
  const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Enter a valid 10-digit mobile number', code: 'INVALID_PHONE' },
      { status: 400 },
    );
  }

  const result = await sendOtp(`91${phone}`);

  if (result.type !== 'success') {
    return NextResponse.json(
      { error: 'Could not send OTP. Please try again.', code: 'SMS_UNAVAILABLE' },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { requestId: result.request_id } });
}
