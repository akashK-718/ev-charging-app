import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * PATCH /api/lender/payout-details
 *
 * Updates the bank/UPI payout fields on the user's approved KYC submission.
 * Only available to lenders whose kyc_status is already 'approved'.
 *
 * Does NOT create a new submission or change kyc_status — identity documents
 * (Aadhaar, PAN, selfie) are already on file and do not need to be re-submitted
 * when the user only wants to update their payout account.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('role, kyc_status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'lender') {
    return NextResponse.json({ error: 'Only lenders can update payout details' }, { status: 403 });
  }

  if (profile.kyc_status !== 'approved') {
    return NextResponse.json(
      { error: 'Payout details can only be updated after KYC is approved. Please complete verification first.' },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { bank_account_number, bank_ifsc, upi_id } = body as {
    bank_account_number?: string;
    bank_ifsc?: string;
    upi_id?: string;
  };

  const hasBankDetails = bank_account_number && bank_account_number.trim().length > 5
    && bank_ifsc && bank_ifsc.trim().length === 11;
  const hasUpi = upi_id && upi_id.trim().length > 3;

  if (!hasBankDetails && !hasUpi) {
    return NextResponse.json(
      { error: 'Provide either a bank account + IFSC or a UPI ID' },
      { status: 400 },
    );
  }

  const updates = hasBankDetails
    ? { bank_account_number: bank_account_number!.trim(), bank_ifsc: bank_ifsc!.trim().toUpperCase(), upi_id: null }
    : { upi_id: upi_id!.trim(), bank_account_number: null, bank_ifsc: null };

  const { error: updateError } = await admin
    .from('kyc_submissions')
    .update(updates)
    .eq('user_id', user.id)
    .eq('status', 'approved');

  if (updateError) {
    console.error('[PATCH /api/lender/payout-details]', updateError);
    return NextResponse.json({ error: 'Failed to update payout details. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
