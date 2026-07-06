import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';
import { runAutoCompleteEndSweep } from '@/lib/bookings/auto-complete-end';

/**
 * GET /api/bookings/[id] — booking detail for the driver who made it.
 */
export async function GET(
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
  await runAutoCompleteEndSweep(adminSupabase);

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, scheduled_start, scheduled_end, actual_start, actual_end, kwh_delivered, status, confirmation_code, confirmed_at, rejected_at, started_at, ended_at, end_initiated_at, no_show_at, cancelled_at, cancellation_reason, rejection_reason, created_at')
    .eq('id', params.id)
    .eq('driver_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const [chargerRes, lenderRes, paymentRes] = await Promise.all([
    adminSupabase.from('chargers').select('id, title, address, photos').eq('id', booking.charger_id).single(),
    adminSupabase.from('users').select('id, name, phone').eq('id', booking.lender_id).single(),
    adminSupabase
      .from('payments')
      .select('booking_id, gross_amount, platform_fee, lender_payout, status, created_at')
      .eq('booking_id', booking.id)
      .maybeSingle(),
  ]);

  const isConfirmedOrLater = booking.status !== 'pending';

  return NextResponse.json({
    data: {
      ...booking,
      charger: chargerRes.data ?? null,
      lender: lenderRes.data
        ? { ...lenderRes.data, phone: isConfirmedOrLater ? lenderRes.data.phone : null }
        : null,
      payment: paymentRes.data ?? null,
    },
  });
}
