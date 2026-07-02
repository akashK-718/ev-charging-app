import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { runAutoRejectSweep } from '@/lib/bookings/auto-reject';
import { ACTIVE_BOOKING_STATUSES, PAST_BOOKING_STATUSES, DECLINED_BOOKING_STATUSES, type BookingStatus } from '@/lib/constants';

type FilterTab = 'active' | 'past' | 'cancelled' | 'all';

function statusesForFilter(filter: FilterTab): BookingStatus[] | null {
  if (filter === 'active') return ACTIVE_BOOKING_STATUSES;
  if (filter === 'past') return PAST_BOOKING_STATUSES;
  if (filter === 'cancelled') return DECLINED_BOOKING_STATUSES;
  return null; // 'all'
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  await runAutoRejectSweep(adminSupabase);

  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['lender', 'both'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only lenders can view lender bookings' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get('filter') ?? 'all') as FilterTab;
  const chargerFilter = searchParams.get('charger');

  let query = adminSupabase
    .from('bookings')
    .select('id, charger_id, driver_id, lender_id, scheduled_start, scheduled_end, status, rejection_reason, confirmation_code, created_at, updated_at')
    .eq('lender_id', user.id);

  if (chargerFilter) query = query.eq('charger_id', chargerFilter);

  const statuses = statusesForFilter(filter);
  if (statuses) query = query.in('status', statuses);

  const { data: bookings, error: bookingsError } = await query.order('created_at', { ascending: false });

  if (bookingsError) {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }

  const raw = bookings ?? [];

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

  const isConfirmedOrLater = (status: string) => status !== 'pending';

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

  // Sort: pending (oldest first), then confirmed/in_progress by scheduled_start, then the rest
  const pending = enriched.filter(b => b.status === 'pending').sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const active = enriched.filter(b => b.status === 'confirmed' || b.status === 'in_progress').sort((a, b) =>
    new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );
  const rest = enriched.filter(b => !['pending', 'confirmed', 'in_progress'].includes(b.status)).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return NextResponse.json({ data: [...pending, ...active, ...rest] });
}
