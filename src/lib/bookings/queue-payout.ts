import type { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Queue a payout for a single completed booking's payment.
 *
 * Inserts a `payouts` row with status 'pending' so it shows up in
 * /admin/payouts. There's no scheduler yet (Module 7+) — admins are
 * expected to wait out PAYOUT_HOLD_HOURS before marking it processed.
 *
 * Derives bank_or_upi from the lender's most recent approved KYC submission.
 * If the lender has no approved submission on file (shouldn't happen since
 * chargers only go live post-KYC, but defends against edge cases), the
 * payout is skipped — the booking still completes normally.
 */
export async function queuePayoutForBooking(
  adminSupabase: AdminClient,
  bookingId: string,
  lenderId: string,
): Promise<void> {
  const [paymentRes, kycRes] = await Promise.all([
    adminSupabase
      .from('payments')
      .select('lender_payout, status')
      .eq('booking_id', bookingId)
      .maybeSingle(),
    adminSupabase
      .from('kyc_submissions')
      .select('bank_account_number, bank_ifsc, upi_id')
      .eq('user_id', lenderId)
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const payment = paymentRes.data;
  if (!payment || payment.status !== 'paid' || payment.lender_payout <= 0) return;

  const kyc = kycRes.data;
  let bankOrUpi: string | null = null;
  if (kyc?.upi_id) {
    bankOrUpi = `UPI: ${kyc.upi_id}`;
  } else if (kyc?.bank_account_number && kyc?.bank_ifsc) {
    bankOrUpi = `Bank: ****${kyc.bank_account_number.slice(-4)} / IFSC ${kyc.bank_ifsc}`;
  }

  if (!bankOrUpi) {
    console.error(`[queue-payout] lender ${lenderId} has no payout details on file — skipping`);
    return;
  }

  await adminSupabase.from('payouts').insert({
    user_id: lenderId,
    amount_paise: payment.lender_payout,
    status: 'pending',
    bank_or_upi: bankOrUpi,
    booking_ids: [bookingId],
  });
}
