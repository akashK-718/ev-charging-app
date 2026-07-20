import type { createAdminClient } from '@/lib/supabase/server';
import {
  NOSHOW_WARNING_MINUTES,
  NOSHOW_TIMEOUT_MINUTES,
  NOSHOW_MAX_ELAPSED_MINUTES,
  NOSHOW_EXTENSION_WARN_BEFORE_MINUTES,
} from '@/lib/constants';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Sends the initial no-show warning push to the host at T+NOSHOW_WARNING_MINUTES.
 * Sets noshow_warning_sent_at so the warning is sent exactly once per booking.
 * Push includes Keep Waiting / Mark No-show action buttons.
 */
export async function runNoShowWarningSweep(adminSupabase: AdminClient): Promise<void> {
  const warningCutoff = new Date(Date.now() - NOSHOW_WARNING_MINUTES * 60 * 1000).toISOString();
  const timeoutCutoff = new Date(Date.now() - NOSHOW_TIMEOUT_MINUTES * 60 * 1000).toISOString();
  const nowIso        = new Date().toISOString();

  // Bookings past the warning threshold but not yet at timeout, warning not yet sent.
  const { data: needWarning } = await adminSupabase
    .from('bookings')
    .update({ noshow_warning_sent_at: nowIso })
    .eq('status', 'awaiting_driver_confirmation')
    .lt('started_at', warningCutoff)
    .gte('started_at', timeoutCutoff)
    .is('noshow_warning_sent_at', null)
    .select('id, driver_id, lender_id');

  if (needWarning && needWarning.length > 0) {
    const minutesLeft = NOSHOW_TIMEOUT_MINUTES - NOSHOW_WARNING_MINUTES;
    for (const booking of needWarning as Array<{ id: string; driver_id: string; lender_id: string }>) {
      await notify(booking.lender_id, 'noshow_warning_host', { booking_id: booking.id });
      void sendPushNotification({
        userId: booking.lender_id,
        title: "Driver hasn't arrived",
        body: `Auto-cancel in ${minutesLeft} minutes.`,
        url: `/lender/bookings/${booking.id}`,
        actions: [
          { action: 'keep_waiting', title: 'Keep Waiting' },
          { action: 'mark_no_show', title: 'Mark No-show' },
        ],
        requireInteraction: true,
        tag: `noshow-warning-${booking.id}`,
        notificationData: { booking_id: booking.id },
      });
    }
  }

  // Extension warning: fires when keep_waiting_until is within
  // NOSHOW_EXTENSION_WARN_BEFORE_MINUTES of expiry and not yet sent.
  const extensionWarnCutoff = new Date(
    Date.now() + NOSHOW_EXTENSION_WARN_BEFORE_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: needExtWarn } = await adminSupabase
    .from('bookings')
    .update({ noshow_extension_warning_sent_at: nowIso })
    .eq('status', 'awaiting_driver_confirmation')
    .not('keep_waiting_until', 'is', null)
    .lt('keep_waiting_until', extensionWarnCutoff) // expires within warn window
    .gt('keep_waiting_until', nowIso)              // not yet expired
    .is('noshow_extension_warning_sent_at', null)
    .select('id, driver_id, lender_id, keep_waiting_until');

  if (needExtWarn && needExtWarn.length > 0) {
    for (const booking of needExtWarn as Array<{
      id: string; driver_id: string; lender_id: string; keep_waiting_until: string;
    }>) {
      void sendPushNotification({
        userId: booking.lender_id,
        title: "Extension ending soon",
        body: `Auto-cancel in ${NOSHOW_EXTENSION_WARN_BEFORE_MINUTES} minutes — no further extensions.`,
        url: `/lender/bookings/${booking.id}`,
        tag: `noshow-ext-warning-${booking.id}`,
      });
    }
  }
}

/**
 * Transitions bookings to no_show when their deadline has passed:
 * - Case A: no Keep Waiting used, past NOSHOW_TIMEOUT_MINUTES.
 * - Case B: Keep Waiting extension expired.
 * - Case C: Past NOSHOW_MAX_ELAPSED_MINUTES hard cutoff (any extension).
 *
 * Each case uses .eq('status', 'awaiting_driver_confirmation') so that a booking
 * caught by one case is already transitioned before the next case runs.
 */
export async function runNoShowTimeoutSweep(adminSupabase: AdminClient): Promise<void> {
  const timeoutCutoff = new Date(Date.now() - NOSHOW_TIMEOUT_MINUTES    * 60 * 1000).toISOString();
  const maxCutoff     = new Date(Date.now() - NOSHOW_MAX_ELAPSED_MINUTES * 60 * 1000).toISOString();
  const nowIso        = new Date().toISOString();

  // Case A: timeout with no extension
  const { data: caseA } = await adminSupabase
    .from('bookings')
    .update({
      status:           'no_show',
      no_show_at:       nowIso,
      lifecycle_reason: `Driver didn't arrive within ${NOSHOW_TIMEOUT_MINUTES} minutes of session start`,
    })
    .eq('status', 'awaiting_driver_confirmation')
    .lt('started_at', timeoutCutoff)
    .is('keep_waiting_until', null)
    .select('id, driver_id, lender_id');

  // Case B: Keep Waiting extension expired before hard cutoff
  const { data: caseB } = await adminSupabase
    .from('bookings')
    .update({
      status:           'no_show',
      no_show_at:       nowIso,
      lifecycle_reason: "Driver didn't arrive after Keep Waiting extension expired",
    })
    .eq('status', 'awaiting_driver_confirmation')
    .not('keep_waiting_until', 'is', null)
    .lt('keep_waiting_until', nowIso)
    .gte('started_at', maxCutoff) // not already a Case C candidate
    .select('id, driver_id, lender_id');

  // Case C: hard cutoff regardless of extension
  const { data: caseC } = await adminSupabase
    .from('bookings')
    .update({
      status:           'no_show',
      no_show_at:       nowIso,
      lifecycle_reason: `Driver didn't arrive within ${NOSHOW_MAX_ELAPSED_MINUTES} minutes (hard cutoff)`,
    })
    .eq('status', 'awaiting_driver_confirmation')
    .lt('started_at', maxCutoff)
    .select('id, driver_id, lender_id');

  const allNoShows = [
    ...(caseA ?? []),
    ...(caseB ?? []),
    ...(caseC ?? []),
  ] as Array<{ id: string; driver_id: string; lender_id: string }>;

  for (const booking of allNoShows) {
    await notify(booking.driver_id, 'booking_no_show', { booking_id: booking.id });
    await notify(booking.lender_id, 'booking_no_show', { booking_id: booking.id });
    // TODO: Future penalty policy — driver forfeits payment on no-show.
    // Hook refund/penalty logic here when RazorpayX payouts are wired.
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Booking closed',
        body: "Your booking was marked as a no-show — you didn't confirm the session start in time.",
        url: `/bookings/${booking.id}`,
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: "Driver didn't arrive",
        body: 'The booking has been closed. The slot is now available again.',
        url: `/lender/bookings/${booking.id}`,
      }),
    ]);
  }
}
