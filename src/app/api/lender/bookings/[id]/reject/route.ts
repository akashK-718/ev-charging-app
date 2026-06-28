import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as { reason?: string };
  if (!b.reason || typeof b.reason !== 'string' || b.reason.trim().length === 0) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, lender_id, status')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const bk = booking as { id: string; driver_id: string; lender_id: string; status: string };

  if (bk.status !== 'pending') {
    return NextResponse.json(
      { error: `Booking is already ${bk.status}` },
      { status: 409 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: b.reason.trim() })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to reject booking' }, { status: 500 });
  }

  // Mark payment as refunded (stub — real Razorpay refund in Module 5)
  await adminSupabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('booking_id', params.id);

  await notify(bk.driver_id, 'booking_rejected', {
    booking_id: params.id,
    reason: b.reason.trim(),
  });

  return NextResponse.json({ ok: true });
}
