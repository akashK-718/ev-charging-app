import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { refundPayment } from '@/lib/razorpay';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';

const MIN_REASON_LENGTH = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

  const b = body as { reason?: string };
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (reason.length < MIN_REASON_LENGTH) {
    return NextResponse.json(
      { error: `Rejection reason must be at least ${MIN_REASON_LENGTH} characters` },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  await runAutoRejectSweep(adminSupabase);

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id, status')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'pending') {
    return NextResponse.json(
      { error: `Booking is already ${booking.status}` },
      { status: 409 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      cancellation_reason: reason,
    })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to reject booking' }, { status: 500 });
  }

  await refundIfNeeded(adminSupabase, params.id);

  await notify(booking.driver_id, 'booking_rejected', {
    booking_id: params.id,
    reason,
  });

  return NextResponse.json({ ok: true });
}

async function refundIfNeeded(
  adminSupabase: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  const { data: payment } = await adminSupabase
    .from('payments')
    .select('id, razorpay_payment_id, gross_amount, status, razorpay_refund_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!payment || payment.status !== 'paid' || payment.razorpay_refund_id || !payment.razorpay_payment_id) {
    return;
  }

  try {
    const refund = await refundPayment(payment.razorpay_payment_id, payment.gross_amount);
    await adminSupabase
      .from('payments')
      .update({ status: 'refunded', razorpay_refund_id: refund.id })
      .eq('id', payment.id);
  } catch (err) {
    console.error(`[reject] refund failed for booking ${bookingId}:`, err);
  }
}
