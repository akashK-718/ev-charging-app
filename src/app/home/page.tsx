import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/currency';
import {
  AlertCircle, ChevronRight,
  Zap, Calendar, Shield, MapPin,
  Leaf, TrendingUp, ArrowRight, Map as MapIcon, Route,
  Check, X, Inbox, CalendarClock,
} from 'lucide-react';
import { toJpegUrl } from '@/lib/cloudinary-url';
import { getActiveTip } from '@/lib/home/tips';
import { HomeRealtimeSync } from './HomeRealtimeSync';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DynamicNudge, type RuleNudge } from '@/components/home/DynamicNudge';

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

type NearbyCharger = {
  id: string;
  title: string;
  photos: string[];
  charger_type: string | null;
  price_per_kwh: number | null;
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
    nearbyChargersRes,
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

    admin.from('chargers')
      .select('id, title, photos, charger_type, price_per_kwh')
      .eq('status', 'active')
      .neq('lender_id', userId)
      .limit(6),
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
    // Near you strip
    nearbyChargers: ((nearbyChargersRes as { data: NearbyCharger[] | null }).data ?? []),
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

  // ── Nudge (0..1, cascade: unfinished → install-pwa → rule → discovery → evergreen) ──

  // new-user and resume-draft stay server-rendered (highest priority; install card never
  // outranks unfinished work). Everything below them is handled by DynamicNudge so the
  // client can check install eligibility (standalone mode, localStorage, platform) before
  // deciding whether to show the install card or fall through to the rule nudge.

  type TopNudge =
    | { type: 'new-user' }
    | { type: 'resume-draft'; charger: HostCharger; step: number };

  const isNewAccount = !d.inProgress && d.upcoming.length === 0 && d.chargeCompletedCount === 0 && !isHosting;
  const daySeed      = Math.floor(Date.now() / 86400000);
  const activeTip    = getActiveTip(daySeed, isHosting);

  const topNudge = ((): TopNudge | null => {
    if (isNewAccount) return { type: 'new-user' };
    if (d.draftChargers.length > 0) {
      return { type: 'resume-draft', charger: d.draftChargers[0], step: getDraftStep(d.draftChargers[0]) };
    }
    return null;
  })();

  // Serialisable rule nudge passed as a prop — shown by DynamicNudge only when
  // the install card is ineligible (already installed, dismissed, or unsupported).
  const ruleNudge = ((): RuleNudge => {
    if (topNudge) return null;
    if (isHosting && d.activeChargersNeedingPhotos.length > 0) {
      const c = d.activeChargersNeedingPhotos[0];
      return { type: 'photos', chargerId: c.id, chargerTitle: c.title };
    }
    if (isHosting && d.liveCount > 0 && d.recentHostBookingCount === 0) {
      const c = d.hostChargers.find(ch => ch.status === 'active');
      if (c) return { type: 'lower-price', chargerId: c.id, chargerTitle: c.title };
    }
    if (!isHosting && hasChargeActivity) return { type: 'hosting-discovery' };
    if (activeTip) return {
      type: 'tip',
      id: activeTip.id,
      title: activeTip.title,
      body: activeTip.body,
      linkLabel: activeTip.link?.label,
      linkHref: activeTip.link?.href,
    };
    return null;
  })();

  // ── Render helpers ────────────────────────────────────────────────────────

  const avatarInitials = name
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || firstName[0]?.toUpperCase() || '?';

  const minPrice =
    d.nearbyChargers.length > 0
      ? d.nearbyChargers.reduce<number>(
          (min, c) => (c.price_per_kwh != null && c.price_per_kwh < min ? c.price_per_kwh : min),
          Infinity,
        )
      : null;
  const findSubtitle =
    d.nearbyChargers.length > 0
      ? `${d.nearbyChargers.length} nearby · from ₹${minPrice != null && minPrice < Infinity ? Math.round(minPrice) : '—'}/kWh`
      : 'Explore chargers near you';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-4 space-y-3">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-1">
          <div className="size-10 rounded-2xl bg-green grid place-items-center shadow-md shadow-green-900/20 shrink-0">
            <Leaf className="size-5 text-white" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green">EV Charging</p>
            <h1 className="text-lg font-bold leading-tight text-ink">{timeGreeting()}, {firstName}</h1>
          </div>
          <Link href="/profile" aria-label="Go to profile" className="shrink-0 active:scale-95 transition">
            <div className="size-10 rounded-full bg-green-700 grid place-items-center text-white text-sm font-semibold">
              {avatarInitials}
            </div>
          </Link>
        </div>

        {/* ── Account alerts: KYC / payout / suspended ────────────────────── */}
        {(attnKycBlocked || attnKycRejected || !!attnPayoutFailed || attnSuspended.length > 0) && (
          <div className="rise-in bg-white border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
            {attnKycBlocked && (
              <Link href="/profile" className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-page transition-colors">
                <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
                  <Shield className="size-4 text-amber-600" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">Complete verification</p>
                  <p className="text-xs text-muted">Required before hosting</p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}
            {attnKycRejected && (
              <Link href="/profile" className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-page transition-colors">
                <div className="size-9 rounded-xl bg-danger-soft grid place-items-center shrink-0">
                  <Shield className="size-4 text-danger" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">Verification rejected</p>
                  <p className="text-xs text-muted">Update your details in Profile</p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}
            {attnPayoutFailed && (
              <Link href="/lender/chargers" className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-page transition-colors">
                <div className="size-9 rounded-xl bg-danger-soft grid place-items-center shrink-0">
                  <AlertCircle className="size-4 text-danger" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">Payout failed</p>
                  <p className="text-xs text-muted truncate">
                    {formatINR(attnPayoutFailed.amount_paise)} could not be transferred
                    {attnPayoutFailed.failed_reason ? ` · ${attnPayoutFailed.failed_reason}` : ''}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}
            {attnSuspended.map(c => (
              <Link key={`susp-${c.id}`} href={`/lender/chargers/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-page transition-colors">
                <div className="size-9 rounded-xl bg-danger-soft grid place-items-center shrink-0">
                  <AlertCircle className="size-4 text-danger" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">Charger offline</p>
                  <p className="text-xs text-muted truncate">{c.title}</p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        )}

        {/* ── Charging in progress ─────────────────────────────────────────── */}
        {attnInProgress && (
          <Link
            href={`/bookings/${attnInProgress.id}`}
            className="rise-in block bg-green text-white rounded-3xl p-4 shadow-lg shadow-green-900/20 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-green-200 flex items-center gap-1.5">
                <Zap className="size-3.5" aria-hidden /> Charging now
              </p>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-green-300 animate-pulse" aria-hidden />
                <span className="text-[10px] font-semibold text-green-200">Live</span>
              </span>
            </div>
            <p className="mt-2 text-xl font-bold">{attnInProgress.charger?.title ?? 'Charger'}</p>
            {attnInProgress.charger?.address && (
              <p className="text-sm text-green-100 truncate">{attnInProgress.charger.address}</p>
            )}
            <div className="mt-3.5">
              <div className="h-10 rounded-xl bg-white text-green text-sm font-bold grid place-items-center">
                View session
              </div>
            </div>
          </Link>
        )}

        {/* ── Starting soon ────────────────────────────────────────────────── */}
        {attnStartingSoon.map(b => (
          <div key={`soon-${b.id}`} className="rise-in bg-green text-white rounded-3xl p-4 shadow-lg shadow-green-900/20">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-green-200 flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden /> Your next charge
              </p>
              <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5 font-semibold">
                {timeFromNow(b.scheduled_start)}
              </span>
            </div>
            <p className="mt-2 text-xl font-bold">{fmtTime(b.scheduled_start)}</p>
            <p className="text-sm text-green-100 truncate">
              {b.charger?.title ?? 'Charger'}{b.charger?.address ? ` · ${b.charger.address}` : ''}
            </p>
            <div className="mt-3.5 flex gap-2">
              <Link
                href={`/bookings/${b.id}`}
                className="flex-1 h-10 grid place-items-center rounded-xl bg-white text-green text-sm font-bold active:scale-95 transition-transform"
              >
                Start charging
              </Link>
              <Link
                href={`/chargers/${b.charger_id}`}
                className="h-10 px-4 grid place-items-center rounded-xl bg-white/15 text-sm font-semibold active:scale-95 transition-transform"
              >
                Details
              </Link>
            </div>
          </div>
        ))}

        {/* ── Awaiting driver confirmation ──────────────────────────────────── */}
        {attnAwaitingConf.map(b => (
          <Link
            key={`adc-${b.id}`}
            href={`/bookings/${b.id}`}
            className="rise-in flex items-center gap-3 bg-white border-2 border-green/20 rounded-3xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
              <Calendar className="size-4 text-green" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">Booking confirmed by host</p>
              <p className="text-xs text-muted truncate">
                {b.charger?.title ?? 'Charger'} · {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
          </Link>
        ))}

        {/* ── Snapshot cards ───────────────────────────────────────────────── */}
        {snapshotCards.map((card, i) => {
          if (card.type === 'upcoming-booking') {
            const b = card.booking;
            const isToday = new Date(b.scheduled_start).toDateString() === new Date().toDateString();
            return (
              <div key={`snap-up-${i}`} className="rise-in bg-green text-white rounded-3xl p-4 shadow-lg shadow-green-900/20">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-green-200 flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" aria-hidden /> Your next charge
                  </p>
                  <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5 font-semibold">
                    {isToday ? 'Today' : fmtDate(b.scheduled_start)}
                  </span>
                </div>
                <p className="mt-2 text-xl font-bold">{fmtTime(b.scheduled_start)}</p>
                <p className="text-sm text-green-100 truncate">
                  {b.charger?.title ?? 'Upcoming booking'}
                  {b.charger?.address ? ` · ${b.charger.address}` : ''}
                  {card.total > 1 ? ` · +${card.total - 1} more` : ''}
                </p>
                <div className="mt-3.5 flex gap-2">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="flex-1 h-10 grid place-items-center rounded-xl bg-white text-green text-sm font-bold active:scale-95 transition-transform"
                  >
                    Start charging
                  </Link>
                  <Link
                    href={`/chargers/${b.charger_id}`}
                    className="h-10 px-4 grid place-items-center rounded-xl bg-white/15 text-sm font-semibold active:scale-95 transition-transform"
                  >
                    Details
                  </Link>
                </div>
              </div>
            );
          }

          if (card.type === 'hosting-workspace') {
            return (
              <Link
                key={`snap-host-${i}`}
                href="/lender/chargers"
                className="rise-in block bg-zinc-900 text-white rounded-3xl p-4 shadow-lg shadow-green-900/10 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-green-400 flex items-center gap-1.5">
                    <TrendingUp className="size-3.5" aria-hidden /> Hosting · Today
                  </p>
                  <ArrowRight className="size-4 text-white/50" aria-hidden />
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-3xl font-bold tabular-nums">{formatINR(card.weekEarnings)}</p>
                  <p className="text-xs text-white/60 pb-1.5">this week</p>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[38%] rounded-full bg-green-400" />
                </div>
                <p className="mt-1.5 text-[11px] text-white/50">
                  {card.todayCount === 0
                    ? 'No bookings today'
                    : `${card.todayCount} booking${card.todayCount === 1 ? '' : 's'} today`}
                  {d.pendingBookings.length > 0
                    ? ` · ${d.pendingBookings.length} request${d.pendingBookings.length === 1 ? '' : 's'} pending`
                    : ''}
                </p>
              </Link>
            );
          }

          if (card.type === 'recent-sessions') {
            return (
              <Link
                key={`snap-sess-${i}`}
                href="/activity"
                className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
                  <Zap className="size-4 text-green" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {card.count} session{card.count === 1 ? '' : 's'} completed
                  </p>
                  <p className="text-xs text-muted">View in Activity</p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            );
          }

          if (card.type === 'kyc-pending') {
            return (
              <div
                key={`snap-kyc-${i}`}
                className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-3.5 shadow-sm"
              >
                <div className="size-9 rounded-xl bg-surface-page grid place-items-center shrink-0">
                  <Shield className="size-4 text-muted" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">Verification under review</p>
                  <p className="text-xs text-muted">We&apos;ll notify you once complete</p>
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* ── Pending booking requests ─────────────────────────────────────── */}
        {attnPendingRequests.map(b => {
          const initials = (b.driverName ?? '?')
            .split(' ')
            .filter(Boolean)
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return (
            <div key={`req-${b.id}`} className="rise-in bg-white border-2 border-amber-300/70 rounded-3xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-amber-500 grid place-items-center text-white text-sm font-semibold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink truncate">
                    {b.driverName ?? 'Someone'}{' '}
                    <span className="font-normal text-muted">wants to charge</span>
                  </p>
                  <p className="text-xs text-muted">{fmtDate(b.scheduled_start)}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-1 shrink-0">
                  Request
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/lender/bookings/${b.id}`}
                  className="h-10 rounded-xl bg-green text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Check className="size-4" aria-hidden /> Approve
                </Link>
                <Link
                  href={`/lender/bookings/${b.id}`}
                  className="h-10 rounded-xl bg-surface-page border border-border text-ink-soft text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <X className="size-4" aria-hidden /> Decline
                </Link>
              </div>
            </div>
          );
        })}

        {/* ── Quick actions ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link
            href="/explore"
            className="rise-in bg-white border border-border rounded-2xl p-3.5 shadow-sm active:scale-[0.97] transition-transform"
          >
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center text-green mb-2.5">
              <MapIcon className="size-[18px]" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-ink">Find a charger</p>
            <p className="text-[11px] text-muted">{findSubtitle}</p>
          </Link>
          <Link
            href="/explore"
            className="rise-in bg-white border border-border rounded-2xl p-3.5 shadow-sm active:scale-[0.97] transition-transform"
          >
            <div className="size-9 rounded-xl bg-green-soft grid place-items-center text-green mb-2.5">
              <Route className="size-[18px]" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-ink">Plan a trip</p>
            <p className="text-[11px] text-muted">Charging stops on your route</p>
          </Link>
        </div>

        {/* ── Nudge ────────────────────────────────────────────────────────── */}
        {topNudge ? (
          <section aria-label="Suggestion">
            {topNudge.type === 'new-user' && (
              <div className="rise-in flex flex-col items-center text-center py-10 px-4">
                <div className="size-16 grid place-items-center rounded-3xl bg-green-soft text-green mb-4">
                  <Inbox className="size-7" aria-hidden />
                </div>
                <p className="font-bold text-ink">All clear for now</p>
                <p className="text-sm text-muted mt-1 leading-relaxed max-w-xs">
                  When you have an upcoming charge, a request, or anything else that needs you, it&apos;ll show up here.
                </p>
                <div className="mt-5 flex gap-2 flex-wrap justify-center">
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-green text-white text-sm font-semibold shadow-md shadow-green-900/20"
                  >
                    <MapPin className="size-4" aria-hidden />
                    Find a charger
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white border border-border text-ink text-sm font-semibold"
                  >
                    Learn about hosting
                  </Link>
                </div>
              </div>
            )}

            {topNudge.type === 'resume-draft' && (
              <Link
                href={`/lender/chargers/${topNudge.charger.id}/edit`}
                className="rise-in flex items-center gap-3 bg-white border border-border rounded-3xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="size-9 rounded-xl bg-copper-soft grid place-items-center shrink-0">
                  <Zap className="size-4 text-copper" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">
                    Resume charger listing{topNudge.step < 7 ? `, step ${topNudge.step} of 7` : ''}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {topNudge.charger.title || 'Untitled charger'}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
              </Link>
            )}
          </section>
        ) : (
          <DynamicNudge ruleNudge={ruleNudge} />
        )}

      </div>

      {/* ── Near you ──────────────────────────────────────────────────────────── */}
      {d.nearbyChargers.length > 0 && (
        <div className="mt-2 mb-4">
          <div className="flex items-center justify-between px-4 mt-4 mb-2">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">Near you</h2>
            <Link href="/explore" className="text-xs font-semibold text-green">See map</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto phone-scroll px-4 pb-2">
            {d.nearbyChargers.map(c => (
              <Link
                key={c.id}
                href={`/chargers/${c.id}`}
                className="shrink-0 w-36 bg-white border border-border rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform"
              >
                <div className="h-16 relative bg-gradient-to-br from-green-700 to-green-500 overflow-hidden">
                  {c.photos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toJpegUrl(c.photos[0])}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-ink truncate">{c.title}</p>
                  <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                    <Zap className="size-2.5" aria-hidden />
                    {c.charger_type ?? 'EV'} · {c.price_per_kwh != null ? `₹${c.price_per_kwh}/kWh` : '—'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
    <HomeRealtimeSync userId={user.id} isHosting={isHosting} />
    <PullToRefresh />
    </>
  );
}
