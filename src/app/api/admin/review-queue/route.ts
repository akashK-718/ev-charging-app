import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/review-queue
 *
 * Returns all session_review_queue entries with denormalised booking details,
 * ordered by flagged_at descending (most recent first).
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: profile } = await adminSupabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: rows, error } = await adminSupabase
    .from('session_review_queue')
    .select('id, booking_id, flagged_at, status, resolution, admin_notes')
    .order('flagged_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Failed to load queue' }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const bookingIds = (rows as Array<{ booking_id: string }>).map(r => r.booking_id);

  const [bookingsRes, usersRes] = await Promise.all([
    adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start, scheduled_end, started_at, end_initiated_at, driver_id, lender_id, charger_id')
      .in('id', bookingIds),
    adminSupabase
      .from('chargers')
      .select('id, title')
      .in('id', (await adminSupabase
        .from('bookings')
        .select('charger_id')
        .in('id', bookingIds)
      ).data?.map((b: { charger_id: string }) => b.charger_id) ?? []),
  ]);

  const bookingMap = new Map(
    (bookingsRes.data ?? []).map((b: Record<string, unknown>) => [b.id as string, b])
  );
  const chargerMap = new Map(
    (usersRes.data ?? []).map((c: { id: string; title: string }) => [c.id, c.title])
  );

  // Collect user IDs for name lookup
  const userIds = new Set<string>();
  for (const b of (bookingsRes.data ?? []) as Array<{ driver_id: string; lender_id: string }>) {
    if (b.driver_id) userIds.add(b.driver_id);
    if (b.lender_id) userIds.add(b.lender_id);
  }

  const nameMap = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: userRows } = await adminSupabase
      .from('users')
      .select('id, name')
      .in('id', [...userIds]);
    for (const u of (userRows ?? []) as { id: string; name: string | null }[]) {
      if (u.name) nameMap.set(u.id, u.name);
    }
  }

  const data = (rows as Array<{
    id: string; booking_id: string; flagged_at: string;
    status: string; resolution: string | null; admin_notes: string | null;
  }>).map(row => {
    const b = bookingMap.get(row.booking_id) as {
      id: string; status: string; scheduled_start: string; scheduled_end: string | null;
      started_at: string | null; end_initiated_at: string | null;
      driver_id: string; lender_id: string; charger_id: string;
    } | undefined;

    return {
      ...row,
      booking: b ? {
        id:               b.id,
        status:           b.status,
        scheduled_start:  b.scheduled_start,
        scheduled_end:    b.scheduled_end,
        started_at:       b.started_at,
        end_initiated_at: b.end_initiated_at,
        driver_name:      nameMap.get(b.driver_id) ?? null,
        lender_name:      nameMap.get(b.lender_id) ?? null,
        charger_title:    chargerMap.get(b.charger_id) ?? null,
      } : null,
    };
  });

  return NextResponse.json({ data });
}
