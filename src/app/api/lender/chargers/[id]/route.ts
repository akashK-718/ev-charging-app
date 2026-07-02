import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const adminSupabase = createAdminClient();

  const { data: charger, error: chargerError } = await adminSupabase
    .from('chargers')
    .select('id, lender_id, title, charger_type, connector_types, price_per_kwh, address, photos, instructions, status, avg_rating, total_sessions, created_at')
    .eq('id', params.id)
    .is('deleted_at', null)
    .single();

  if (chargerError || !charger) return NextResponse.json({ error: 'Charger not found' }, { status: 404 });

  const c = charger as { id: string; lender_id: string; [key: string]: unknown };
  if (c.lender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();
  const daysToMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const [slotsRes, allBookingsRes, upcomingRes, recentRes] = await Promise.all([
    adminSupabase
      .from('availability_slots')
      .select('id, day_of_week, start_time, end_time, is_active')
      .eq('charger_id', params.id)
      .eq('is_active', true)
      .order('start_time'),

    adminSupabase
      .from('bookings')
      .select('id, status, ended_at')
      .eq('charger_id', params.id),

    adminSupabase
      .from('bookings')
      .select('id, driver_id, scheduled_start, scheduled_end, status')
      .eq('charger_id', params.id)
      .eq('status', 'confirmed')
      .gte('scheduled_start', now.toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(3),

    adminSupabase
      .from('bookings')
      .select('id, driver_id, scheduled_start, scheduled_end, ended_at')
      .eq('charger_id', params.id)
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(5),
  ]);

  const allBookings = (allBookingsRes.data ?? []) as Array<{ id: string; status: string; ended_at: string | null }>;
  const totalBookings = allBookings.filter(b => !['auto_rejected', 'rejected', 'cancelled'].includes(b.status)).length;
  const activeCount  = allBookings.filter(b => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length;

  const completedIds = allBookings.filter(b => b.status === 'completed').map(b => b.id);
  const weekCompletedIds = allBookings
    .filter(b => b.status === 'completed' && b.ended_at && new Date(b.ended_at) >= weekStart)
    .map(b => b.id);
  const weekBookings = weekCompletedIds.length;

  let totalEarningsPaise = 0;
  let weekEarningsPaise = 0;
  if (completedIds.length > 0) {
    const { data: payments } = await adminSupabase
      .from('payments')
      .select('booking_id, lender_payout')
      .in('booking_id', completedIds);

    const payMap = new Map((payments ?? []).map(p => [p.booking_id, p.lender_payout as number]));
    totalEarningsPaise = completedIds.reduce((s, id) => s + (payMap.get(id) ?? 0), 0);
    weekEarningsPaise  = weekCompletedIds.reduce((s, id) => s + (payMap.get(id) ?? 0), 0);
  }

  // Enrich bookings with driver names
  const upcomingRaw = (upcomingRes.data ?? []) as Array<{ id: string; driver_id: string; scheduled_start: string; scheduled_end: string; status: string }>;
  const recentRaw   = (recentRes.data   ?? []) as Array<{ id: string; driver_id: string; scheduled_start: string; scheduled_end: string; ended_at: string | null }>;
  const driverIds   = [...new Set([...upcomingRaw, ...recentRaw].map(b => b.driver_id))];

  const driverMap = new Map<string, string | null>();
  if (driverIds.length > 0) {
    const { data: drivers } = await adminSupabase.from('users').select('id, name').in('id', driverIds);
    (drivers ?? []).forEach((d: { id: string; name: string | null }) => driverMap.set(d.id, d.name));
  }

  const recentIds = recentRaw.map(b => b.id);
  const recentPayMap = new Map<string, number>();
  if (recentIds.length > 0) {
    const { data: rp } = await adminSupabase.from('payments').select('booking_id, lender_payout').in('booking_id', recentIds);
    (rp ?? []).forEach((p: { booking_id: string; lender_payout: number }) => recentPayMap.set(p.booking_id, p.lender_payout));
  }

  return NextResponse.json({
    charger,
    slots: slotsRes.data ?? [],
    stats: { totalBookings, totalEarningsPaise, weekBookings, weekEarningsPaise },
    upcoming: upcomingRaw.map(b => ({ ...b, driver_name: driverMap.get(b.driver_id) ?? null })),
    recent:   recentRaw.map(b => ({ ...b, driver_name: driverMap.get(b.driver_id) ?? null, lender_payout: recentPayMap.get(b.id) ?? 0 })),
    activeCount,
  });
}
