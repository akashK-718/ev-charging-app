import type { createAdminClient } from '@/lib/supabase/server';
import { BOOKING_AUTO_CANCEL_MINUTES } from '@/lib/constants';
import { refundPayment } from '@/lib/razorpay';
import { notify } from '@/lib/notifications';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Lazy 30-minute auto-rejection sweep.
 *
 * No cron job exists yet (Module 7+), so this runs synchronously at the top
 * of every booking-related API route. It's cheap (an indexed UPDATE that
 * usually matches zero rows) and idempotent — a booking can only transition
 * out of 'pending' once, so calling this on every request is safe.
 */
export async function runAutoRejectSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(Date.now() - BOOKING_AUTO_CANCEL_MINUTES * 60 * 1000).toISOString();

  const { data: expired } = await adminSupabase
    .from('bookings')
    .update({
      status: 'auto_rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: 'Lender did not respond within 30 minutes',
    })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id, driver_id');

  if (!expired || expired.length === 0) return;

  for (const booking of expired as Array<{ id: string; driver_id: string }>) {
    await refundExpiredBooking(adminSupabase, booking.id);
    await notify(booking.driver_id, 'booking_auto_rejected', { booking_id: booking.id });
  }
}

async function refundExpiredBooking(adminSupabase: AdminClient, bookingId: string): Promise<void> {
  const { data: payment } = await adminSupabase
    .from('payments')
    .select('id, razorpay_payment_id, gross_amount, status, razorpay_refund_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!payment || payment.status !== 'paid' || payment.razorpay_refund_id || !payment.razorpay_payment_id) {
    // Already refunded, never paid, or no payment row — nothing to do.
    return;
  }

  try {
    const refund = await refundPayment(payment.razorpay_payment_id, payment.gross_amount);
    await adminSupabase
      .from('payments')
      .update({ status: 'refunded', razorpay_refund_id: refund.id })
      .eq('id', payment.id);
  } catch (err) {
    // Non-fatal — the booking is already auto_rejected; refund will be retried
    // on the next sweep since razorpay_refund_id is still null.
    console.error(`[auto-reject] refund failed for booking ${bookingId}:`, err);
  }
}
