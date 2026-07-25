import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Plus, ListChecks, BookOpen, IndianRupee, AlertCircle, Clock, Zap, FileText, ChevronRight } from 'lucide-react';
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
  if (error || !user) redirect('/auth');

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
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center mb-3">
              <IndianRupee className="size-4 text-green" aria-hidden />
            </div>
            <p className="font-display font-bold text-xl text-ink">{'₹'}{(todayEarnings / 100).toFixed(0)}</p>
            <p className="text-xs text-muted mt-0.5">Earned today</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="size-9 rounded-xl bg-blue-50 grid place-items-center mb-3">
              <Clock className="size-4 text-blue-600" aria-hidden />
            </div>
            <p className="font-display font-bold text-xl text-ink">
              {upcomingCount}
            </p>
            <p className="text-xs text-muted mt-0.5">Upcoming {upcomingCount === 1 ? 'booking' : 'bookings'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center mb-3">
              <Zap className="size-4 text-green" aria-hidden />
            </div>
            <p className="font-display font-bold text-xl text-ink">{liveCount}</p>
            <p className="text-xs text-muted mt-0.5">Live chargers</p>
          </div>
          {draftCount > 0 && (
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="size-9 rounded-xl bg-gray-100 grid place-items-center mb-3">
                <FileText className="size-4 text-muted" aria-hidden />
              </div>
              <p className="font-display font-bold text-xl text-ink">{draftCount}</p>
              <p className="text-xs text-muted mt-0.5">Drafts</p>
            </div>
          )}
        </div>
      </section>

      {hasAttention && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Attention</p>
          <div className="bg-white border-2 border-amber-300/70 rounded-2xl overflow-hidden divide-y divide-amber-100">
            {pendingCount > 0 && (
              <Link
                href="/lender/bookings"
                className="tap-light flex items-center gap-3 p-4"
              >
                <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
                  <AlertCircle className="size-4 text-amber-600" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {pendingCount === 1 ? '1 booking awaiting response' : `${pendingCount} bookings awaiting response`}
                  </p>
                </div>
                <ChevronRight className="size-4 text-amber-500 shrink-0" aria-hidden />
              </Link>
            )}
            {pausedCount > 0 && (
              <Link
                href="/lender/chargers"
                className="tap-light flex items-center gap-3 p-4"
              >
                <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
                  <AlertCircle className="size-4 text-amber-600" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {pausedCount === 1 ? '1 charger currently paused' : `${pausedCount} chargers currently paused`}
                  </p>
                </div>
                <ChevronRight className="size-4 text-amber-500 shrink-0" aria-hidden />
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Quick actions</p>
        <div className="bg-white border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <Link
            href="/lender/chargers/new"
            className="tap-light flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
          >
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
              <Plus className="size-4 text-green" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Add charger</span>
            <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
          </Link>
          <Link
            href="/lender/chargers"
            className="tap-light flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
          >
            <div className="size-9 rounded-xl bg-gray-100 grid place-items-center shrink-0">
              <ListChecks className="size-4 text-muted" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Manage chargers</span>
            <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
          </Link>
          <Link
            href="/lender/bookings"
            className="tap-light flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
          >
            <div className="size-9 rounded-xl bg-blue-50 grid place-items-center shrink-0">
              <BookOpen className="size-4 text-blue-600" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">View bookings</span>
            <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
          </Link>
          <Link
            href="/lender/earnings"
            className="tap-light flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
          >
            <div className="size-9 rounded-xl bg-emerald-50 grid place-items-center shrink-0">
              <IndianRupee className="size-4 text-emerald-700" aria-hidden />
            </div>
            <span className="text-sm font-semibold text-ink flex-1">Finance</span>
            <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
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
                className="tap-light bg-white rounded-2xl border border-border p-4 flex items-center justify-between"
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
