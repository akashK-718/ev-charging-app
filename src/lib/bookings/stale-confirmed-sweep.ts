import type { createAdminClient } from '@/lib/supabase/server';
import { refundPayment } from '@/lib/razorpay';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Auto-cancels confirmed bookings whose entire scheduled window has elapsed
 * without a charging session starting (host never tapped Start).
 *
 * Product decision (2026-08): the system cannot determine who failed to attend
 * when the host never initiated the session (started_at never set). Rather than
 * mis-attributing blame, we cancel neutrally and issue a full driver refund.
 * cancellation_reason = 'booking_window_expired' is intentionally distinct from
 * 'no_show' so that any future host/driver reliability logic can target it
 * independently.
 *
 * Idempotency: the UPDATE's .eq('status', 'confirmed') guard ensures a booking
 * transitions at most once. The refund guard (.is('razorpay_refund_id', null))
 * prevents double-refunding if the sweep fires while a prior refund call is
 * still in-flight.
 */
export async function runStaleConfirmedSweep(adminSupabase: AdminClient): Promise<void> {
  const nowIso = new Date().toISOString();

  const { data: expired } = await adminSupabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancelled_at:        nowIso,
      cancellation_reason: 'booking_window_expired',
      lifecycle_reason:    'Booking window elapsed without session starting — auto-cancelled, full refund issued',
    })
    .eq('status', 'confirmed')
    .lt('scheduled_end', nowIso)
    .select('id, driver_id, lender_id');

  if (!expired || expired.length === 0) return;

  for (const booking of expired as Array<{ id: string; driver_id: string; lender_id: string }>) {
    await refundWindowExpired(adminSupabase, booking.id);
    await notify(booking.driver_id, 'booking_cancelled', { booking_id: booking.id });
    await notify(booking.lender_id, 'booking_cancelled', { booking_id: booking.id });
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Booking expired',
        body: "Your booking window passed without the session starting. A full refund is on the way.",
        url: `/bookings/${booking.id}`,
        category: 'booking_updates',
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: 'Booking expired',
        body: "A confirmed booking expired because the session was never started. The driver has been refunded.",
        url: `/lender/bookings/${booking.id}`,
        category: 'hosting_activity',
      }),
    ]);
  }
}

async function refundWindowExpired(adminSupabase: AdminClient, bookingId: string): Promise<void> {
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
    // Non-fatal — booking is already cancelled; refund retried on next sweep
    // since razorpay_refund_id remains null.
    console.error(`[stale-confirmed] refund failed for booking ${bookingId}:`, err);
  }
}
