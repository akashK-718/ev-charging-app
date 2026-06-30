import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay } from '@/lib/razorpay';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';

// Rough nominal output per charger type, used only to estimate kWh for pricing
// a slot upfront. Actual kwh_delivered is recorded at session end.
const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 12 * 60;

/**
 * POST /api/payments/create-order
 *
 * Step 1 of booking creation: validate the requested slot, price it, and
 * open a Razorpay order. No DB rows are written here — the booking and
 * payment only get persisted once the client-side checkout succeeds and
 * /api/payments/verify confirms the signature.
 */
export async function POST(request: NextRequest) {
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

  const b = body as Record<string, unknown>;
  const chargerId = b.charger_id;
  const scheduledStart = b.scheduled_start;
  const scheduledEnd = b.scheduled_end;

  if (typeof chargerId !== 'string' || typeof scheduledStart !== 'string' || typeof scheduledEnd !== 'string') {
    return NextResponse.json({ error: 'charger_id, scheduled_start, scheduled_end are required' }, { status: 400 });
  }

  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid scheduled_start/scheduled_end' }, { status: 400 });
  }
  if (start.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'scheduled_start must be in the future' }, { status: 400 });
  }
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    return NextResponse.json(
      { error: `Booking duration must be between ${MIN_DURATION_MINUTES} minutes and ${MAX_DURATION_MINUTES / 60} hours` },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: charger } = await adminSupabase
    .from('chargers')
    .select('id, lender_id, status, price_per_kwh, charger_type, deleted_at')
    .eq('id', chargerId)
    .single();

  if (!charger || charger.deleted_at) {
    return NextResponse.json({ error: 'Charger not found' }, { status: 404 });
  }
  if (charger.status !== 'active') {
    return NextResponse.json({ error: 'This charger is not currently available for booking' }, { status: 409 });
  }
  if (charger.lender_id === user.id) {
    return NextResponse.json({ error: 'You cannot book your own charger' }, { status: 400 });
  }

  const nominalKw = NOMINAL_KW[charger.charger_type] ?? 7;
  const estimatedKwh = Math.round(nominalKw * (durationMinutes / 60) * 100) / 100;
  const grossAmount = Math.round(charger.price_per_kwh * estimatedKwh * 100); // paise
  const platformFee = Math.round(grossAmount * (PLATFORM_COMMISSION_PERCENT / 100));
  const lenderPayout = grossAmount - platformFee;

  if (grossAmount < 100) {
    return NextResponse.json({ error: 'Booking amount is too small to process' }, { status: 400 });
  }

  let order;
  try {
    order = await getRazorpay().orders.create({
      amount: grossAmount,
      currency: 'INR',
      receipt: `booking_${Date.now()}`,
      notes: { charger_id: chargerId, driver_id: user.id },
    });
  } catch (err) {
    console.error('[payments/create-order] Razorpay order creation failed:', err);
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({
    data: {
      razorpay_order_id: order.id,
      amount: grossAmount,
      currency: 'INR',
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      charger_id: chargerId,
      lender_id: charger.lender_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      gross_amount: grossAmount,
      platform_fee: platformFee,
      lender_payout: lenderPayout,
      estimated_kwh: estimatedKwh,
    },
  });
}
