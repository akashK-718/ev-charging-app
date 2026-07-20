import type { createAdminClient } from '@/lib/supabase/server';
import { BOOKING_AUTO_CANCEL_MINUTES } from '@/lib/constants';
import { refundPayment } from '@/lib/razorpay';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Lazy 30-minute auto-rejection sweep.
 *
 * No cron job existed before Module 7 — this ran synchronously at the top of
 * every booking-related API route. Now it also runs inside the pg_cron lifecycle
 * sweep (POST /api/internal/lifecycle-sweep). Both paths are safe: the UPDATE
 * WHERE status = 'pending' guard means a booking can only transition once.
 */
export async function runAutoRejectSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(Date.now() - BOOKING_AUTO_CANCEL_MINUTES * 60 * 1000).toISOString();

  const { data: expired } = await adminSupabase
    .from('bookings')
    .update({
      status:           'auto_rejected',
      rejected_at:      new Date().toISOString(),
      rejection_reason: 'Lender did not respond within 30 minutes',
      lifecycle_reason: "Host didn't respond within 30 minutes",
    })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id, driver_id, lender_id');

  if (!expired || expired.length === 0) return;

  for (const booking of expired as Array<{ id: string; driver_id: string; lender_id: string }>) {
    await refundExpiredBooking(adminSupabase, booking.id);
    await notify(booking.driver_id, 'booking_auto_rejected', { booking_id: booking.id });
    await notify(booking.lender_id, 'booking_auto_rejected', { booking_id: booking.id });
    // TODO: Future penalty policy — consider penalising lenders who frequently let requests expire.
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Booking request expired',
        body: "Your booking request expired because the host didn't respond. Payment refund is on the way.",
        url: `/bookings/${booking.id}`,
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: 'Booking request expired',
        body: 'Booking request expired after 30 minutes without a response.',
        url: `/lender/bookings/${booking.id}`,
      }),
    ]);
  }
}

async function refundExpiredBooking(adminSupabase: AdminClient, bookingId: string): Promise<void> {
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
    // Non-fatal — booking is already auto_rejected; refund retried on next sweep
    // since razorpay_refund_id remains null.
    console.error(`[auto-reject] refund failed for booking ${bookingId}:`, err);
  }
}
