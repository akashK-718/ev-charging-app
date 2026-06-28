import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['lender', 'both'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Only lenders can submit KYC' }, { status: 403 });
  }

  // Check for existing pending/approved submission
  const { data: existing } = await adminSupabase
    .from('kyc_submissions')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing) {
    const msg =
      existing.status === 'approved'
        ? 'Your KYC is already approved.'
        : 'You already have a pending KYC submission under review.';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const {
    aadhaar_photo_url,
    pan_photo_url,
    selfie_url,
    pan_number,
    aadhaar_last_4,
    bank_account_number,
    bank_ifsc,
    upi_id,
  } = b as {
    aadhaar_photo_url?: string;
    pan_photo_url?: string;
    selfie_url?: string;
    pan_number?: string;
    aadhaar_last_4?: string;
    bank_account_number?: string;
    bank_ifsc?: string;
    upi_id?: string;
  };

  const errors: string[] = [];

  if (!aadhaar_photo_url || typeof aadhaar_photo_url !== 'string') {
    errors.push('Aadhaar photo is required');
  }
  if (!pan_photo_url || typeof pan_photo_url !== 'string') {
    errors.push('PAN photo is required');
  }
  if (!selfie_url || typeof selfie_url !== 'string') {
    errors.push('Selfie is required');
  }
  if (!pan_number || !PAN_REGEX.test(pan_number)) {
    errors.push('PAN number must be in format ABCDE1234F');
  }
  if (!aadhaar_last_4 || !/^\d{4}$/.test(aadhaar_last_4)) {
    errors.push('Aadhaar last 4 digits must be exactly 4 digits');
  }

  const hasBankDetails = bank_account_number && bank_ifsc;
  const hasUpi = upi_id && typeof upi_id === 'string' && upi_id.trim().length > 0;

  if (!hasBankDetails && !hasUpi) {
    errors.push('Provide either bank account + IFSC or UPI ID');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], details: errors }, { status: 400 });
  }

  const { data: submission, error: insertError } = await adminSupabase
    .from('kyc_submissions')
    .insert({
      user_id: user.id,
      aadhaar_photo_url: aadhaar_photo_url as string,
      pan_photo_url: pan_photo_url as string,
      selfie_url: selfie_url as string,
      pan_number: pan_number as string,
      aadhaar_last_4: aadhaar_last_4 as string,
      bank_account_number: bank_account_number ?? null,
      bank_ifsc: bank_ifsc ?? null,
      upi_id: upi_id ?? null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !submission) {
    console.error('[POST /api/lender/kyc] insert error', insertError);
    return NextResponse.json({ error: 'Failed to submit KYC, please try again.' }, { status: 500 });
  }

  await adminSupabase
    .from('users')
    .update({ kyc_status: 'pending' })
    .eq('id', user.id);

  await notify(user.id, 'kyc_approved', { submission_id: submission.id });

  return NextResponse.json({ ok: true, id: submission.id });
}
