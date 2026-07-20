import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';
import { runFlagForReviewSweep } from '@/lib/bookings/flag-for-review';

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
  await runFlagForReviewSweep(adminSupabase);

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, scheduled_start, scheduled_end, actual_start, actual_end, kwh_delivered, status, cancellation_reason, rejection_reason, confirmation_code, confirmed_at, rejected_at, started_at, ended_at, end_initiated_at, no_show_at, created_at, updated_at')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const isConfirmedOrLater = booking.status !== 'pending';

  const [chargerRes, driverRes, paymentRes] = await Promise.all([
    adminSupabase.from('chargers').select('id, title, address').eq('id', booking.charger_id).single(),
    adminSupabase.from('users').select('id, name, phone').eq('id', booking.driver_id).single(),
    adminSupabase.from('payments').select('booking_id, gross_amount, platform_fee, lender_payout, status').eq('booking_id', booking.id).maybeSingle(),
  ]);

  const charger = chargerRes.data;
  const driver = driverRes.data;
  const payment = paymentRes.data;

  return NextResponse.json({
    data: {
      ...booking,
      charger,
      driver: driver
        ? {
            ...driver,
            // Only reveal phone if confirmed or later
            phone: isConfirmedOrLater ? driver.phone : null,
          }
        : null,
      payment,
    },
  });
}
