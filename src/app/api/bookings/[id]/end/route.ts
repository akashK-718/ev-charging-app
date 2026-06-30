import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { queuePayoutForBooking } from '@/lib/bookings/queue-payout';

const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

/**
 * POST /api/bookings/[id]/end — either party can end an in-progress session.
 * Marks the booking completed, records actual session duration as
 * kwh_delivered, and queues the lender's payout.
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

  if (booking.status !== 'in_progress') {
    return NextResponse.json({ error: `Booking is ${booking.status}, not in progress` }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const startedAt = booking.started_at ?? nowIso;
  const durationHours = Math.max(0, (new Date(nowIso).getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60));

  const { data: charger } = await adminSupabase
    .from('chargers')
    .select('charger_type')
    .eq('id', booking.charger_id)
    .single();

  const nominalKw = charger ? (NOMINAL_KW[charger.charger_type] ?? 7) : 7;
  const kwhDelivered = Math.round(nominalKw * durationHours * 100) / 100;

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({
      status: 'completed',
      ended_at: nowIso,
      actual_end: nowIso,
      kwh_delivered: kwhDelivered,
    })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
  }

  await queuePayoutForBooking(adminSupabase, params.id, booking.lender_id);

  await notify(booking.driver_id, 'session_completed', { booking_id: params.id });
  await notify(booking.lender_id, 'session_completed', { booking_id: params.id });

  return NextResponse.json({ ok: true });
}
