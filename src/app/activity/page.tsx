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

  type ChargerFields = {
    title?: string;
    photos?: string[];
    latitude?: number;
    longitude?: number;
  };

  type BookingRow = {
    id: string;
    charger_id: string;
    status: string;
    scheduled_start: string;
    scheduled_end: string | null;
    chargers: ChargerFields | null;
    driver_id?: string;
    lender_id?: string;
  };

  const SELECT_BOOKING =
    'id, charger_id, status, scheduled_start, scheduled_end, chargers(title, photos, latitude, longitude)';

  const [driverRes, lenderRes, notifRes] = await Promise.all([
    admin
      .from('bookings')
      .select(`${SELECT_BOOKING}, lender_id`)
      .eq('driver_id', user.id)
      .order('scheduled_start', { ascending: false })
      .limit(50),

    isHosting
      ? admin
          .from('bookings')
          .select(`${SELECT_BOOKING}, driver_id`)
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

  // Batch-fetch counterparty names
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
    for (const u of (userRows ?? []) as { id: string; name: string | null }[]) {
      if (u.id && u.name) nameMap.set(u.id, u.name);
    }
  }

  // Batch-fetch payments (gross paid by driver; lender_payout earned by host)
  const allBookingIds = [
    ...(driverRes.data ?? []).map(b => (b as BookingRow).id),
    ...(lenderRes.data ?? []).map(b => (b as BookingRow).id),
  ];
  const paymentMap = new Map<string, { gross_amount: number; lender_payout: number }>();
  if (allBookingIds.length > 0) {
    const { data: payRows } = await admin
      .from('payments')
      .select('booking_id, gross_amount, lender_payout')
      .in('booking_id', allBookingIds);
    for (const p of (payRows ?? []) as { booking_id: string; gross_amount: number; lender_payout: number }[]) {
      paymentMap.set(p.booking_id, { gross_amount: p.gross_amount, lender_payout: p.lender_payout });
    }
  }

  // Check which completed driver bookings the user has already rated
  const completedDriverIds = (driverRes.data ?? [])
    .filter(b => (b as BookingRow).status === 'completed')
    .map(b => (b as BookingRow).id);
  const ratedBookingIds = new Set<string>();
  if (completedDriverIds.length > 0) {
    const { data: reviewRows } = await admin
      .from('reviews')
      .select('booking_id')
      .eq('reviewer_id', user.id)
      .in('booking_id', completedDriverIds);
    for (const r of (reviewRows ?? []) as { booking_id: string }[]) {
      ratedBookingIds.add(r.booking_id);
    }
  }

  const historyItems: HistoryItem[] = [];

  for (const b of (driverRes.data ?? []) as BookingRow[]) {
    const charger = b.chargers;
    const payment = paymentMap.get(b.id);
    historyItems.push({
      id:                 `charging-${b.id}`,
      kind:               'charging',
      roleInSession:      'driver',
      bookingId:          b.id,
      chargerId:          b.charger_id,
      chargerTitle:       charger?.title ?? 'Charger',
      chargerPhoto:       charger?.photos?.[0] ?? null,
      chargerLat:         charger?.latitude ?? null,
      chargerLng:         charger?.longitude ?? null,
      counterpartyName:   b.lender_id ? (nameMap.get(b.lender_id) ?? null) : null,
      displayAmountPaise: payment?.gross_amount ?? null,
      hasRated:           ratedBookingIds.has(b.id),
      status:             b.status,
      scheduledStart:     b.scheduled_start,
      scheduledEnd:       b.scheduled_end ?? null,
    });
  }

  for (const b of (lenderRes.data ?? []) as BookingRow[]) {
    const charger = b.chargers;
    const payment = paymentMap.get(b.id);
    historyItems.push({
      id:                 `hosting-${b.id}`,
      kind:               'hosting',
      roleInSession:      'host',
      bookingId:          b.id,
      chargerId:          b.charger_id,
      chargerTitle:       charger?.title ?? 'Charger',
      chargerPhoto:       charger?.photos?.[0] ?? null,
      chargerLat:         charger?.latitude ?? null,
      chargerLng:         charger?.longitude ?? null,
      counterpartyName:   b.driver_id ? (nameMap.get(b.driver_id) ?? null) : null,
      displayAmountPaise: payment?.lender_payout ?? null,
      hasRated:           false,
      status:             b.status,
      scheduledStart:     b.scheduled_start,
      scheduledEnd:       b.scheduled_end ?? null,
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
