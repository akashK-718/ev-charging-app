import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { queuePayoutForBooking } from '@/lib/bookings/queue-payout';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

/**
 * POST /api/admin/review-queue/[id]/resolve
 *
 * Resolves a pending session_review_queue entry.
 * [id] is the session_review_queue row id (not the booking id).
 *
 * Body: { resolution: 'completed' | 'cancelled', admin_notes?: string }
 *
 * completed: marks booking as completed, estimates kWh, queues payout.
 * cancelled: marks booking as cancelled, no payout.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const profile = await createAdminClient()
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!(profile.data as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const resolution = body?.resolution;
  const adminNotes = (body?.admin_notes as string | undefined) ?? null;

  if (resolution !== 'completed' && resolution !== 'cancelled') {
    return NextResponse.json({ error: 'resolution must be "completed" or "cancelled"' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: queueRow, error: queueError } = await adminSupabase
    .from('session_review_queue')
    .select('id, booking_id, status')
    .eq('id', params.id)
    .single();

  if (queueError || !queueRow) {
    return NextResponse.json({ error: 'Review queue entry not found' }, { status: 404 });
  }

  if ((queueRow as { status: string }).status !== 'pending') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 409 });
  }

  const bookingId = (queueRow as { booking_id: string }).booking_id;

  const { data: booking } = await adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, status, started_at')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if ((booking as { status: string }).status !== 'awaiting_end_confirmation') {
    return NextResponse.json(
      { error: `Booking is ${(booking as { status: string }).status} — not in review state` },
      { status: 409 },
    );
  }

  const b = booking as {
    id: string; charger_id: string; driver_id: string; lender_id: string;
    status: string; started_at: string | null;
  };

  if (resolution === 'completed') {
    const startedAt = b.started_at ?? nowIso;
    const durationHours = Math.max(
      0,
      (new Date(nowIso).getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60),
    );

    const { data: charger } = await adminSupabase
      .from('chargers')
      .select('charger_type')
      .eq('id', b.charger_id)
      .single();

    const nominalKw = charger ? (NOMINAL_KW[(charger as { charger_type: string }).charger_type] ?? 7) : 7;
    const kwhDelivered = Math.round(nominalKw * durationHours * 100) / 100;

    await adminSupabase
      .from('bookings')
      .update({
        status:        'completed',
        ended_at:      nowIso,
        actual_end:    nowIso,
        kwh_delivered: kwhDelivered,
        lifecycle_reason: 'Completed by admin via review queue',
      })
      .eq('id', bookingId)
      .eq('status', 'awaiting_end_confirmation');

    // TODO: Future: when OCPP telemetry is available, use metered kWh instead of estimate.
    await queuePayoutForBooking(adminSupabase, bookingId, b.lender_id);
    await notify(b.driver_id, 'session_completed', { booking_id: bookingId });
    await notify(b.lender_id, 'session_completed', { booking_id: bookingId });
    void Promise.all([
      sendPushNotification({
        userId: b.driver_id,
        title: 'Session complete',
        body: 'Your charging session has been marked as complete.',
        url: `/bookings/${bookingId}`,
      }),
      sendPushNotification({
        userId: b.lender_id,
        title: 'Session complete',
        body: 'Session marked as complete — payout in 24h.',
        url: `/lender/bookings/${bookingId}`,
      }),
    ]);
  } else {
    await adminSupabase
      .from('bookings')
      .update({
        status:           'cancelled',
        cancelled_at:     nowIso,
        lifecycle_reason: 'Cancelled by admin via review queue',
      })
      .eq('id', bookingId)
      .eq('status', 'awaiting_end_confirmation');

    // TODO: Future: determine refund/partial-payment policy for admin-cancelled sessions.
    await notify(b.driver_id, 'booking_cancelled', { booking_id: bookingId });
    await notify(b.lender_id, 'booking_cancelled', { booking_id: bookingId });
  }

  await adminSupabase
    .from('session_review_queue')
    .update({
      status:      'resolved',
      resolved_at: nowIso,
      resolved_by: user.id,
      resolution,
      admin_notes: adminNotes,
    })
    .eq('id', params.id);

  return NextResponse.json({ ok: true, resolution });
}
