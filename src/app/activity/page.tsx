import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ActivityView, type HistoryItem, type UpdateItem } from './ActivityView';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

export default async function ActivityPage() {
  const supabase = createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role      = (user.user_metadata?.role as string | undefined) ?? '';
  const isHosting = role === 'lender' || role === 'both';

  type BookingRow = {
    id: string;
    status: string;
    scheduled_start: string;
    scheduled_end: string | null;
    chargers: { title?: string } | null;
    driver_id?: string;
    lender_id?: string;
  };

  const [driverRes, lenderRes, notifRes] = await Promise.all([
    admin
      .from('bookings')
      .select('id, status, scheduled_start, scheduled_end, chargers(title), lender_id')
      .eq('driver_id', user.id)
      .order('scheduled_start', { ascending: false })
      .limit(50),

    isHosting
      ? admin
          .from('bookings')
          .select('id, status, scheduled_start, scheduled_end, chargers(title), driver_id')
          .eq('lender_id', user.id)
          .order('scheduled_start', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as BookingRow[] }),

    admin
      .from('notifications')
      .select('id, type, data, created_at, read')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Batch-fetch counterparty names (host name for driver bookings, driver name for lender bookings)
  const counterpartyIds = new Set<string>();
  for (const b of (driverRes.data ?? []) as BookingRow[]) {
    if (b.lender_id) counterpartyIds.add(b.lender_id);
  }
  for (const b of (lenderRes.data ?? []) as BookingRow[]) {
    if (b.driver_id) counterpartyIds.add(b.driver_id);
  }

  const nameMap = new Map<string, string>();
  if (counterpartyIds.size > 0) {
    const { data: userRows } = await admin
      .from('users')
      .select('id, name')
      .in('id', [...counterpartyIds]);
    for (const u of userRows ?? []) {
      if (u.id && u.name) nameMap.set(u.id, u.name as string);
    }
  }

  const historyItems: HistoryItem[] = [];

  for (const b of ((driverRes.data ?? []) as BookingRow[])) {
    historyItems.push({
      id:               `charging-${b.id}`,
      kind:             'charging',
      bookingId:        b.id,
      chargerTitle:     (b.chargers as { title?: string } | null)?.title ?? 'Charger',
      counterpartyName: b.lender_id ? (nameMap.get(b.lender_id) ?? null) : null,
      status:           b.status,
      scheduledStart:   b.scheduled_start,
      scheduledEnd:     b.scheduled_end ?? null,
    });
  }

  for (const b of ((lenderRes.data ?? []) as BookingRow[])) {
    historyItems.push({
      id:               `hosting-${b.id}`,
      kind:             'hosting',
      bookingId:        b.id,
      chargerTitle:     (b.chargers as { title?: string } | null)?.title ?? 'Charger',
      counterpartyName: b.driver_id ? (nameMap.get(b.driver_id) ?? null) : null,
      status:           b.status,
      scheduledStart:   b.scheduled_start,
      scheduledEnd:     b.scheduled_end ?? null,
    });
  }

  historyItems.sort(
    (a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime(),
  );

  const updates: UpdateItem[] = (notifRes.data ?? []).map(n => ({
    id:        n.id,
    type:      n.type,
    data:      (n.data as Record<string, unknown>) ?? {},
    createdAt: n.created_at,
    read:      (n.read as boolean) ?? false,
  }));

  const initialUnreadCount = updates.filter(u => !u.read).length;

  return (
    <>
      <ActivityView
        historyItems={historyItems}
        updates={updates}
        initialUnreadCount={initialUnreadCount}
      />
      <PullToRefresh />
    </>
  );
}
