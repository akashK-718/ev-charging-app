import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/currency';
import {
  Clock, AlertCircle, ChevronRight,
  Zap, Calendar, Shield, TrendingDown, MapPin, BookOpen,
} from 'lucide-react';
import { getActiveTip } from '@/lib/home/tips';
import { HomeRealtimeSync } from './HomeRealtimeSync';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeFromNow(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  charger_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type ChargerInfo = { id: string; title: string; address: string };

type BookingWithCharger = BookingRow & { charger: ChargerInfo | null };

type PendingBooking = {
  id: string;
  charger_id: string;
  driver_id: string;
  scheduled_start: string;
  chargerTitle: string | null;
  driverName: string | null;
};

type HostCharger = {
  id: string;
  title: string;
  status: string;
  photos: string[];
  charger_type: string | null;
  connector_types: string[] | null;
  price_per_kwh: number | null;
  address: string | null;
  instructions: string | null;
};

type FailedPayout = {
  id: string;
  amount_paise: number;
  failed_reason: string | null;
};

// ── Draft step ────────────────────────────────────────────────────────────────

function getDraftStep(c: HostCharger): number {
  if (!c.title) return 1;
  if (!c.charger_type || !c.connector_types?.length) return 2;
  if (!c.price_per_kwh) return 3;
  if (!c.address) return 4;
  if (!c.photos?.length) return 5;
  if (!c.instructions) return 6;
  return 7;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getHomeData(userId: string, isHosting: boolean) {
  const admin = createAdminClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const daysToMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const soonCutoff = new Date(now.getTime() + 45 * 60 * 1000);

  // Round 1 — all independent queries in parallel
  // Charging queries always run: every account can charge.
  // Hosting queries are gated on isHosting.
  const [
    chargeActiveRes,
    chargeCompletedRes,
    hostChargersRes,
    hostPendingRes,
    hostTodayRes,
    hostUpcomingRes,
    hostWeekCompletedRes,
    hostRecentRes,
    userProfileRes,
    failedPayoutRes,
  ] = await Promise.all([
    admin.from('bookings')
      .select('id, charger_id, scheduled_start, scheduled_end, status')
      .eq('driver_id', userId)
      .in('status', ['confirmed', 'pending', 'awaiting_driver_confirmation', 'in_progress'])
      .order('scheduled_start', { ascending: true })
      .limit(10),

    admin.from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', userId)
      .eq('status', 'completed'),

    isHosting
      ? admin.from('chargers')
          .select('id, title, status, photos, charger_type, connector_types, price_per_kwh, address, instructions')
          .eq('lender_id', userId)
          .is('deleted_at', null)
          .in('status', ['active', 'draft', 'paused', 'suspended'])
      : Promise.resolve({ data: [] as HostCharger[] }),

    isHosting
      ? admin.from('bookings')
          .select('id, charger_id, driver_id, scheduled_start')
          .eq('lender_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] as Array<{ id: string; charger_id: string; driver_id: string; scheduled_start: string }> }),

    isHosting
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('lender_id', userId)
          .in('status', ['confirmed', 'in_progress'])
          .gte('scheduled_start', todayStart.toISOString())
          .lt('scheduled_start', tomorrowStart.toISOString())
      : Promise.resolve({ count: 0 }),

    isHosting
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('lender_id', userId)
          .eq('status', 'confirmed')
          .gt('scheduled_start', now.toISOString())
      : Promise.resolve({ count: 0 }),

    isHosting
      ? admin.from('bookings')
          .select('id')
          .eq('lender_id', userId)
          .eq('status', 'completed')
          .gte('ended_at', weekStart.toISOString())
      : Promise.resolve({ data: [] as Array<{ id: string }> }),

    isHosting
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('lender_id', userId)
          .eq('status', 'completed')
          .gte('ended_at', thirtyDaysAgo.toISOString())
      : Promise.resolve({ count: 0 }),

    admin.from('users').select('kyc_status').eq('id', userId).single(),

    admin.from('payouts')
      .select('id, amount_paise, failed_reason')
      .eq('user_id', userId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const chargeActive = ((chargeActiveRes as { data: BookingRow[] | null }).data ?? []);
  const chargeCompletedCount = (chargeCompletedRes as { count: number | null }).count ?? 0;
  const hostChargers = ((hostChargersRes as { data: HostCharger[] | null }).data ?? []);
  const pendingRaw = ((hostPendingRes as { data: Array<{ id: string; charger_id: string; driver_id: string; scheduled_start: string }> | null }).data ?? []);

  const nowIso = now.toISOString();
  const inProgress = chargeActive.find(b => b.status === 'in_progress') ?? null;
  const upcoming = chargeActive.filter(
    b => (b.status === 'confirmed' || b.status === 'pending') && b.scheduled_start > nowIso,
  );
  const awaitingConfirmation = chargeActive.filter(
    b => b.status === 'awaiting_driver_confirmation' && b.scheduled_start > nowIso,
  );
  const startingSoon = upcoming.filter(b => new Date(b.scheduled_start) <= soonCutoff);

  // Round 2 — enrich with charger titles and driver names
  const chargeChargerIds = [...new Set([
    ...(inProgress ? [inProgress.charger_id] : []),
    ...upcoming.map(b => b.charger_id),
    ...awaitingConfirmation.map(b => b.charger_id),
  ])];
  const pendingChargerIds = [...new Set(pendingRaw.map(b => b.charger_id))];
  const pendingDriverIds = [...new Set(pendingRaw.map(b => b.driver_id))];
  const weekIds = ((hostWeekCompletedRes as { data: Array<{ id: string }> | null }).data ?? []).map(b => b.id);

  const [chargerInfoRes, pendingChargerRes, pendingDriverRes, weekPaymentsRes] = await Promise.all([
    chargeChargerIds.length > 0
      ? admin.from('chargers').select('id, title, address').in('id', chargeChargerIds)
      : Promise.resolve({ data: [] as ChargerInfo[] }),
    pendingChargerIds.length > 0
      ? admin.from('chargers').select('id, title').in('id', pendingChargerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    pendingDriverIds.length > 0
      ? admin.from('users').select('id, name').in('id', pendingDriverIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    weekIds.length > 0
      ? admin.from('payments').select('lender_payout').in('booking_id', weekIds)
      : Promise.resolve({ data: [] as Array<{ lender_payout: number }> }),
  ]);

  const chargerMap = new Map(
    ((chargerInfoRes as { data: ChargerInfo[] | null }).data ?? []).map(c => [c.id, c]),
  );
  const pendingChargerMap = new Map(
    ((pendingChargerRes as { data: Array<{ id: string; title: string }> | null }).data ?? []).map(c => [c.id, c.title]),
  );
  const pendingDriverMap = new Map(
    ((pendingDriverRes as { data: Array<{ id: string; name: string | null }> | null }).data ?? []).map(u => [u.id, u.name]),
  );
  const weekEarningsPaise = ((weekPaymentsRes as { data: Array<{ lender_payout: number }> | null }).data ?? [])
    .reduce((s, p) => s + (p.lender_payout ?? 0), 0);

  return {
    // Charging (all accounts)
    inProgress: inProgress
      ? { ...inProgress, charger: chargerMap.get(inProgress.charger_id) ?? null }
      : null,
    upcoming: upcoming.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    awaitingConfirmation: awaitingConfirmation.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    startingSoon: startingSoon.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    chargeCompletedCount,
    // Hosting (isHosting accounts only)
    hostChargers,
    liveCount: hostChargers.filter(c => c.status === 'active').length,
    draftChargers: hostChargers.filter(c => c.status === 'draft'),
    suspendedChargers: hostChargers.filter(c => c.status === 'suspended'),
    activeChargersNeedingPhotos: hostChargers.filter(
      c => c.status === 'active' && (c.photos?.length ?? 0) < 5,
    ),
    todayBookingCount: (hostTodayRes as { count: number | null }).count ?? 0,
    pendingBookings: pendingRaw.map(b => ({
      ...b,
      chargerTitle: pendingChargerMap.get(b.charger_id) ?? null,
      driverName: pendingDriverMap.get(b.driver_id) ?? null,
    })) as PendingBooking[],
    upcomingHostCount: (hostUpcomingRes as { count: number | null }).count ?? 0,
    weekEarningsPaise,
    recentHostBookingCount: (hostRecentRes as { count: number | null }).count ?? 0,
    // Common
    kycStatus: (userProfileRes.data?.kyc_status ?? 'not_started') as string,
    failedPayout: (failedPayoutRes as { data: FailedPayout | null }).data ?? null,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  // Capability model: every account can charge; hosting is the only optional capability.
  const role      = (user.user_metadata?.role as string | undefined) ?? '';
  const name      = (user.user_metadata?.name as string | undefined) ?? '';
  const isHosting = role === 'lender' || role === 'both';
  const firstName = name.split(' ')[0] || 'there';

  const d = await getHomeData(user.id, isHosting);

  // ── Zone assembly ─────────────────────────────────────────────────────────

  // ── Attention (0..N) ─────────────────────────────────────────────────────
  // Order: 1.time-sensitive  2.session-related  3.account-blocking  4.financial  5.informational

  // 1. Time-sensitive
  const attnStartingSoon    = d.startingSoon;
  // 2. Session-related
  const attnInProgress      = d.inProgress;
  const attnAwaitingConf    = d.awaitingConfirmation;
  const attnPendingRequests = d.pendingBookings;
  // 3. Account-blocking
  // KYC "not started" only surfaces when isHosting — charging-only accounts are never nagged.
  const attnKycBlocked   = isHosting && d.kycStatus === 'not_started';
  const attnKycRejected  = d.kycStatus === 'rejected' || d.kycStatus === 'resubmission_required';
  // 4. Financial
  const attnPayoutFailed = d.failedPayout;
  // 5. Informational
  const attnSuspended    = d.suspendedChargers;

  const hasAttention =
    attnStartingSoon.length > 0 ||
    !!attnInProgress ||
    attnAwaitingConf.length > 0 ||
    attnPendingRequests.length > 0 ||
    attnKycBlocked || attnKycRejected ||
    !!attnPayoutFailed ||
    attnSuspended.length > 0;

  // ── Snapshot (0..2, no action buttons, tap to open) ───────────────────────

  type SnapshotCard =
    | { type: 'upcoming-booking'; booking: BookingWithCharger; total: number }
    | { type: 'recent-sessions'; count: number }
    | { type: 'hosting-workspace'; liveCount: number; todayCount: number; weekEarnings: number }
    | { type: 'kyc-pending' };

  const hasChargeActivity = !!d.inProgress || d.upcoming.length > 0 || d.chargeCompletedCount > 0;
  // Hosting workspace renders whenever isHosting && liveCount > 0, even with zero bookings today.
  const hasHostWorkspace  = isHosting && d.liveCount > 0;

  const snapshotCards: SnapshotCard[] = [];

  if (hasChargeActivity || hasHostWorkspace) {
    // Charging card: next booking beyond the Attention 45-min window, or session count
    const nextUpcoming = d.upcoming.find(b => !d.startingSoon.some(s => s.id === b.id));
    if (nextUpcoming) {
      snapshotCards.push({ type: 'upcoming-booking', booking: nextUpcoming, total: d.upcoming.length });
    } else if (d.chargeCompletedCount > 0) {
      snapshotCards.push({ type: 'recent-sessions', count: d.chargeCompletedCount });
    }

    // Hosting workspace card
    if (hasHostWorkspace) {
      snapshotCards.push({
        type: 'hosting-workspace',
        liveCount: d.liveCount,
        todayCount: d.todayBookingCount,
        weekEarnings: d.weekEarningsPaise,
      });
    }

    // KYC pending is informational — Snapshot, not Attention
    if (d.kycStatus === 'pending' && snapshotCards.length < 2) {
      snapshotCards.push({ type: 'kyc-pending' });
    }

    snapshotCards.splice(2); // max 2
  }

  // ── Nudge (0..1, cascade: unfinished → rule → discovery → evergreen) ─────

  type NudgeCard =
    | { type: 'new-user' }
    | { type: 'resume-draft'; charger: HostCharger; step: number }
    | { type: 'photos'; charger: HostCharger }
    | { type: 'lower-price'; charger: HostCharger }
    | { type: 'hosting-discovery' }
    | { type: 'tip' };

  const isNewAccount = !d.inProgress && d.upcoming.length === 0 && d.chargeCompletedCount === 0 && !isHosting;
  const daySeed      = Math.floor(Date.now() / 86400000);
  const activeTip    = getActiveTip(daySeed, isHosting);

  const nudgeCard = ((): NudgeCard | null => {
    // Brand-new account with no state at all — greeting + one combined onboarding card
    if (isNewAccount) return { type: 'new-user' };

    // Resume unfinished work
    if (d.draftChargers.length > 0) {
      return { type: 'resume-draft', charger: d.draftChargers[0], step: getDraftStep(d.draftChargers[0]) };
    }

    // Rule cards (hosting only)
    if (isHosting) {
      if (d.activeChargersNeedingPhotos.length > 0) {
        return { type: 'photos', charger: d.activeChargersNeedingPhotos[0] };
      }
      if (d.liveCount > 0 && d.recentHostBookingCount === 0) {
        const topActive = d.hostChargers.find(c => c.status === 'active');
        if (topActive) return { type: 'lower-price', charger: topActive };
      }
    }

    // Hosting discovery — for accounts with charging history that have not enabled hosting
    if (!isHosting && hasChargeActivity) {
      return { type: 'hosting-discovery' };
    }

    // Evergreen tip, filtered to actual context
    if (activeTip) return { type: 'tip' };

    return null;
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 space-y-6">

        {/* Greeting */}
        <h1 className="text-2xl font-medium text-ink">
          {timeGreeting()}, {firstName}
        </h1>

        {/* Attention */}
        {hasAttention && (
          <section aria-label="Needs attention">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3 h-3 text-copper" aria-hidden />
              <p className="text-xs font-semibold text-copper tracking-wider uppercase">
                Needs attention
              </p>
            </div>
            <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden divide-y divide-border">

              {/* 1. Time-sensitive: starting soon */}
              {attnStartingSoon.map(b => (
                <Link
                  key={`soon-${b.id}`}
                  href={`/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Clock className="w-4 h-4 text-copper mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      Booking starts {timeFromNow(b.scheduled_start)}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {b.charger?.title ?? 'Charger'} · {fmtTime(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              ))}

              {/* 2a. Session-related: charging in progress */}
              {attnInProgress && (
                <Link
                  href={`/bookings/${attnInProgress.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Zap className="w-4 h-4 text-green shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Charging now</p>
                    <p className="text-xs text-muted truncate">
                      {attnInProgress.charger?.title ?? 'Charger'} · started {fmtTime(attnInProgress.scheduled_start)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" aria-hidden />
                    <span className="text-xs text-green font-medium">Live</span>
                  </span>
                </Link>
              )}

              {/* 2b. Session-related: host confirmed, driver to acknowledge */}
              {attnAwaitingConf.map(b => (
                <Link
                  key={`adc-${b.id}`}
                  href={`/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-green mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Booking confirmed by host</p>
                    <p className="text-xs text-muted truncate">
                      {b.charger?.title ?? 'Charger'} · {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              ))}

              {/* 2c. Session-related: incoming booking requests (hosting) */}
              {attnPendingRequests.map(b => (
                <Link
                  key={`req-${b.id}`}
                  href={`/lender/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-copper mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Booking request</p>
                    <p className="text-xs text-muted truncate">
                      {b.chargerTitle ?? 'Charger'}
                      {b.driverName ? ` · ${b.driverName}` : ''}
                      {' · '}{fmtDate(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              ))}

              {/* 3a. Account-blocking: KYC not started (hosting only) */}
              {attnKycBlocked && (
                <Link
                  href="/profile"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Shield className="w-4 h-4 text-copper mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Complete verification</p>
                    <p className="text-xs text-muted">Required before hosting</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              )}

              {/* 3b. Account-blocking: KYC rejected */}
              {attnKycRejected && (
                <Link
                  href="/profile"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Shield className="w-4 h-4 text-danger mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Verification rejected</p>
                    <p className="text-xs text-muted">Update your details and resubmit in Profile</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              )}

              {/* 4. Financial: payout failed */}
              {attnPayoutFailed && (
                <Link
                  href="/lender/dashboard"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Payout failed</p>
                    <p className="text-xs text-muted">
                      {formatINR(attnPayoutFailed.amount_paise)} could not be transferred
                      {attnPayoutFailed.failed_reason ? ` · ${attnPayoutFailed.failed_reason}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              )}

              {/* 5. Informational: suspended chargers */}
              {attnSuspended.map(c => (
                <Link
                  key={`susp-${c.id}`}
                  href={`/lender/chargers/${c.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Charger offline</p>
                    <p className="text-xs text-muted truncate">{c.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              ))}

            </div>
          </section>
        )}

        {/* Snapshot */}
        {snapshotCards.length > 0 && (
          <section aria-label="Summary" className="space-y-2">
            {snapshotCards.map((card, i) => {
              if (card.type === 'upcoming-booking') {
                const b = card.booking;
                return (
                  <Link
                    key={`snap-${i}`}
                    href={`/bookings/${b.id}`}
                    className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-3.5 hover:bg-surface-page transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-green shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {b.charger?.title ?? 'Upcoming booking'}
                      </p>
                      <p className="text-xs text-muted">
                        {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
                        {card.total > 1 ? ` · +${card.total - 1} more` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-green shrink-0 font-mono tabular-nums">
                      {timeFromNow(b.scheduled_start)}
                    </span>
                  </Link>
                );
              }

              if (card.type === 'recent-sessions') {
                return (
                  <Link
                    key={`snap-${i}`}
                    href="/activity"
                    className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-3.5 hover:bg-surface-page transition-colors"
                  >
                    <Zap className="w-4 h-4 text-green shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        <span className="font-mono tabular-nums">{card.count}</span>{' '}
                        {card.count === 1 ? 'session' : 'sessions'} completed
                      </p>
                      <p className="text-xs text-muted">View in Activity</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
                  </Link>
                );
              }

              if (card.type === 'hosting-workspace') {
                return (
                  <Link
                    key={`snap-${i}`}
                    href="/lender/dashboard"
                    className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-3.5 hover:bg-surface-page transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        <span className="font-mono tabular-nums">{card.liveCount}</span>{' '}
                        {card.liveCount === 1 ? 'charger' : 'chargers'} live
                      </p>
                      <p className="text-xs text-muted">
                        {card.todayCount === 0
                          ? 'No bookings today'
                          : `${card.todayCount} ${card.todayCount === 1 ? 'booking' : 'bookings'} today`}
                        {card.weekEarnings > 0 ? ` · ${formatINR(card.weekEarnings)} this week` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-ink shrink-0">Manage Hosting</span>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
                  </Link>
                );
              }

              if (card.type === 'kyc-pending') {
                return (
                  <div
                    key={`snap-${i}`}
                    className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-3.5"
                  >
                    <Shield className="w-4 h-4 text-muted shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">Verification under review</p>
                      <p className="text-xs text-muted">We will notify you once complete</p>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </section>
        )}

        {/* Nudge */}
        {nudgeCard && (
          <section aria-label="Suggestion">

            {nudgeCard.type === 'new-user' && (
              <div className="bg-surface-card border border-border rounded-token-lg px-4 py-5">
                <p className="text-base font-semibold text-ink mb-1">
                  You&apos;re all set to start charging.
                </p>
                <p className="text-sm text-muted mb-4">
                  Find a home charger near you, book a slot, and plug in. Have a charger at home? Earn with it too.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href="/chargers"
                    className="inline-flex items-center gap-2 bg-green text-white text-sm font-semibold px-4 py-2.5 rounded-token hover:bg-green-deep transition-colors"
                  >
                    <MapPin className="w-4 h-4" aria-hidden />
                    Find chargers
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 bg-surface-page text-ink text-sm font-semibold px-4 py-2.5 rounded-token border border-border hover:bg-border transition-colors"
                  >
                    Learn about hosting
                  </Link>
                </div>
              </div>
            )}

            {nudgeCard.type === 'resume-draft' && (
              <Link
                href={`/lender/chargers/${nudgeCard.charger.id}/edit`}
                className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-copper" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Resume charger listing{nudgeCard.step < 7 ? `, step ${nudgeCard.step} of 7` : ''}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {nudgeCard.charger.title || 'Untitled charger'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}

            {nudgeCard.type === 'photos' && (
              <Link
                href={`/lender/chargers/${nudgeCard.charger.id}/edit`}
                className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-copper" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Add more photos</p>
                  <p className="text-xs text-muted">
                    Listings with 5 or more photos receive more bookings. {nudgeCard.charger.title}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
              </Link>
            )}

            {nudgeCard.type === 'lower-price' && (
              <Link
                href={`/lender/chargers/${nudgeCard.charger.id}/edit`}
                className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4 text-green" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">No bookings in 30 days</p>
                  <p className="text-xs text-muted">
                    Adjusting your price may help attract bookings for {nudgeCard.charger.title}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
              </Link>
            )}

            {nudgeCard.type === 'hosting-discovery' && (
              <div className="bg-surface-card border border-border rounded-token-lg px-4 py-5">
                <p className="text-base font-semibold text-ink mb-1">
                  Earn with your home charger.
                </p>
                <p className="text-sm text-muted mb-4">
                  Share your charger when you&apos;re not using it. Set your own hours and earn extra income.
                </p>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 bg-surface-page text-ink text-sm font-semibold px-4 py-2.5 rounded-token border border-border hover:bg-border transition-colors"
                >
                  Learn more
                </Link>
              </div>
            )}

            {nudgeCard.type === 'tip' && activeTip && (
              <div className="bg-surface-card border border-border rounded-token-lg px-4 py-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    {activeTip.title && (
                      <p className="text-xs font-semibold text-muted mb-1">{activeTip.title}</p>
                    )}
                    <p className="text-sm text-ink-soft leading-relaxed">{activeTip.body}</p>
                    {activeTip.link && (
                      <Link
                        href={activeTip.link.href}
                        className="inline-block mt-1.5 text-xs font-semibold text-copper hover:underline underline-offset-2"
                      >
                        {activeTip.link.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

      </div>
    </div>
    <HomeRealtimeSync userId={user.id} isHosting={isHosting} />
    <PullToRefresh />
    </>
  );
}
