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

/**
 * GET /api/bookings — the current driver's own bookings.
 * Query: ?filter=active|past|cancelled|all (default: all)
 *
 * Booking creation lives in /api/payments/create-order + /api/payments/verify
 * (a booking only exists once payment is captured and verified).
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  await runAutoRejectSweep(adminSupabase);

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get('filter') ?? 'all') as FilterTab;

  let query = adminSupabase
    .from('bookings')
    .select('id, charger_id, lender_id, scheduled_start, scheduled_end, status, confirmation_code, created_at')
    .eq('driver_id', user.id);

  const statuses = statusesForFilter(filter);
  if (statuses) query = query.in('status', statuses);

  const { data: bookings, error: bookingsError } = await query.order('created_at', { ascending: false });
  if (bookingsError) {
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }

  const raw = bookings ?? [];
  const chargerIds = [...new Set(raw.map(b => b.charger_id))];

  const { data: chargers } = chargerIds.length > 0
    ? await adminSupabase.from('chargers').select('id, title, address').in('id', chargerIds)
    : { data: [] };

  const chargerMap = new Map((chargers ?? []).map(c => [c.id, c]));

  const enriched = raw.map(b => ({
    ...b,
    charger: chargerMap.get(b.charger_id) ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
