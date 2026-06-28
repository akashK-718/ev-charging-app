import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { BOOKING_AUTO_CANCEL_MINUTES } from '@/lib/constants';

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
    .select('id, driver_id, lender_id, status, created_at')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const b = booking as { id: string; driver_id: string; lender_id: string; status: string; created_at: string };

  if (b.status !== 'pending') {
    return NextResponse.json(
      { error: `Booking is already ${b.status}` },
      { status: 409 },
    );
  }

  // Check the 30-minute window
  const createdAt = new Date(b.created_at).getTime();
  const windowMs = BOOKING_AUTO_CANCEL_MINUTES * 60 * 1000;
  if (Date.now() - createdAt > windowMs) {
    return NextResponse.json(
      { error: 'Acceptance window has expired (30 minutes)' },
      { status: 409 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to accept booking' }, { status: 500 });
  }

  await notify(b.driver_id, 'booking_accepted', { booking_id: params.id });

  return NextResponse.json({ ok: true });
}
