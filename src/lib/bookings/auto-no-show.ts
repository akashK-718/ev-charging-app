import type { createAdminClient } from '@/lib/supabase/server';
import { SESSION_GRACE_MINUTES } from '@/lib/constants';
import { notify } from '@/lib/notifications';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Lazy no-show sweep.
 *
 * A booking is a no-show when the session slot ended (+ grace period) and the
 * session was never started — either because the lender never initiated
 * (status stayed 'confirmed') or because the driver never confirmed
 * (status stayed 'awaiting_driver_confirmation').
 *
 * No cron job exists yet (Module 7+), so this runs synchronously inside
 * POST /api/bookings/[id]/start, the same way runAutoRejectSweep does.
 * It is idempotent — a booking can only transition out of these statuses once.
 *
 * No payout is queued — driver forfeits payment on no-show.
 */
export async function runAutoNoShowSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(
    Date.now() - SESSION_GRACE_MINUTES * 60 * 1000,
  ).toISOString();

  const nowIso = new Date().toISOString();

  const { data: noShows } = await adminSupabase
    .from('bookings')
    .update({ status: 'no_show', no_show_at: nowIso })
    .in('status', ['confirmed', 'awaiting_driver_confirmation'])
    .is('started_at', null)
    .lt('scheduled_end', cutoff)
    .select('id, driver_id, lender_id');

  if (!noShows || noShows.length === 0) return;

  for (const booking of noShows as Array<{ id: string; driver_id: string; lender_id: string }>) {
    await notify(booking.driver_id, 'booking_no_show', { booking_id: booking.id });
    await notify(booking.lender_id, 'booking_no_show', { booking_id: booking.id });
  }
}
