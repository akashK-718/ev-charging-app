import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay, verifyPaymentSignature } from '@/lib/razorpay';
import { notify } from '@/lib/notifications';
import { generateConfirmationCode } from '@/lib/utils';

/**
 * POST /api/payments/verify
 *
 * Step 2 of booking creation: verify the Razorpay checkout signature, confirm
 * the captured order amount matches what we quoted, then atomically create
 * the booking + payment rows via the create_booking_with_payment RPC.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const {
    charger_id: chargerId,
    lender_id: lenderId,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    gross_amount: grossAmount,
    platform_fee: platformFee,
    lender_payout: lenderPayout,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = b;

  if (
    typeof chargerId !== 'string' || typeof lenderId !== 'string' ||
    typeof scheduledStart !== 'string' || typeof scheduledEnd !== 'string' ||
    typeof grossAmount !== 'number' || typeof platformFee !== 'number' || typeof lenderPayout !== 'number' ||
    typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing or invalid payment fields' }, { status: 400 });
  }

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  // Confirm the captured order amount matches what we quoted — defense
  // against a tampered gross_amount in the client request.
  try {
    const order = await getRazorpay().orders.fetch(orderId);
    if (order.amount !== grossAmount) {
      return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 });
    }
  } catch (err) {
    console.error('[payments/verify] failed to fetch order for verification:', err);
    return NextResponse.json({ error: 'Could not verify payment. Please contact support.' }, { status: 502 });
  }

  const adminSupabase = createAdminClient();

  const { data: bookingId, error: rpcError } = await adminSupabase.rpc('create_booking_with_payment', {
    p_charger_id: chargerId,
    p_driver_id: user.id,
    p_lender_id: lenderId,
    p_scheduled_start: scheduledStart,
    p_scheduled_end: scheduledEnd,
    p_confirmation_code: generateConfirmationCode(),
    p_gross_amount: grossAmount,
    p_platform_fee: platformFee,
    p_lender_payout: lenderPayout,
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
  });

  if (rpcError || !bookingId) {
    console.error('[payments/verify] create_booking_with_payment failed:', rpcError);
    return NextResponse.json(
      { error: 'Payment succeeded but booking creation failed. Contact support with your payment ID.', payment_id: paymentId },
      { status: 500 },
    );
  }

  // Atomic idempotency guard: only the first caller sets notification_sent_at.
  // Razorpay may retry this endpoint; without this, each retry sends a duplicate push.
  const { data: claimed } = await adminSupabase
    .from('bookings')
    .update({ notification_sent_at: new Date().toISOString() })
    .eq('id', bookingId)
    .is('notification_sent_at', null)
    .select('id');

  if (!claimed?.length) {
    // Another request already sent the notification — skip
    return NextResponse.json({ data: { booking_id: bookingId } });
  }

  // Fetch charger name for the rich notification body (fire-and-forget)
  const driverName = (user.user_metadata?.name as string | undefined) ?? 'A driver';
  void (async () => {
    const { data: charger } = await adminSupabase
      .from('chargers').select('title').eq('id', chargerId).single();
    const chargerName = charger?.title ?? 'your charger';
    await notify(lenderId, 'booking_received', {
      booking_id: bookingId,
      charger_id: chargerId,
      driver_name: driverName,
      charger_name: chargerName,
    });
  })();

  return NextResponse.json({ data: { booking_id: bookingId } });
}
