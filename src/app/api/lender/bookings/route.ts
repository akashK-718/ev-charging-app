import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_STATUSES = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'disputed'] as const;
type BookingStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['lender', 'both'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only lenders can view lender bookings' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') ?? 'all';

  let query = adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, scheduled_start, scheduled_end, status, cancellation_reason, confirmation_code, created_at, updated_at')
    .eq('lender_id', user.id);

  if (statusParam !== 'all' && VALID_STATUSES.includes(statusParam as BookingStatus)) {
    query = query.eq('status', statusParam as BookingStatus);
  }

  const { data: bookings, error: bookingsError } = await query.order('created_at', { ascending: false });

  if (bookingsError) {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }

  const raw = (bookings ?? []) as Array<{
    id: string; charger_id: string; driver_id: string; lender_id: string;
    scheduled_start: string; scheduled_end: string; status: string;
    cancellation_reason: string | null; confirmation_code: string;
    created_at: string; updated_at: string;
  }>;

  // Enrich with charger info
  const chargerIds = [...new Set(raw.map(b => b.charger_id))];
  const driverIds = [...new Set(raw.map(b => b.driver_id))];

  const [chargersRes, driversRes, paymentsRes] = await Promise.all([
    chargerIds.length > 0
      ? adminSupabase.from('chargers').select('id, title').in('id', chargerIds)
      : Promise.resolve({ data: [] }),
    driverIds.length > 0
      ? adminSupabase.from('users').select('id, name').in('id', driverIds)
      : Promise.resolve({ data: [] }),
    raw.length > 0
      ? adminSupabase.from('payments').select('booking_id, gross_amount, platform_fee, lender_payout, status').in('booking_id', raw.map(b => b.id))
      : Promise.resolve({ data: [] }),
  ]);

  const chargerMap = new Map((chargersRes.data ?? []).map(c => [c.id, c] as [string, { id: string; title: string }]));
  const driverMap = new Map((driversRes.data ?? []).map(u => [u.id, u] as [string, { id: string; name: string | null }]));
  const paymentMap = new Map(
    ((paymentsRes.data ?? []) as Array<{ booking_id: string; gross_amount: number; platform_fee: number; lender_payout: number; status: string }>)
      .map(p => [p.booking_id, p]),
  );

  const isConfirmedOrLater = (status: string) =>
    ['confirmed', 'active', 'completed', 'cancelled', 'disputed'].includes(status);

  const enriched = raw.map(b => {
    const driver = driverMap.get(b.driver_id);
    const driverName = driver?.name ?? null;
    // Mask driver name until confirmed
    let displayDriver: string | null = null;
    if (driverName) {
      if (isConfirmedOrLater(b.status)) {
        displayDriver = driverName;
      } else {
        const parts = driverName.split(' ');
        displayDriver = parts.length >= 2
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : `${parts[0][0]}.`;
      }
    }

    return {
      ...b,
      charger_title: chargerMap.get(b.charger_id)?.title ?? null,
      driver_display: displayDriver,
      payment: paymentMap.get(b.id) ?? null,
    };
  });

  // Sort: pending (oldest first), then confirmed by scheduled_start, then the rest
  const pending = enriched.filter(b => b.status === 'pending').sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const confirmed = enriched.filter(b => b.status === 'confirmed').sort((a, b) =>
    new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );
  const rest = enriched.filter(b => !['pending', 'confirmed'].includes(b.status)).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return NextResponse.json({ data: [...pending, ...confirmed, ...rest] });
}
