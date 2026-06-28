import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, scheduled_start, scheduled_end, actual_start, actual_end, kwh_delivered, status, cancellation_reason, confirmation_code, created_at, updated_at')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const b = booking as {
    id: string; charger_id: string; driver_id: string; lender_id: string;
    scheduled_start: string; scheduled_end: string; actual_start: string | null;
    actual_end: string | null; kwh_delivered: number | null; status: string;
    cancellation_reason: string | null; confirmation_code: string;
    created_at: string; updated_at: string;
  };

  const isConfirmedOrLater = ['confirmed', 'active', 'completed', 'cancelled', 'disputed'].includes(b.status);

  const [chargerRes, driverRes, paymentRes] = await Promise.all([
    adminSupabase.from('chargers').select('id, title, address').eq('id', b.charger_id).single(),
    adminSupabase.from('users').select('id, name, phone').eq('id', b.driver_id).single(),
    adminSupabase.from('payments').select('booking_id, gross_amount, platform_fee, lender_payout, status').eq('booking_id', b.id).maybeSingle(),
  ]);

  const charger = chargerRes.data as { id: string; title: string; address: string } | null;
  const driver = driverRes.data as { id: string; name: string | null; phone: string } | null;
  const payment = paymentRes.data as { booking_id: string; gross_amount: number; platform_fee: number; lender_payout: number; status: string } | null;

  return NextResponse.json({
    data: {
      ...b,
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
