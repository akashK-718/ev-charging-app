import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/notifications/push';
import { SESSION_GRACE_MINUTES, PROXIMITY_CHECK_DEFAULTS } from '@/lib/constants';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';
import { runAutoNoShowSweep } from '@/lib/bookings/auto-no-show';
import { haversineKm } from '@/lib/haversine';

/**
 * POST /api/bookings/[id]/start — two-step session initiation.
 *
 * Step 1 (lender): confirmed → awaiting_driver_confirmation, notifies driver.
 * Step 2 (driver): awaiting_driver_confirmation → in_progress, sets started_at, notifies lender.
 *   Proximity check runs on step 2 if proximity_check_enabled = true in app_settings.
 *   Any settings fetch failure defaults to enabled=true, radius=0.5km (never fail open).
 *   Missing GPS coords are allowed with a warning — GPS unavailability must never hard-block.
 *
 * Driver calling while status is 'confirmed' gets 403 — driver cannot initiate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  await Promise.all([runAutoRejectSweep(adminSupabase), runAutoNoShowSweep(adminSupabase)]);

  const { data: booking, error: bookingError } = await adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, status, scheduled_start, scheduled_end')
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

  // Step 1: lender initiates — no proximity check needed
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
    void notify(booking.driver_id, 'session_initiation_requested', { booking_id: params.id });
    const lenderName = (user.user_metadata?.name as string | undefined) ?? 'Your host';
    void (async () => {
      const { data: charger } = await adminSupabase
        .from('chargers').select('title').eq('id', booking.charger_id).single();
      const chargerName = charger?.title ?? 'your charger';
      await sendPushNotification({
        userId: booking.driver_id,
        title: 'Start your charging session',
        body: `${lenderName} is ready — confirm to start charging at ${chargerName}`,
        url: `/bookings/${params.id}`,
      });
    })();
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

  // Parse optional driver coords from body
  let driverLat: number | undefined;
  let driverLng: number | undefined;
  try {
    const body = await request.json() as { latitude?: unknown; longitude?: unknown };
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      driverLat = body.latitude;
      driverLng = body.longitude;
    }
  } catch {
    // body absent or non-JSON — treat as no coords provided
  }

  // Fetch proximity settings + charger in parallel (charger always fetched for name + coords)
  const b = booking as { charger_id: string };
  const [settingsRes, chargerRes] = await Promise.all([
    adminSupabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['proximity_check_enabled', 'proximity_check_radius_km']),
    adminSupabase.from('chargers').select('title, latitude, longitude').eq('id', b.charger_id).single(),
  ]);

  // Parse settings — fall back to defaults on any failure (never fail open)
  let proximityEnabled: boolean = PROXIMITY_CHECK_DEFAULTS.enabled;
  let proximityRadiusKm: number = PROXIMITY_CHECK_DEFAULTS.radius_km;
  for (const row of settingsRes.data ?? []) {
    if (row.key === 'proximity_check_enabled') proximityEnabled = Boolean(row.value);
    if (row.key === 'proximity_check_radius_km') proximityRadiusKm = Number(row.value);
  }

  if (!proximityEnabled) {
    console.log('[proximity_check] disabled via admin flag');
  } else if (driverLat !== undefined && driverLng !== undefined) {
    const charger = chargerRes.data as { latitude: number; longitude: number } | null;
    if (charger) {
      const distanceKm = haversineKm(
        { lat: driverLat, lng: driverLng },
        { lat: charger.latitude, lng: charger.longitude },
      );
      if (distanceKm > proximityRadiusKm) {
        return NextResponse.json(
          {
            error: `You must be within ${proximityRadiusKm}km of the charger to start a session`,
            distance_m: Math.round(distanceKm * 1000),
            radius_km: proximityRadiusKm,
          },
          { status: 409 },
        );
      }
    }
  } else {
    console.warn('[proximity_check] no coords provided — GPS unavailable, allowing start');
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'in_progress', started_at: nowIso, actual_start: nowIso })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
  }
  void notify(booking.lender_id, 'session_started', { booking_id: params.id });
  const driverName = (user.user_metadata?.name as string | undefined) ?? 'Your driver';
  const chargerName = (chargerRes.data as { title?: string } | null)?.title ?? 'your charger';
  void sendPushNotification({
    userId: booking.lender_id,
    title: 'Session started',
    body: `${driverName} confirmed — session at ${chargerName} is now active`,
    url: `/lender/bookings/${params.id}`,
  });
  return NextResponse.json({ ok: true });
}
