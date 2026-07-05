import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { SESSION_GRACE_MINUTES } from '@/lib/constants';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';

/**
 * POST /api/bookings/[id]/start — two-step session initiation.
 *
 * Step 1 (lender): confirmed → awaiting_driver_confirmation, notifies driver.
 * Step 2 (driver): awaiting_driver_confirmation → in_progress, sets started_at, notifies lender.
 *
 * Driver calling while status is 'confirmed' gets 403 — driver cannot initiate.
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
  await runAutoRejectSweep(adminSupabase);

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id, status, scheduled_start, scheduled_end')
    .eq('id', params.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const isLender = user.id === booking.lender_id;
  const isDriver = user.id === booking.driver_id;

  if (!isLender && !isDriver) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const graceMs = SESSION_GRACE_MINUTES * 60 * 1000;
  const windowStart = new Date(booking.scheduled_start).getTime() - graceMs;
  const windowEnd = new Date(booking.scheduled_end).getTime() + graceMs;
  const now = Date.now();

  if (now < windowStart || now > windowEnd) {
    return NextResponse.json(
      { error: `Session can only be started within ${SESSION_GRACE_MINUTES} minutes of the booked time slot` },
      { status: 409 },
    );
  }

  // Step 1: lender initiates
  if (isLender) {
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: `Booking is ${booking.status}, not confirmed` }, { status: 409 });
    }
    const { error: updateError } = await adminSupabase
      .from('bookings')
      .update({ status: 'awaiting_driver_confirmation' })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to initiate session' }, { status: 500 });
    }
    await notify(booking.driver_id, 'session_initiation_requested', { booking_id: params.id });
    return NextResponse.json({ ok: true });
  }

  // Step 2: driver confirms
  if (booking.status === 'confirmed') {
    return NextResponse.json(
      { error: 'Session must be initiated by the lender first' },
      { status: 403 },
    );
  }
  if (booking.status !== 'awaiting_driver_confirmation') {
    return NextResponse.json(
      { error: `Booking is ${booking.status}, cannot confirm start` },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'in_progress', started_at: nowIso, actual_start: nowIso })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
  await notify(booking.lender_id, 'session_started', { booking_id: params.id });
  return NextResponse.json({ ok: true });
}
