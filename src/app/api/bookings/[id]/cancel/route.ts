import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { refundPayment } from '@/lib/razorpay';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';
import { FREE_CANCEL_MINUTES, FREE_CANCEL_WINDOW_MINUTES } from '@/lib/constants';

/**
 * POST /api/bookings/[id]/cancel — driver cancels their own booking.
 *
 * Refund logic:
 *   - Within FREE_CANCEL_WINDOW_MINUTES of payment: full refund (free window)
 *   - Outside free window, >FREE_CANCEL_MINUTES before slot: full refund
 *   - Outside free window, <FREE_CANCEL_MINUTES before slot: no refund
 *
 * Razorpay refund is server-side only. Idempotent: checks razorpay_refund_id
 * before calling the refund API.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id, status, scheduled_start')
    .eq('id', params.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.driver_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['pending', 'confirmed'].includes(booking.status)) {
    return NextResponse.json(
      { error: `Booking cannot be cancelled in status: ${booking.status}` },
      { status: 409 },
    );
  }

  const { data: payment } = await adminSupabase
    .from('payments')
    .select('id, razorpay_payment_id, gross_amount, status, razorpay_refund_id, created_at')
    .eq('booking_id', params.id)
    .maybeSingle();

  // Determine refund amount and reason
  const paymentAgeMs = payment?.created_at
    ? Date.now() - new Date(payment.created_at).getTime()
    : Infinity;
  const inFreeWindow = paymentAgeMs <= FREE_CANCEL_WINDOW_MINUTES * 60 * 1000;
  const minutesToStart = (new Date(booking.scheduled_start).getTime() - Date.now()) / 60000;

  let refundAmount: number;
  let cancellationReason: string;

  if (inFreeWindow) {
    refundAmount = payment?.gross_amount ?? 0;
    cancellationReason = 'driver_free_window';
  } else if (minutesToStart > FREE_CANCEL_MINUTES) {
    refundAmount = payment?.gross_amount ?? 0;
    cancellationReason = 'driver_outside_window';
  } else {
    refundAmount = 0;
    cancellationReason = 'driver_late_cancel';
  }

  // Issue refund if applicable — idempotent: skip if already refunded
  if (
    refundAmount > 0 &&
    payment &&
    payment.status === 'paid' &&
    !payment.razorpay_refund_id &&
    payment.razorpay_payment_id
  ) {
    try {
      const refund = await refundPayment(payment.razorpay_payment_id, refundAmount);
      await adminSupabase
        .from('payments')
        .update({ status: 'refunded', razorpay_refund_id: refund.id })
        .eq('id', payment.id);
    } catch (err) {
      console.error(`[cancel] refund failed for booking ${params.id}:`, err);
      return NextResponse.json(
        { error: 'Refund could not be processed. Please contact support.' },
        { status: 502 },
      );
    }
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: cancellationReason, cancelled_at: nowIso })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }

  await notify(booking.lender_id, 'booking_cancelled', { booking_id: params.id });

  // Push: notify lender of driver cancellation (fire-and-forget)
  const driverName = (user.user_metadata?.name as string | undefined) ?? 'The driver';
  const when = new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
  await sendPushNotification({
    userId: booking.lender_id,
    title: 'Booking cancelled',
    body: `${driverName} cancelled their booking for ${when}`,
    url: `/lender/bookings/${params.id}`,
  });

  return NextResponse.json({ ok: true, refunded: refundAmount > 0 });
}
