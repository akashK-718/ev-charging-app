import type { createAdminClient } from '@/lib/supabase/server';
import { SESSION_GRACE_MINUTES } from '@/lib/constants';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Lazy no-show sweep (belt-and-suspenders alongside the pg_cron sweep).
 *
 * Catches bookings where the session slot ended (+ grace period) and the
 * session was never started — either because the lender never initiated
 * (status stayed 'confirmed') or the driver never confirmed after the lender
 * started (status stayed 'awaiting_driver_confirmation' past the slot end).
 *
 * The pg_cron-driven no-show-sweep.ts handles the finer 25/30/60-min timer
 * from session initiation. This lazy sweep is the fallback for bookings that
 * were never even initiated before the slot fully ended.
 *
 * No payout is queued — driver forfeits payment on no-show.
 * TODO: Future penalty policy — hook refund/penalty logic here when RazorpayX payouts are wired.
 */
export async function runAutoNoShowSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(
    Date.now() - SESSION_GRACE_MINUTES * 60 * 1000,
  ).toISOString();

  const nowIso = new Date().toISOString();

  const { data: noShows } = await adminSupabase
    .from('bookings')
    .update({
      status:           'no_show',
      no_show_at:       nowIso,
      lifecycle_reason: `Session slot ended without being started (grace period: ${SESSION_GRACE_MINUTES} min)`,
    })
    .in('status', ['confirmed', 'awaiting_driver_confirmation'])
    .is('started_at', null)
    .lt('scheduled_end', cutoff)
    .select('id, driver_id, lender_id');

  if (!noShows || noShows.length === 0) return;

  for (const booking of noShows as Array<{ id: string; driver_id: string; lender_id: string }>) {
    await notify(booking.driver_id, 'booking_no_show', { booking_id: booking.id });
    await notify(booking.lender_id, 'booking_no_show', { booking_id: booking.id });
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Booking closed',
        body: "Your booking was closed because the session was never started.",
        url: `/bookings/${booking.id}`,
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: 'Booking closed',
        body: "The booking was closed — the slot ended without a session starting.",
        url: `/lender/bookings/${booking.id}`,
      }),
    ]);
  }
}
