import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/currency';
import {
  Clock, AlertCircle, ChevronRight, ArrowRight,
  Zap, Calendar, Shield, TrendingDown, MapPin, BookOpen,
} from 'lucide-react';
import { getActiveTip } from '@/lib/home/tips';

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

type LenderCharger = {
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

function getDraftStep(c: LenderCharger): number {
  if (!c.title) return 1;
  if (!c.charger_type || !c.connector_types?.length) return 2;
  if (!c.price_per_kwh) return 3;
  if (!c.address) return 4;
  if (!c.photos?.length) return 5;
  if (!c.instructions) return 6;
  return 7;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getHomeData(userId: string, isDriver: boolean, isLender: boolean) {
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
  const [
    driverActiveRes,
    driverCompletedRes,
    lenderChargersRes,
    lenderPendingRes,
    lenderTodayRes,
    lenderUpcomingRes,
    lenderWeekCompletedRes,
    lenderRecentRes,
    userProfileRes,
    failedPayoutRes,
  ] = await Promise.all([
    isDriver
      ? admin.from('bookings')
          .select('id, charger_id, scheduled_start, scheduled_end, status')
          .eq('driver_id', userId)
          .in('status', ['confirmed', 'pending', 'awaiting_driver_confirmation', 'in_progress'])
          .order('scheduled_start', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as BookingRow[] }),

    isDriver
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', userId)
          .eq('status', 'completed')
      : Promise.resolve({ count: 0 }),

    isLender
      ? admin.from('chargers')
          .select('id, title, status, photos, charger_type, connector_types, price_per_kwh, address, instructions')
          .eq('lender_id', userId)
          .is('deleted_at', null)
          .in('status', ['active', 'draft', 'paused', 'suspended'])
      : Promise.resolve({ data: [] as LenderCharger[] }),

    isLender
      ? admin.from('bookings')
          .select('id, charger_id, driver_id, scheduled_start')
          .eq('lender_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] as Array<{ id: string; charger_id: string; driver_id: string; scheduled_start: string }> }),

    isLender
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('lender_id', userId)
          .in('status', ['confirmed', 'in_progress'])
          .gte('scheduled_start', todayStart.toISOString())
          .lt('scheduled_start', tomorrowStart.toISOString())
      : Promise.resolve({ count: 0 }),

    isLender
      ? admin.from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('lender_id', userId)
          .eq('status', 'confirmed')
          .gt('scheduled_start', now.toISOString())
      : Promise.resolve({ count: 0 }),

    isLender
      ? admin.from('bookings')
          .select('id')
          .eq('lender_id', userId)
          .eq('status', 'completed')
          .gte('ended_at', weekStart.toISOString())
      : Promise.resolve({ data: [] as Array<{ id: string }> }),

    isLender
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

  const driverActive = ((driverActiveRes as { data: BookingRow[] | null }).data ?? []);
  const driverCompletedCount = (driverCompletedRes as { count: number | null }).count ?? 0;
  const lenderChargers = ((lenderChargersRes as { data: LenderCharger[] | null }).data ?? []);
  const pendingRaw = ((lenderPendingRes as { data: Array<{ id: string; charger_id: string; driver_id: string; scheduled_start: string }> | null }).data ?? []);

  const nowIso = now.toISOString();
  const inProgress = driverActive.find(b => b.status === 'in_progress') ?? null;
  const upcoming = driverActive.filter(
    b => (b.status === 'confirmed' || b.status === 'pending') && b.scheduled_start > nowIso,
  );
  const awaitingConfirmation = driverActive.filter(
    b => b.status === 'awaiting_driver_confirmation' && b.scheduled_start > nowIso,
  );
  const startingSoon = upcoming.filter(b => new Date(b.scheduled_start) <= soonCutoff);

  // Round 2 — enrich with charger titles and driver names
  const driverChargerIds = [...new Set([
    ...(inProgress ? [inProgress.charger_id] : []),
    ...upcoming.map(b => b.charger_id),
    ...awaitingConfirmation.map(b => b.charger_id),
  ])];
  const pendingChargerIds = [...new Set(pendingRaw.map(b => b.charger_id))];
  const pendingDriverIds = [...new Set(pendingRaw.map(b => b.driver_id))];
  const weekIds = ((lenderWeekCompletedRes as { data: Array<{ id: string }> | null }).data ?? []).map(b => b.id);

  const [driverChargerRes, pendingChargerRes, pendingDriverRes, weekPaymentsRes] = await Promise.all([
    driverChargerIds.length > 0
      ? admin.from('chargers').select('id, title, address').in('id', driverChargerIds)
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
    ((driverChargerRes as { data: ChargerInfo[] | null }).data ?? []).map(c => [c.id, c]),
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
    // Driver
    inProgress: inProgress
      ? { ...inProgress, charger: chargerMap.get(inProgress.charger_id) ?? null }
      : null,
    upcoming: upcoming.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    awaitingConfirmation: awaitingConfirmation.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    startingSoon: startingSoon.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    driverCompletedCount,
    // Lender
    lenderChargers,
    liveCount: lenderChargers.filter(c => c.status === 'active').length,
    draftChargers: lenderChargers.filter(c => c.status === 'draft'),
    offlineChargers: lenderChargers.filter(c => c.status === 'suspended'),
    activeChargersNeedingPhotos: lenderChargers.filter(
      c => c.status === 'active' && (c.photos?.length ?? 0) < 5,
    ),
    todayBookingCount: (lenderTodayRes as { count: number | null }).count ?? 0,
    pendingBookings: pendingRaw.map(b => ({
      ...b,
      chargerTitle: pendingChargerMap.get(b.charger_id) ?? null,
      driverName: pendingDriverMap.get(b.driver_id) ?? null,
    })) as PendingBooking[],
    upcomingLenderCount: (lenderUpcomingRes as { count: number | null }).count ?? 0,
    weekEarningsPaise,
    recentLenderBookingCount: (lenderRecentRes as { count: number | null }).count ?? 0,
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

  const role     = (user.user_metadata?.role as string | undefined) ?? 'driver';
  const name     = (user.user_metadata?.name as string | undefined) ?? '';
  const isDriver = role === 'driver' || role === 'both';
  const isLender = role === 'lender' || role === 'both';
  const firstName = name.split(' ')[0] || 'there';

  const d = await getHomeData(user.id, isDriver, isLender);

  // ── Bucket assembly ──────────────────────────────────────────────────────

  // P0 Attention — ordered: time-sensitive → session → account-blocking → financial → informational
  const p0StartingSoon     = d.startingSoon;
  const p0AwaitingConf     = d.awaitingConfirmation;
  const p0PendingRequests  = d.pendingBookings;
  const p0KycBlocked       = isLender && d.kycStatus === 'not_started';
  const p0KycRejected      = d.kycStatus === 'rejected' || d.kycStatus === 'resubmission_required';
  const p0PayoutFailed     = d.failedPayout;
  const p0ChargersOffline  = d.offlineChargers;
  const hasP0 =
    p0StartingSoon.length > 0 ||
    p0AwaitingConf.length > 0 ||
    p0PendingRequests.length > 0 ||
    p0KycBlocked || p0KycRejected ||
    !!p0PayoutFailed ||
    p0ChargersOffline.length > 0;

  // P1 Continue — pick the single highest-value item
  const p1InProgress   = isDriver ? d.inProgress : null;
  const p1DraftCharger = !p1InProgress && isLender && d.draftChargers.length > 0
    ? d.draftChargers[0]
    : null;
  const p1DraftStep    = p1DraftCharger ? getDraftStep(p1DraftCharger) : 0;
  const hasP1          = !!p1InProgress || !!p1DraftCharger;

  // P2 Snapshot — up to 2 cards; skip entirely for brand-new users
  const hasDriverActivity = !!d.inProgress || d.upcoming.length > 0 || d.driverCompletedCount > 0;
  const hasLenderActivity = d.liveCount > 0 || d.weekEarningsPaise > 0 || d.recentLenderBookingCount > 0;
  type P2Card =
    | { type: 'driver-upcoming'; booking: BookingWithCharger; total: number }
    | { type: 'lender-today'; count: number }
    | { type: 'kyc-pending' };
  const p2Cards: P2Card[] = [];
  if (hasDriverActivity || hasLenderActivity) {
    // Driver: next upcoming booking beyond the P0 45-min window
    const nextUpcoming = d.upcoming.find(b => !d.startingSoon.some(s => s.id === b.id));
    if (isDriver && nextUpcoming) {
      p2Cards.push({ type: 'driver-upcoming', booking: nextUpcoming, total: d.upcoming.length });
    }
    // Lender: bookings happening today (only show when non-zero)
    if (isLender && hasLenderActivity && d.todayBookingCount > 0) {
      p2Cards.push({ type: 'lender-today', count: d.todayBookingCount });
    }
    // KYC pending is informational, lives here rather than P0
    if (d.kycStatus === 'pending') {
      p2Cards.push({ type: 'kyc-pending' });
    }
    p2Cards.splice(2); // max 2
  }

  // P3 Workspace — lenders only
  const p3 = isLender
    ? { weekEarnings: d.weekEarningsPaise, liveCount: d.liveCount, upcomingCount: d.upcomingLenderCount }
    : null;

  // P4 Suggestions — pick the single highest-value rule card
  type P4Card =
    | { type: 'suggestion-photos'; charger: LenderCharger }
    | { type: 'suggestion-lower-price'; charger: LenderCharger }
    | { type: 'suggestion-explore' };
  const p4 = ((): P4Card | null => {
    if (isLender && d.activeChargersNeedingPhotos.length > 0) {
      return { type: 'suggestion-photos', charger: d.activeChargersNeedingPhotos[0] };
    }
    if (isLender && d.liveCount > 0 && d.recentLenderBookingCount === 0) {
      const topActive = d.lenderChargers.find(c => c.status === 'active');
      if (topActive) return { type: 'suggestion-lower-price', charger: topActive };
    }
    if (isDriver && !hasDriverActivity && !isLender) {
      return { type: 'suggestion-explore' };
    }
    return null;
  })();

  // P5 Learn — rotating tip; new drivers get dedicated onboarding content instead
  const isNewDriver = isDriver && !hasDriverActivity && !isLender;
  const daySeed     = Math.floor(Date.now() / 86400000);
  const p5tip       = isNewDriver ? null : getActiveTip(daySeed);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4 space-y-6">

        {/* Greeting — always */}
        <h1 className="text-2xl font-medium text-ink">
          {timeGreeting()}, {firstName}
        </h1>

        {/* P0 — Attention */}
        {hasP0 && (
          <section aria-label="Needs attention">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3 h-3 text-copper" aria-hidden />
              <p className="text-xs font-semibold text-copper tracking-wider uppercase">
                Needs attention
              </p>
            </div>
            <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden divide-y divide-border">

              {/* 1. Time-sensitive: booking starting soon */}
              {p0StartingSoon.map(b => (
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

              {/* 2a. Session: host confirmed, driver yet to acknowledge */}
              {p0AwaitingConf.map(b => (
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

              {/* 2b. Session: pending booking requests (lender) */}
              {p0PendingRequests.map(b => (
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

              {/* 3a. Account-blocking: KYC not started (lender) */}
              {p0KycBlocked && (
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
              {p0KycRejected && (
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
              {p0PayoutFailed && (
                <Link
                  href="/lender/dashboard"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Payout failed</p>
                    <p className="text-xs text-muted">
                      {formatINR(p0PayoutFailed.amount_paise)} could not be transferred
                      {p0PayoutFailed.failed_reason ? ` · ${p0PayoutFailed.failed_reason}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                </Link>
              )}

              {/* 5. Informational: suspended chargers */}
              {p0ChargersOffline.map(c => (
                <Link
                  key={`offline-${c.id}`}
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

        {/* P1 — Continue */}
        {hasP1 && (
          <section aria-label="Continue">
            {p1InProgress && (
              <Link
                href={`/bookings/${p1InProgress.id}`}
                className="flex items-center gap-4 bg-green rounded-token-lg px-4 py-4 hover:bg-green-deep transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-0.5">
                    Charging now
                  </p>
                  <p className="text-base font-semibold text-white truncate">
                    {p1InProgress.charger?.title ?? 'Charger'}
                  </p>
                  <p className="text-xs text-white/70 mt-0.5">
                    Started {fmtTime(p1InProgress.scheduled_start)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" aria-hidden />
                  <span className="text-xs text-white/70 font-medium">Live</span>
                </div>
              </Link>
            )}
            {p1DraftCharger && (
              <Link
                href={`/lender/chargers/${p1DraftCharger.id}/edit`}
                className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-copper" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Resume listing{p1DraftStep < 7 ? ` — Step ${p1DraftStep} of 7` : ''}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {p1DraftCharger.title || 'Untitled charger'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}
          </section>
        )}

        {/* P2 — Snapshot */}
        {p2Cards.length > 0 && (
          <section aria-label="Summary" className="space-y-3">
            {p2Cards.map((card, i) => {
              if (card.type === 'driver-upcoming') {
                const b = card.booking;
                return (
                  <Link
                    key={`p2-${i}`}
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
              if (card.type === 'lender-today') {
                return (
                  <Link
                    key={`p2-${i}`}
                    href="/lender/bookings"
                    className="flex items-center gap-4 bg-surface-card border border-border rounded-token-lg px-4 py-3.5 hover:bg-surface-page transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                        {card.count}
                      </p>
                      <p className="text-xs text-muted mt-0.5">Bookings today</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden />
                  </Link>
                );
              }
              if (card.type === 'kyc-pending') {
                return (
                  <div
                    key={`p2-${i}`}
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

        {/* P3 — Hosting Workspace */}
        {p3 && (
          <section aria-label="Hosting">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink">Hosting</p>
              <Link
                href="/lender/dashboard"
                className="text-xs font-semibold text-copper hover:underline underline-offset-2"
              >
                Open workspace
              </Link>
            </div>
            <div className="bg-surface-card border border-border rounded-token-lg overflow-hidden">
              {(p3.liveCount > 0 || p3.upcomingCount > 0 || p3.weekEarnings > 0) ? (
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  <div className="px-4 py-4">
                    <p className="font-mono text-base font-bold text-ink tabular-nums">
                      {formatINR(p3.weekEarnings)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">This week</p>
                  </div>
                  <div className="px-4 py-4">
                    <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                      {p3.liveCount}
                    </p>
                    <p className="text-xs text-muted mt-0.5">Live</p>
                  </div>
                  <div className="px-4 py-4">
                    <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                      {p3.upcomingCount}
                    </p>
                    <p className="text-xs text-muted mt-0.5">Upcoming</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 border-b border-border">
                  <p className="text-sm text-muted">
                    {d.lenderChargers.length === 0 ? '0 chargers · Not live' : 'No live chargers yet'}
                  </p>
                </div>
              )}
              <Link
                href="/lender/dashboard"
                className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-page transition-colors"
              >
                <span className="text-sm font-semibold text-ink">Open Hosting Workspace</span>
                <ArrowRight className="w-4 h-4 text-muted" aria-hidden />
              </Link>
            </div>
          </section>
        )}

        {/* P4 — Suggestions */}
        {p4 && (
          <section aria-label="Suggestion">
            {p4.type === 'suggestion-photos' && (
              <Link
                href={`/lender/chargers/${p4.charger.id}/edit`}
                className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-copper" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Add more photos</p>
                  <p className="text-xs text-muted">
                    Listings with 5 or more photos receive more bookings. {p4.charger.title}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
              </Link>
            )}

            {p4.type === 'suggestion-lower-price' && (
              <Link
                href={`/lender/chargers/${p4.charger.id}/edit`}
                className="flex items-start gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4 text-green" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">No bookings in 30 days</p>
                  <p className="text-xs text-muted">
                    Adjusting your price may help attract bookings for {p4.charger.title}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
              </Link>
            )}

            {p4.type === 'suggestion-explore' && (
              <div className="bg-surface-card border border-border rounded-token-lg px-4 py-5">
                <p className="text-base font-semibold text-ink mb-1">
                  You&apos;re all set to start charging.
                </p>
                <p className="text-sm text-muted mb-4">
                  Use Explore to find verified home chargers near you.
                </p>
                <Link
                  href="/chargers"
                  className="inline-flex items-center gap-2 bg-green text-white text-sm font-semibold px-4 py-2.5 rounded-token hover:bg-green-deep transition-colors"
                >
                  <MapPin className="w-4 h-4" aria-hidden />
                  Explore chargers
                </Link>
              </div>
            )}
          </section>
        )}

        {/* P5 — Learn */}
        {(isNewDriver || p5tip) && (
          <section aria-label="Learn">
            {isNewDriver ? (
              <div className="bg-surface-card border border-border rounded-token-lg divide-y divide-border overflow-hidden">
                <div className="px-4 py-4">
                  <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-2">
                    How it works
                  </p>
                  <p className="text-sm text-ink-soft leading-relaxed">
                    Find a home charger near you, book a time slot, and plug in. Three steps to your first session.
                  </p>
                  <Link
                    href="/help"
                    className="inline-block mt-2 text-xs font-semibold text-copper hover:underline underline-offset-2"
                  >
                    Learn more
                  </Link>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-sm text-ink-soft">Have questions?</p>
                  <Link
                    href="/help"
                    className="text-xs font-semibold text-copper hover:underline underline-offset-2"
                  >
                    Read FAQs
                  </Link>
                </div>
              </div>
            ) : p5tip ? (
              <div className="bg-surface-card border border-border rounded-token-lg px-4 py-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-muted shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    {p5tip.title && (
                      <p className="text-xs font-semibold text-muted mb-1">{p5tip.title}</p>
                    )}
                    <p className="text-sm text-ink-soft leading-relaxed">{p5tip.body}</p>
                    {p5tip.link && (
                      <Link
                        href={p5tip.link.href}
                        className="inline-block mt-1.5 text-xs font-semibold text-copper hover:underline underline-offset-2"
                      >
                        {p5tip.link.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

      </div>
    </div>
  );
}
