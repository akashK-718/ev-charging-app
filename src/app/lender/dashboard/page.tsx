import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { BookOpen, Zap, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/currency';

interface SearchParams {
  listed?: string;
  kyc?: string;
}

type ChargerRow = {
  id: string;
  title: string;
  address: string;
  status: string;
};

type ChargerStats = {
  upcomingNext: string | null;
  weekCompleted: number;
  weekEarningsPaise: number;
  hasCompleted: boolean;
  lastEndedAt: string | null;
};

type EnrichedRecentBooking = {
  id: string;
  charger_id: string;
  driver_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  charger_title: string | null;
  driver_name: string | null;
  lender_payout: number;
};

async function getLenderData(userId: string) {
  const adminSupabase = createAdminClient();

  const now = new Date();
  const daysToMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const nowIso = now.toISOString();
  const weekStartIso = weekStart.toISOString();

  const [
    userResult,
    chargersResult,
    upcomingResult,
    weekCompletedResult,
    recentCompletedResult,
    recentBookingsResult,
  ] = await Promise.all([
    adminSupabase.from('users').select('id, name, kyc_status').eq('id', userId).single(),

    adminSupabase
      .from('chargers')
      .select('id, title, address, status')
      .eq('lender_id', userId)
      .is('deleted_at', null)
      .in('status', ['draft', 'active', 'paused']),

    // Upcoming confirmed bookings for next-booking subtitle
    adminSupabase
      .from('bookings')
      .select('charger_id, scheduled_start')
      .eq('lender_id', userId)
      .eq('status', 'confirmed')
      .gt('scheduled_start', nowIso),

    // This week's completed bookings (IDs + charger) for counts + earnings
    adminSupabase
      .from('bookings')
      .select('id, charger_id')
      .eq('lender_id', userId)
      .eq('status', 'completed')
      .gte('ended_at', weekStartIso),

    // Most recent completed per charger (for "last booking X days ago")
    adminSupabase
      .from('bookings')
      .select('charger_id, ended_at')
      .eq('lender_id', userId)
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(50),

    // Recent 5 bookings for dashboard section
    adminSupabase
      .from('bookings')
      .select('id, charger_id, driver_id, scheduled_start, scheduled_end, status')
      .eq('lender_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const chargers = (chargersResult.data ?? []) as ChargerRow[];
  const upcoming = (upcomingResult.data ?? []) as Array<{ charger_id: string; scheduled_start: string }>;
  const weekCompleted = (weekCompletedResult.data ?? []) as Array<{ id: string; charger_id: string }>;
  const recentCompleted = (recentCompletedResult.data ?? []) as Array<{ charger_id: string; ended_at: string | null }>;
  const recentRaw = (recentBookingsResult.data ?? []) as Array<{
    id: string; charger_id: string; driver_id: string;
    scheduled_start: string; scheduled_end: string; status: string;
  }>;

  // Build per-charger stats
  const chargerStats = new Map<string, ChargerStats>();
  for (const c of chargers) {
    chargerStats.set(c.id, { upcomingNext: null, weekCompleted: 0, weekEarningsPaise: 0, hasCompleted: false, lastEndedAt: null });
  }

  for (const b of upcoming) {
    const s = chargerStats.get(b.charger_id);
    if (s && (!s.upcomingNext || b.scheduled_start < s.upcomingNext)) {
      s.upcomingNext = b.scheduled_start;
    }
  }

  for (const b of weekCompleted) {
    const s = chargerStats.get(b.charger_id);
    if (s) { s.weekCompleted++; s.hasCompleted = true; }
  }

  const seenCompleted = new Set<string>();
  for (const b of recentCompleted) {
    if (!seenCompleted.has(b.charger_id)) {
      seenCompleted.add(b.charger_id);
      const s = chargerStats.get(b.charger_id);
      if (s) { s.lastEndedAt = b.ended_at; s.hasCompleted = true; }
    }
  }

  // Payments for this week's completed bookings
  const weekBookingIds = weekCompleted.map(b => b.id);
  let weekEarningsPaise = 0;
  if (weekBookingIds.length > 0) {
    const { data: weekPayments } = await adminSupabase
      .from('payments')
      .select('booking_id, lender_payout')
      .in('booking_id', weekBookingIds);
    const payMap = new Map(
      (weekPayments ?? []).map((p: { booking_id: string; lender_payout: number }) => [p.booking_id, p.lender_payout ?? 0] as [string, number])
    );
    for (const b of weekCompleted) {
      const payout = payMap.get(b.id) ?? 0;
      weekEarningsPaise += payout;
      const s = chargerStats.get(b.charger_id);
      if (s) s.weekEarningsPaise += payout;
    }
  }

  // Enrich recent bookings with charger title, driver name, payment
  const chargerIds = [...new Set(recentRaw.map(b => b.charger_id))];
  const driverIds  = [...new Set(recentRaw.map(b => b.driver_id))];
  const recentIds  = recentRaw.map(b => b.id);

  const [chargerTitlesRes, driverNamesRes, recentPaymentsRes] = await Promise.all([
    chargerIds.length > 0
      ? adminSupabase.from('chargers').select('id, title').in('id', chargerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    driverIds.length > 0
      ? adminSupabase.from('users').select('id, name').in('id', driverIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    recentIds.length > 0
      ? adminSupabase.from('payments').select('booking_id, lender_payout').in('booking_id', recentIds)
      : Promise.resolve({ data: [] as Array<{ booking_id: string; lender_payout: number }> }),
  ]);

  const chargerTitleMap = new Map(
    (chargerTitlesRes.data ?? []).map((c: { id: string; title: string }) => [c.id, c.title] as [string, string])
  );
  const driverNameMap = new Map(
    (driverNamesRes.data ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name] as [string, string | null])
  );
  const recentPayMap = new Map(
    (recentPaymentsRes.data ?? []).map((p: { booking_id: string; lender_payout: number }) => [p.booking_id, p.lender_payout ?? 0] as [string, number])
  );

  const recentBookings: EnrichedRecentBooking[] = recentRaw.map(b => ({
    ...b,
    charger_title: chargerTitleMap.get(b.charger_id) ?? null,
    driver_name: driverNameMap.get(b.driver_id) ?? null,
    lender_payout: recentPayMap.get(b.id) ?? 0,
  }));

  return {
    user: userResult.data as { id: string; name: string | null; kyc_status: string } | null,
    chargers,
    chargerStats,
    weekEarningsPaise,
    recentBookings,
  };
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:      'bg-yellow-50 text-yellow-700',
  confirmed:    'bg-volt-soft text-volt-deep',
  in_progress:  'bg-blue-50 text-blue-700',
  completed:    'bg-gray-100 text-muted',
  cancelled:    'bg-red-50 text-red-700',
  rejected:     'bg-red-50 text-red-700',
  auto_rejected:'bg-red-50 text-red-700',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending:      'Pending',
  confirmed:    'Confirmed',
  in_progress:  'In progress',
  completed:    'Completed',
  cancelled:    'Cancelled',
  rejected:     'Rejected',
  auto_rejected:'Expired',
};

const CHARGER_STATUS_SORT: Record<string, number> = {
  draft: 0, active: 1, paused: 2, suspended: 3,
};

function ChargerStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
      status === 'active' ? 'bg-volt-soft text-volt-deep' :
      status === 'draft'  ? 'bg-yellow-50 text-yellow-700' :
      status === 'paused' ? 'bg-gray-100 text-muted' :
                            'bg-red-50 text-red-600',
    )}>
      {status === 'active' ? 'Live' :
       status === 'draft'  ? 'Draft' :
       status === 'paused' ? 'Paused' : 'Suspended'}
    </span>
  );
}

function chargerSubtitle(charger: ChargerRow, stats: ChargerStats | undefined): string {
  if (charger.status === 'draft')  return 'Awaiting verification';
  if (charger.status === 'paused') return 'Paused — not visible to drivers';
  if (charger.status !== 'active' || !stats) return '';

  if (stats.upcomingNext) {
    const d = new Date(stats.upcomingNext);
    const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `Next: ${dateStr} at ${timeStr}`;
  }
  if (stats.weekCompleted > 0) {
    const n = stats.weekCompleted;
    return `${n} booking${n !== 1 ? 's' : ''} this week · ${formatINR(stats.weekEarningsPaise)}`;
  }
  if (!stats.hasCompleted) return 'No bookings yet';
  if (stats.lastEndedAt) {
    const daysAgo = Math.floor((Date.now() - new Date(stats.lastEndedAt).getTime()) / 86_400_000);
    if (daysAgo === 0) return 'Last booking today';
    if (daysAgo === 1) return 'Last booking yesterday';
    return `Last booking ${daysAgo} days ago`;
  }
  return 'No bookings yet';
}

function formatDuration(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default async function LenderDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const { user: profile, chargers, chargerStats, weekEarningsPaise, recentBookings } = await getLenderData(user.id);
  if (!profile) redirect('/login');

  const kycStatus     = (profile.kyc_status ?? 'not_started') as string;
  const liveChargers  = chargers.filter(c => c.status === 'active').length;
  const draftChargers = chargers.filter(c => c.status === 'draft').length;

  const sortedChargers  = [...chargers].sort(
    (a, b) => (CHARGER_STATUS_SORT[a.status] ?? 99) - (CHARGER_STATUS_SORT[b.status] ?? 99)
  );
  const displayedChargers = sortedChargers.slice(0, 3);
  const hasMoreChargers   = sortedChargers.length > 3;

  return (
    <main className="min-h-screen px-6 py-10 space-y-6">
      {/* Action banners */}
      {searchParams.listed === '1' && (
        <div className="px-4 py-3 bg-volt-soft rounded-2xl border border-volt">
          <p className="font-semibold text-ink">
            {kycStatus === 'approved'
              ? "Charger listed! It's now live for drivers."
              : 'Charger saved as draft. Complete verification in Profile to publish it.'}
          </p>
        </div>
      )}
      {searchParams.kyc === 'submitted' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="font-semibold text-blue-800">KYC submitted! We&apos;ll review within 24–48 hours.</p>
        </div>
      )}

      {/* KYC status banners */}
      {kycStatus === 'not_started' && draftChargers > 0 && (
        <div className="px-4 py-3 bg-yellow-50 rounded-2xl border border-yellow-200">
          <p className="text-sm text-yellow-800">
            Your {draftChargers} charger{draftChargers > 1 ? 's are' : ' is'} ready.{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">
              Complete verification in Profile
            </Link>{' '}
            to start earning.
          </p>
        </div>
      )}
      {kycStatus === 'pending' && (
        <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
          <p className="text-sm text-blue-800 font-semibold">Verification under review</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Usually 24–48 hours.
            {draftChargers > 0 && ` Your ${draftChargers} draft charger${draftChargers > 1 ? 's' : ''} will publish automatically once approved.`}
          </p>
        </div>
      )}
      {kycStatus === 'rejected' && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-200">
          <p className="text-sm text-red-800">
            Verification rejected — update your details in{' '}
            <Link href="/profile" className="font-semibold underline underline-offset-2">Profile</Link>{' '}
            to resubmit.
          </p>
        </div>
      )}

      {/* Heading */}
      <h1 className="font-display font-extrabold text-3xl text-ink">
        {profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Welcome back'}
      </h1>

      {/* Stat cards — Row 1: Earnings full-width; Row 2: Live + Drafts 50/50 */}
      <div className="space-y-3">
        <Link
          href="/lender/earnings"
          className="group block bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:bg-gray-50 hover:border-gray-200 transition-colors relative"
        >
          <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-muted group-hover:text-ink transition-colors" />
          <p className="text-3xl font-display font-extrabold text-ink pr-6">{formatINR(weekEarningsPaise)}</p>
          <p className="text-xs text-muted mt-1">Earnings this week</p>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/lender/chargers?filter=active"
            className="group bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 hover:border-gray-200 transition-colors relative"
          >
            <ChevronRight className="absolute top-3 right-3 w-4 h-4 text-muted group-hover:text-ink transition-colors" />
            <p className="text-2xl font-display font-extrabold text-ink">{liveChargers}</p>
            <p className="text-xs text-muted mt-1">Live</p>
          </Link>
          <Link
            href="/lender/chargers?filter=draft"
            className="group bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 hover:border-gray-200 transition-colors relative"
          >
            <ChevronRight className="absolute top-3 right-3 w-4 h-4 text-muted group-hover:text-ink transition-colors" />
            <p className="text-2xl font-display font-extrabold text-ink">{draftChargers}</p>
            <p className="text-xs text-muted mt-1">Drafts</p>
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <h2 className="font-semibold text-lg text-ink">Quick actions</h2>
        <div className="grid grid-cols-1 gap-2">
          <Link
            href="/lender/bookings"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">View bookings</span>
          </Link>
          <Link
            href="/lender/chargers/new"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <Zap className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">Add a charger</span>
          </Link>
          <Link
            href="/lender/earnings"
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors"
          >
            <Clock className="w-5 h-5 text-volt-deep" />
            <span className="font-semibold text-ink text-sm">View earnings</span>
          </Link>
        </div>
      </div>

      {/* My chargers — Fix 2: no + Add link; Fix 3/4: context subtitles; Add a charger at bottom */}
      <div className="space-y-2">
        <h2 className="font-semibold text-lg text-ink">My chargers</h2>

        {chargers.length === 0 ? (
          <p className="text-sm text-muted py-2">You haven&apos;t added any chargers yet.</p>
        ) : (
          <>
            <div className="space-y-2">
              {displayedChargers.map(charger => (
                <Link
                  key={charger.id}
                  href={`/lender/chargers/${charger.id}`}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-ink truncate">{charger.title}</p>
                      <ChargerStatusBadge status={charger.status} />
                    </div>
                    <p className="text-xs text-muted">{chargerSubtitle(charger, chargerStats.get(charger.id))}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
            {hasMoreChargers && (
              <Link
                href="/lender/chargers"
                className="block text-center text-sm font-semibold text-volt-deep py-2"
              >
                View all chargers
              </Link>
            )}
          </>
        )}

      </div>

      {/* Recent bookings — Fix 5: richer display */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg text-ink">Recent bookings</h2>
        {recentBookings.length === 0 ? (
          <p className="text-sm text-muted">
            No bookings yet. Your chargers will appear here once drivers start booking.
          </p>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(booking => (
              <Link
                key={booking.id}
                href={`/lender/bookings/${booking.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {booking.charger_title ?? 'Charger'}
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {booking.driver_name ?? 'Driver'}
                    {' · '}
                    {new Date(booking.scheduled_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {formatDuration(booking.scheduled_start, booking.scheduled_end)}
                  </p>
                  {booking.lender_payout > 0 && (
                    <p className="text-xs font-semibold text-ink mt-1">
                      {formatINR(booking.lender_payout)} earned
                    </p>
                  )}
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                  BOOKING_STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-muted',
                )}>
                  {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
