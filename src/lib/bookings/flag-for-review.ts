import type { createAdminClient } from '@/lib/supabase/server';
import { SESSION_END_REVIEW_GRACE_MINUTES } from '@/lib/constants';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

/*
 * MVP Rule: Kirin has no hardware-backed charger telemetry. Session energy
 * and cost are derived from application events rather than physical meter
 * readings. Therefore, any session stuck in awaiting_end_confirmation cannot be
 * safely auto-completed and is placed into a manual review queue for resolution.
 * This rule should be revisited if/when OCPP or smart-meter telemetry is added
 * in a future version.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Flags bookings stuck in awaiting_end_confirmation for admin review instead
 * of auto-completing them. Replaces the old runAutoCompleteEndSweep.
 *
 * Idempotent: session_review_queue has a UNIQUE constraint on booking_id, so
 * repeated sweeps produce an upsert that updates only flagged_at.
 */
export async function runFlagForReviewSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(Date.now() - SESSION_END_REVIEW_GRACE_MINUTES * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: stuck } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id')
    .eq('status', 'awaiting_end_confirmation')
    .lt('end_initiated_at', cutoff);

  if (!stuck || stuck.length === 0) return;

  for (const booking of stuck as Array<{ id: string; driver_id: string; lender_id: string }>) {
    // Upsert into review queue — UNIQUE (booking_id) prevents duplicate rows.
    await adminSupabase
      .from('session_review_queue')
      .upsert({ booking_id: booking.id, flagged_at: nowIso }, { onConflict: 'booking_id' });

    // TODO: Future: when OCPP or smart-meter telemetry is available, auto-complete here
    // instead of flagging for review. See docs/INFORMATION_ARCHITECTURE.md § Booking Lifecycle.
    await notify(booking.driver_id, 'session_flagged_review', { booking_id: booking.id });
    await notify(booking.lender_id, 'session_flagged_review', { booking_id: booking.id });
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Session under review',
        body: "Your charging session is being reviewed. We'll update you shortly.",
        url: `/bookings/${booking.id}`,
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: 'Session awaiting review',
        body: 'The session end is pending manual review. We\'ll update you shortly.',
        url: `/lender/bookings/${booking.id}`,
      }),
    ]);
  }
}
