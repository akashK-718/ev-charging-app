import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Plus, ListChecks, BookOpen, IndianRupee, AlertCircle } from 'lucide-react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/bookings/StatusBadge';

type RecentBooking = {
  id: string;
  status: string;
  scheduled_start: string;
  charger_id: string;
  charger_title: string | null;
};

async function getOverviewData(userId: string) {
  const adminSupabase = createAdminClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: allBookings } = await adminSupabase
    .from('bookings')
    .select('id')
    .eq('lender_id', userId);

  const bookingIds = (allBookings ?? []).map((b: { id: string }) => b.id);

  const [chargersRes, pendingRes, upcomingRes, todayPayRes, recentRes] = await Promise.all([
    adminSupabase.from('chargers').select('id, status').eq('lender_id', userId),
    adminSupabase.from('bookings').select('id').eq('lender_id', userId).eq('status', 'pending'),
    adminSupabase
      .from('bookings')
      .select('id')
      .eq('lender_id', userId)
      .in('status', ['confirmed', 'awaiting_driver_confirmation'])
      .gte('scheduled_start', now.toISOString()),
    bookingIds.length > 0
      ? adminSupabase
          .from('payments')
          .select('lender_payout')
          .eq('status', 'paid')
          .gte('created_at', todayStart)
          .in('booking_id', bookingIds)
      : Promise.resolve({ data: [] }),
    adminSupabase
      .from('bookings')
      .select('id, status, scheduled_start, charger_id')
      .eq('lender_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const chargers = (chargersRes.data ?? []) as Array<{ id: string; status: string }>;
  const liveCount = chargers.filter(c => c.status === 'active').length;
  const draftCount = chargers.filter(c => c.status === 'draft').length;
  const pausedCount = chargers.filter(c => c.status === 'paused').length;

  const pendingCount = (pendingRes.data ?? []).length;
  const upcomingCount = (upcomingRes.data ?? []).length;
  const todayEarnings = ((todayPayRes.data ?? []) as Array<{ lender_payout: number }>)
    .reduce((sum, p) => sum + p.lender_payout, 0);

  const recentRaw = (recentRes.data ?? []) as Array<{
    id: string; status: string; scheduled_start: string; charger_id: string;
  }>;

  const chargerIds = [...new Set(recentRaw.map(b => b.charger_id))];
  const { data: chargerData } = chargerIds.length > 0
    ? await adminSupabase.from('chargers').select('id, title').in('id', chargerIds)
    : { data: [] };

  const chargerMap = new Map(
    ((chargerData ?? []) as Array<{ id: string; title: string }>).map(c => [c.id, c.title]),
  );

  const recentBookings: RecentBooking[] = recentRaw.map(b => ({
    ...b,
    charger_title: chargerMap.get(b.charger_id) ?? null,
  }));

  return { liveCount, draftCount, pausedCount, pendingCount, upcomingCount, todayEarnings, recentBookings };
}

export default async function HostingOverviewPage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { liveCount, draftCount, pausedCount, pendingCount, upcomingCount, todayEarnings, recentBookings } =
    await getOverviewData(user.id);

  const hasAttention = pendingCount > 0 || pausedCount > 0;

  return (
    <main className="min-h-screen px-6 py-10 space-y-8">

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-green-600 flex items-center gap-1.5 mb-1">
          <LayoutDashboard className="size-3.5" aria-hidden />
          Hosting
        </p>
        <h1 className="text-2xl font-medium text-ink">Overview</h1>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Today</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-muted">Earned today</p>
            <p className="font-display font-bold text-xl text-ink mt-1">
              ₹{(todayEarnings / 100).toFixed(0)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-muted">Upcoming</p>
            <p className="font-display font-bold text-xl text-ink mt-1">
              {upcomingCount} {upcomingCount === 1 ? 'booking' : 'bookings'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-muted">Live chargers</p>
            <p className="font-display font-bold text-xl text-ink mt-1">{liveCount}</p>
          </div>
          {draftCount > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-muted">Drafts</p>
              <p className="font-display font-bold text-xl text-ink mt-1">{draftCount}</p>
            </div>
          )}
        </div>
      </section>

      {hasAttention && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Attention</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
            {pendingCount > 0 && (
              <Link
                href="/lender/bookings"
                className="flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {pendingCount === 1
                  ? '1 booking awaiting response'
                  : `${pendingCount} bookings awaiting response`}
                <span className="ml-auto text-amber-600">→</span>
              </Link>
            )}
            {pausedCount > 0 && (
              <Link
                href="/lender/chargers"
                className="flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {pausedCount === 1
                  ? '1 charger currently paused'
                  : `${pausedCount} chargers currently paused`}
                <span className="ml-auto text-amber-600">→</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Quick actions</p>
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
          <Link
            href="/lender/chargers/new"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <Plus className="size-4 text-green-600 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-ink">Add charger</span>
          </Link>
          <Link
            href="/lender/chargers"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <ListChecks className="size-4 text-ink/50 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-ink">Manage chargers</span>
          </Link>
          <Link
            href="/lender/bookings"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <BookOpen className="size-4 text-ink/50 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-ink">View bookings</span>
          </Link>
          <Link
            href="/lender/earnings"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <IndianRupee className="size-4 text-ink/50 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-ink">Finance</span>
          </Link>
        </div>
      </section>

      {recentBookings.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Recent activity</p>
          <div className="space-y-2">
            {recentBookings.map(booking => (
              <Link
                key={booking.id}
                href={`/lender/bookings/${booking.id}`}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">
                    {booking.charger_title ?? 'Charger'}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </Link>
            ))}
          </div>
          <Link
            href="/lender/bookings"
            className="block text-center text-xs font-semibold text-volt-deep py-2"
          >
            View all bookings →
          </Link>
        </section>
      )}

    </main>
  );
}
