import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';
import { BOOKING_AUTO_CANCEL_MINUTES } from '@/lib/constants';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';

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
    .select('id, charger_id, driver_id, lender_id, status, scheduled_start, created_at')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'pending') {
    return NextResponse.json(
      { error: `Booking is already ${booking.status}` },
      { status: 409 },
    );
  }

  // Check the 30-minute window (the sweep above should already have caught this,
  // but re-check in case the window expired in the gap between the sweep and now)
  const createdAt = new Date(booking.created_at).getTime();
  const windowMs = BOOKING_AUTO_CANCEL_MINUTES * 60 * 1000;
  if (Date.now() - createdAt > windowMs) {
    return NextResponse.json(
      { error: 'Acceptance window has expired (30 minutes)' },
      { status: 409 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to accept booking' }, { status: 500 });
  }

  await notify(booking.driver_id, 'booking_accepted', { booking_id: params.id });

  // Push: notify driver that booking is confirmed (fire-and-forget)
  void (async () => {
    const { data: charger } = await adminSupabase
      .from('chargers').select('title').eq('id', booking.charger_id).single();
    const chargerName = charger?.title ?? 'your charger';
    const when = new Date(booking.scheduled_start).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    await sendPushNotification({
      userId: booking.driver_id,
      title: 'Booking confirmed!',
      body: `${chargerName} on ${when} is confirmed`,
      url: `/bookings/${params.id}`,
    });
  })();

  return NextResponse.json({ ok: true });
}
