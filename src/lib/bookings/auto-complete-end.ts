import type { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { queuePayoutForBooking } from '@/lib/bookings/queue-payout';

const AUTO_COMPLETE_END_MINUTES = 15;

const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Lazy 15-minute auto-complete sweep for unconfirmed session ends.
 *
 * Runs at the top of booking-detail API routes (alongside runAutoRejectSweep).
 * Finds any booking stuck in 'awaiting_end_confirmation' for > 15 minutes,
 * marks it completed, queues payout, and notifies both parties.
 *
 * Idempotent: the UPDATE WHERE status = 'awaiting_end_confirmation' guard
 * ensures a booking can only transition out of that state once.
 */
export async function runAutoCompleteEndSweep(adminSupabase: AdminClient): Promise<void> {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_END_MINUTES * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: expired } = await adminSupabase
    .from('bookings')
    .update({
      status: 'completed',
      ended_at: nowIso,
      actual_end: nowIso,
    })
    .eq('status', 'awaiting_end_confirmation')
    .lt('end_initiated_at', cutoff)
    .select('id, charger_id, driver_id, lender_id, started_at');

  if (!expired || expired.length === 0) return;

  for (const booking of expired as Array<{
    id: string;
    charger_id: string;
    driver_id: string;
    lender_id: string;
    started_at: string | null;
  }>) {
    const durationHours = Math.max(
      0,
      (Date.now() - new Date(booking.started_at ?? nowIso).getTime()) / (1000 * 60 * 60),
    );

    const { data: charger } = await adminSupabase
      .from('chargers')
      .select('charger_type')
      .eq('id', booking.charger_id)
      .single();

    const nominalKw = charger ? (NOMINAL_KW[charger.charger_type] ?? 7) : 7;
    const kwhDelivered = Math.round(nominalKw * durationHours * 100) / 100;

    await adminSupabase
      .from('bookings')
      .update({ kwh_delivered: kwhDelivered })
      .eq('id', booking.id);

    await queuePayoutForBooking(adminSupabase, booking.id, booking.lender_id);
    await notify(booking.driver_id, 'session_completed', { booking_id: booking.id });
    await notify(booking.lender_id, 'session_completed', { booking_id: booking.id });
  }
}
