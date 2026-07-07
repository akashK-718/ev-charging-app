import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/notifications/push';
import { queuePayoutForBooking } from '@/lib/bookings/queue-payout';

const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

/**
 * POST /api/bookings/[id]/end — two-step session end.
 *
 * Lender calls while in_progress        → awaiting_end_confirmation + notifies driver.
 * Driver calls while awaiting_end_confirmation → completed + payout queued.
 *
 * The driver→completed transition uses an atomic WHERE status = 'awaiting_end_confirmation'
 * guard so payout fires exactly once even if the auto-complete sweep runs concurrently.
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
    .select('id, charger_id, driver_id, lender_id, status, started_at')
    .eq('id', params.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.driver_id !== user.id && booking.lender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Step 1: lender initiates end ──────────────────────────────────────────
  if (booking.status === 'in_progress') {
    if (booking.lender_id !== user.id) {
      return NextResponse.json({ error: 'Only the lender can initiate session end' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await adminSupabase
      .from('bookings')
      .update({ status: 'awaiting_end_confirmation', end_initiated_at: nowIso })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to initiate session end' }, { status: 500 });
    }

    const lenderName = (user.user_metadata?.name as string | undefined) ?? 'Your host';
    void sendPushNotification({
      userId: booking.driver_id,
      title: 'Confirm session end',
      body: `${lenderName} wants to end the session — tap to confirm`,
      url: `/bookings/${params.id}`,
    });

    return NextResponse.json({ ok: true, status: 'awaiting_end_confirmation' });
  }

  // ── Step 2: driver confirms end ───────────────────────────────────────────
  if (booking.status === 'awaiting_end_confirmation') {
    if (booking.driver_id !== user.id) {
      return NextResponse.json({ error: 'Only the driver can confirm session end' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const startedAt = booking.started_at ?? nowIso;
    const durationHours = Math.max(
      0,
      (new Date(nowIso).getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60),
    );

    const { data: charger } = await adminSupabase
      .from('chargers')
      .select('charger_type, title')
      .eq('id', booking.charger_id)
      .single();

    const nominalKw = charger ? (NOMINAL_KW[charger.charger_type] ?? 7) : 7;
    const kwhDelivered = Math.round(nominalKw * durationHours * 100) / 100;

    // Atomic guard: only completes if still in awaiting_end_confirmation.
    // Prevents double-payout if the auto-complete sweep fires concurrently.
    const { data: updated } = await adminSupabase
      .from('bookings')
      .update({
        status: 'completed',
        ended_at: nowIso,
        actual_end: nowIso,
        kwh_delivered: kwhDelivered,
      })
      .eq('id', params.id)
      .eq('status', 'awaiting_end_confirmation')
      .select('id')
      .maybeSingle();

    if (!updated) {
      return NextResponse.json({ error: 'Session state has changed' }, { status: 409 });
    }

    await queuePayoutForBooking(adminSupabase, params.id, booking.lender_id);
    const chargerName = (charger as { title?: string } | null)?.title ?? 'your charger';
    const driverName = (user.user_metadata?.name as string | undefined) ?? 'Your driver';
    void Promise.all([
      sendPushNotification({
        userId: booking.driver_id,
        title: 'Session complete',
        body: `Your session at ${chargerName} is complete`,
        url: `/bookings/${params.id}`,
      }),
      sendPushNotification({
        userId: booking.lender_id,
        title: 'Session complete',
        body: `${driverName}'s session at ${chargerName} is complete — payout in 24h`,
        url: `/lender/bookings/${params.id}`,
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: `Booking is ${booking.status} — cannot end from this state` },
    { status: 409 },
  );
}
