import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getRazorpay, getRazorpayKeyId } from '@/lib/razorpay';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';
import { getPlatformMaxBookingDurationHours, computeMaxEndTime } from '@/lib/bookings/availability';
import { isEmergencyLockdown } from '@/lib/edge-config';
import { readKillSwitch } from '@/lib/app-settings';
import { getBookingPrice } from '@/lib/bookings/price';

const MIN_DURATION_MINUTES = 15;

/**
 * POST /api/payments/create-order
 *
 * Step 1 of booking creation: validate the requested slot, price it, and
 * open a Razorpay order. No DB rows are written here — the booking and
 * payment only get persisted once the client-side checkout succeeds and
 * /api/payments/verify confirms the signature.
 */
export async function POST(request: NextRequest) {
  if (await isEmergencyLockdown()) {
    return NextResponse.json({ error: 'Service is temporarily unavailable.' }, { status: 503 });
  }

  const [paymentsEnabled, bookingsEnabled] = await Promise.all([
    readKillSwitch('allow_payments'),
    readKillSwitch('allow_bookings'),
  ]);
  if (!paymentsEnabled) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 });
  }
  if (!bookingsEnabled) {
    return NextResponse.json({ error: 'Bookings are temporarily unavailable.' }, { status: 503 });
  }

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

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const chargerId = b.charger_id;
  const scheduledStart = b.scheduled_start;
  const scheduledEnd = b.scheduled_end;
  const vehicleId = typeof b.vehicle_id === 'string' ? b.vehicle_id : null;
  const constraintType = typeof b.constraint_type === 'string' ? b.constraint_type : null;
  const constraintValue = typeof b.constraint_value === 'number' ? b.constraint_value : null;

  if (typeof chargerId !== 'string' || typeof scheduledStart !== 'string' || typeof scheduledEnd !== 'string') {
    return NextResponse.json({ error: 'charger_id, scheduled_start, scheduled_end are required' }, { status: 400 });
  }
  if (
    (b.vehicle_id != null && !vehicleId) ||
    ((b.constraint_type != null || b.constraint_value != null) &&
      ((constraintType !== 'duration' && constraintType !== 'budget') ||
        constraintValue === null || !Number.isSafeInteger(constraintValue) || constraintValue <= 0))
  ) {
    return NextResponse.json({ error: 'Invalid vehicle or booking constraint' }, { status: 400 });
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
  const maxDurationMinutes = getPlatformMaxBookingDurationHours() * 60;
  if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > maxDurationMinutes) {
    return NextResponse.json(
      { error: `Booking duration must be between ${MIN_DURATION_MINUTES} minutes and ${getPlatformMaxBookingDurationHours()} hours` },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  if (vehicleId) {
    const { data: vehicle, error } = await adminSupabase.from('vehicles')
      .select('id').eq('id', vehicleId).eq('user_id', user.id).maybeSingle();
    if (error || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 400 });
    }
  }
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

  try {
    const window = await computeMaxEndTime(chargerId, start);
    if (end > window.maxEnd) {
      return NextResponse.json({ error: window.reason + '. Choose a different start time or duration.' }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not check availability. Please try again.' }, { status: 503 });
  }

  const { kwh: estimatedKwh, amount: grossAmount } = getBookingPrice(
    charger.charger_type, charger.price_per_kwh, durationMinutes,
  );
  const platformFee = Math.round(grossAmount * (PLATFORM_COMMISSION_PERCENT / 100));
  const lenderPayout = grossAmount - platformFee;

  if (!Number.isSafeInteger(grossAmount) || grossAmount < 100) {
    return NextResponse.json({ error: 'Booking amount is too small to process' }, { status: 400 });
  }
  if (constraintType === 'budget' && constraintValue !== null && grossAmount > constraintValue * 100) {
    return NextResponse.json({ error: 'This slot exceeds your selected budget' }, { status: 400 });
  }

  const quote = {
    charger_id: chargerId,
    driver_id: user.id,
    lender_id: charger.lender_id,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    platform_fee: platformFee,
    vehicle_id: vehicleId,
    constraint_type: constraintType,
    constraint_value: constraintValue,
  };
  let order;
  let keyId: string;
  try {
    keyId = getRazorpayKeyId();
    order = await getRazorpay().orders.create({
      amount: grossAmount,
      currency: 'INR',
      receipt: `booking_${randomUUID().replace(/-/g, '')}`,
      partial_payment: false,
      notes: {
        kirin_booking: '1',
        charger_id: quote.charger_id,
        driver_id: quote.driver_id,
        lender_id: quote.lender_id,
        scheduled_start: quote.scheduled_start,
        scheduled_end: quote.scheduled_end,
        platform_fee: String(quote.platform_fee),
        ...(vehicleId ? { vehicle_id: vehicleId } : {}),
        ...(constraintType && constraintValue
          ? { constraint_type: constraintType, constraint_value: String(constraintValue) }
          : {}),
      },
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
      key_id: keyId,
      charger_id: chargerId,
      lender_id: charger.lender_id,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      gross_amount: grossAmount,
      platform_fee: platformFee,
      lender_payout: lenderPayout,
      estimated_kwh: estimatedKwh,
      vehicle_id: vehicleId,
      constraint_type: constraintType,
      constraint_value: constraintValue,
    },
  });
}
