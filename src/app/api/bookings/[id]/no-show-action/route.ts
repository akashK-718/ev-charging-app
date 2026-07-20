import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NOSHOW_MAX_ELAPSED_MINUTES } from '@/lib/constants';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';

/**
 * POST /api/bookings/[id]/no-show-action
 *
 * Called by the host (lender) via the no-show warning push notification action
 * buttons or from the booking detail page.
 *
 * Body: { action: 'keep_waiting' | 'mark_no_show' }
 *
 * keep_waiting: extends the no-show deadline by 30 minutes from now.
 *   - One extension only (keep_waiting_until can only be set once).
 *   - Rejected if the hard cutoff (NOSHOW_MAX_ELAPSED_MINUTES) has already passed.
 *
 * mark_no_show: immediately transitions the booking to no_show.
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

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = body?.action;
  if (action !== 'keep_waiting' && action !== 'mark_no_show') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id, status, started_at, keep_waiting_until')
    .eq('id', params.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.lender_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can take no-show actions' }, { status: 403 });
  }

  if (booking.status !== 'awaiting_driver_confirmation') {
    return NextResponse.json(
      { error: `Booking is ${booking.status} — no-show actions not applicable` },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();

  // ── Mark No-show ─────────────────────────────────────────────────────────────
  if (action === 'mark_no_show') {
    const { error } = await adminSupabase
      .from('bookings')
      .update({
        status:           'no_show',
        no_show_at:       nowIso,
        lifecycle_reason: 'Host marked as no-show',
      })
      .eq('id', params.id)
      .eq('status', 'awaiting_driver_confirmation');

    if (error) {
      return NextResponse.json({ error: 'Failed to mark no-show' }, { status: 500 });
    }

    // TODO: Future penalty policy — driver forfeits payment on no-show.
    // Hook refund/penalty logic here when RazorpayX payouts are wired.
    await notify(booking.driver_id, 'booking_no_show', { booking_id: params.id });
    await notify(booking.lender_id, 'booking_no_show', { booking_id: params.id });
    void sendPushNotification({
      userId: booking.driver_id,
      title: 'Booking closed',
      body: 'Your booking was marked as a no-show by the host.',
      url: `/bookings/${params.id}`,
    });

    return NextResponse.json({ ok: true, status: 'no_show' });
  }

  // ── Keep Waiting ──────────────────────────────────────────────────────────────
  if (booking.keep_waiting_until !== null) {
    return NextResponse.json({ error: 'Keep Waiting can only be used once per booking' }, { status: 409 });
  }

  const startedAt = booking.started_at ?? nowIso;
  const elapsedMinutes = (Date.now() - new Date(startedAt).getTime()) / (60 * 1000);
  if (elapsedMinutes >= NOSHOW_MAX_ELAPSED_MINUTES) {
    return NextResponse.json({ error: 'Maximum wait time already reached' }, { status: 409 });
  }

  const keepWaitingUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error } = await adminSupabase
    .from('bookings')
    .update({ keep_waiting_until: keepWaitingUntil })
    .eq('id', params.id)
    .eq('status', 'awaiting_driver_confirmation');

  if (error) {
    return NextResponse.json({ error: 'Failed to extend waiting period' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, keep_waiting_until: keepWaitingUntil });
}
