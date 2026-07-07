import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { refundPayment } from '@/lib/razorpay';
import { sendPushNotification } from '@/lib/notifications/push';
import { FREE_CANCEL_MINUTES, FREE_CANCEL_WINDOW_MINUTES } from '@/lib/constants';

/**
 * POST /api/bookings/[id]/cancel
 *
 * Driver cancel refund logic:
 *   - Within FREE_CANCEL_WINDOW_MINUTES of payment: full refund
 *   - Outside free window, >FREE_CANCEL_MINUTES before slot: full refund
 *   - Outside free window, <FREE_CANCEL_MINUTES before slot: no refund
 *
 * Lender cancel: always full refund.
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
    .select('id, charger_id, driver_id, lender_id, status, scheduled_start')
    .eq('id', params.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const isDriver = user.id === booking.driver_id;
  const isLender = user.id === booking.lender_id;

  if (!isDriver && !isLender) {
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

  // ── Lender-initiated cancellation ─────────────────────────────────────────
  if (isLender) {
    if (
      payment &&
      payment.status === 'paid' &&
      !payment.razorpay_refund_id &&
      payment.razorpay_payment_id
    ) {
      try {
        const refund = await refundPayment(payment.razorpay_payment_id, payment.gross_amount);
        await adminSupabase
          .from('payments')
          .update({ status: 'refunded', razorpay_refund_id: refund.id })
          .eq('id', payment.id);
      } catch (err) {
        console.error(`[cancel] lender refund failed for booking ${params.id}:`, err);
        return NextResponse.json(
          { error: 'Refund could not be processed. Please contact support.' },
          { status: 502 },
        );
      }
    }

    const { error: updateError } = await adminSupabase
      .from('bookings')
      .update({ status: 'cancelled', cancellation_reason: 'lender_cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
    }

    void (async () => {
      const { data: charger } = await adminSupabase
        .from('chargers').select('title').eq('id', booking.charger_id).single();
      const chargerName = charger?.title ?? 'your charger';
      await sendPushNotification({
        userId: booking.driver_id,
        title: 'Booking cancelled by host',
        body: `Your booking at ${chargerName} was cancelled. Full refund issued.`,
        url: `/bookings/${params.id}`,
      });
    })();

    return NextResponse.json({ ok: true, refunded: true });
  }

  // ── Driver-initiated cancellation ──────────────────────────────────────────
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

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: cancellationReason, cancelled_at: new Date().toISOString() })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }

  const driverName = (user.user_metadata?.name as string | undefined) ?? 'The driver';
  const when = new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
  void sendPushNotification({
    userId: booking.lender_id,
    title: 'Booking cancelled',
    body: `${driverName} cancelled their booking for ${when}`,
    url: `/lender/bookings/${params.id}`,
  });

  return NextResponse.json({ ok: true, refunded: refundAmount > 0 });
}
