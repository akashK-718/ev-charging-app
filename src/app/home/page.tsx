import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/currency';
import { MapPin, Zap, ChevronRight, Clock, AlertCircle, Calendar, ArrowRight } from 'lucide-react';

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function timeFromNow(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

type BookingSummary = {
  id: string;
  charger_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type LenderCharger = {
  id: string;
  title: string;
  status: string;
  photos: string[];
};

type PendingBookingRaw = {
  id: string;
  charger_id: string;
  driver_id: string;
  scheduled_start: string;
};

type ChargerInfo = { id: string; title: string; address: string };

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
  const soonCutoff = new Date(now.getTime() + 45 * 60 * 1000);

  // Round 1 — all independent queries in parallel
  const [
    driverActiveRes,
    lenderChargersRes,
    lenderPendingRes,
    lenderTodayRes,
    lenderUpcomingCountRes,
    lenderWeekCompletedRes,
    userProfileRes,
  ] = await Promise.all([
    isDriver
      ? admin.from('bookings')
          .select('id, charger_id, scheduled_start, scheduled_end, status')
          .eq('driver_id', userId)
          .in('status', ['confirmed', 'pending', 'awaiting_driver_confirmation', 'in_progress'])
          .order('scheduled_start', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] as BookingSummary[] }),

    isLender
      ? admin.from('chargers')
          .select('id, title, status, photos')
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
      : Promise.resolve({ data: [] as PendingBookingRaw[] }),

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

    admin.from('users').select('kyc_status').eq('id', userId).single(),
  ]);

  const driverActive = ((driverActiveRes as { data: BookingSummary[] | null }).data ?? []) as BookingSummary[];
  const lenderChargers = ((lenderChargersRes as { data: LenderCharger[] | null }).data ?? []) as LenderCharger[];
  const pendingRaw = ((lenderPendingRes as { data: PendingBookingRaw[] | null }).data ?? []) as PendingBookingRaw[];

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
    inProgress: inProgress ? { ...inProgress, charger: chargerMap.get(inProgress.charger_id) ?? null } : null,
    upcoming: upcoming.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    awaitingConfirmation: awaitingConfirmation.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    startingSoon: startingSoon.map(b => ({ ...b, charger: chargerMap.get(b.charger_id) ?? null })),
    liveCount: lenderChargers.filter(c => c.status === 'active').length,
    draftChargers: lenderChargers.filter(c => c.status === 'draft'),
    offlineChargers: lenderChargers.filter(c => c.status === 'suspended'),
    chargersNeedingPhotos: lenderChargers.filter(
      c => c.status === 'draft' && (!c.photos || c.photos.length === 0),
    ),
    todayBookingCount: (lenderTodayRes as { count: number | null }).count ?? 0,
    pendingBookings: pendingRaw.map(b => ({
      ...b,
      chargerTitle: pendingChargerMap.get(b.charger_id) ?? null,
      driverName: pendingDriverMap.get(b.driver_id) ?? null,
    })),
    upcomingLenderCount: (lenderUpcomingCountRes as { count: number | null }).count ?? 0,
    weekEarningsPaise,
    kycStatus: (userProfileRes.data?.kyc_status ?? 'not_started') as string,
  };
}

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');

  const role      = (user.user_metadata?.role as string | undefined) ?? 'driver';
  const name      = (user.user_metadata?.name as string | undefined) ?? '';
  const isDriver  = role === 'driver' || role === 'both';
  const isLender  = role === 'lender' || role === 'both';
  const firstName = name.split(' ')[0] || 'there';

  const d = await getHomeData(user.id, isDriver, isLender);

  const hasAttention =
    d.pendingBookings.length > 0 ||
    d.startingSoon.length > 0 ||
    d.awaitingConfirmation.length > 0 ||
    d.offlineChargers.length > 0 ||
    d.chargersNeedingPhotos.length > 0 ||
    (isLender && d.kycStatus === 'not_started' && d.draftChargers.length > 0) ||
    (isLender && (d.kycStatus === 'rejected' || d.kycStatus === 'resubmission_required'));

  const hasContinue = d.draftChargers.length > 0;

  return (
    <div
      className="min-h-screen bg-surface-page"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">

        {/* 1. Greeting */}
        <h1 className="text-2xl font-medium text-ink mb-6">
          {timeGreeting()}, {firstName}
        </h1>

        {/* 2. Live Summary */}
        <section className="space-y-3 mb-6">

          {/* Driver: charging session in progress */}
          {isDriver && d.inProgress && (
            <Link
              href={`/bookings/${d.inProgress.id}`}
              className="block bg-green rounded-token-lg px-4 py-4 hover:bg-green-deep transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">
                    Charging
                  </p>
                  <p className="text-base font-semibold text-white">
                    {d.inProgress.charger?.title ?? 'Charger'}
                  </p>
                  <p className="text-sm text-white/70 mt-0.5">
                    Started {fmtTime(d.inProgress.scheduled_start)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                  <span className="text-xs text-white/70 font-medium">Live</span>
                </div>
              </div>
            </Link>
          )}

          {/* Driver: upcoming confirmed bookings */}
          {isDriver && d.upcoming.length > 0 && (
            <div className="bg-surface-card border border-border rounded-token-lg divide-y divide-border overflow-hidden">
              {d.upcoming.slice(0, 2).map(b => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Calendar className="w-4 h-4 text-green shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {b.charger?.title ?? 'Upcoming booking'}
                    </p>
                    <p className="text-xs text-muted">
                      {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-green shrink-0">
                    {timeFromNow(b.scheduled_start)}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Driver: no activity yet */}
          {isDriver && !d.inProgress && d.upcoming.length === 0 && (
            <Link
              href="/chargers"
              className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
            >
              <div className="w-9 h-9 rounded-token bg-green-soft flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">Find a charger near you</p>
                <p className="text-xs text-muted">Browse home chargers on the map</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </Link>
          )}

          {/* Lender: stat tiles */}
          {isLender && (
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/lender/chargers?filter=active"
                className="bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <p className="font-mono text-2xl font-bold text-ink">{d.liveCount}</p>
                <p className="text-xs text-muted mt-0.5">Live chargers</p>
              </Link>
              <Link
                href="/lender/bookings"
                className="bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
              >
                <p className="font-mono text-2xl font-bold text-ink">{d.todayBookingCount}</p>
                <p className="text-xs text-muted mt-0.5">Bookings today</p>
              </Link>
            </div>
          )}

          {/* Lender: first-time — no chargers at all */}
          {isLender && d.liveCount === 0 && d.draftChargers.length === 0 && (
            <Link
              href="/lender/chargers/new"
              className="flex items-center gap-3 bg-surface-card border border-border rounded-token-lg px-4 py-4 hover:bg-surface-page transition-colors"
            >
              <div className="w-9 h-9 rounded-token bg-copper-soft flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-copper" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">List your charger</p>
                <p className="text-xs text-muted">Start earning with your home charger</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </Link>
          )}

        </section>

        {/* 3. Attention Required — hidden when empty */}
        {hasAttention && (
          <section className="mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3 h-3 text-copper" />
              <p className="text-xs font-semibold text-copper tracking-wider uppercase">
                Needs attention
              </p>
            </div>
            <div className="bg-surface-card border border-border rounded-token-lg divide-y divide-border overflow-hidden">

              {/* Lender: pending booking requests */}
              {d.pendingBookings.map(b => (
                <Link
                  key={b.id}
                  href={`/lender/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Booking request</p>
                    <p className="text-xs text-muted truncate">
                      {b.chargerTitle ?? 'Charger'}
                      {b.driverName ? ` · ${b.driverName}` : ''}
                      {' · '}
                      {fmtDate(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              ))}

              {/* Driver: booking starts within 45 min */}
              {d.startingSoon.map(b => (
                <Link
                  key={`soon-${b.id}`}
                  href={`/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <Clock className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      Starts {timeFromNow(b.scheduled_start)}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {b.charger?.title ?? 'Charger'} · {fmtTime(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              ))}

              {/* Driver: host confirmed, driver yet to acknowledge */}
              {d.awaitingConfirmation.map(b => (
                <Link
                  key={`adc-${b.id}`}
                  href={`/bookings/${b.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-green mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Booking confirmed by host</p>
                    <p className="text-xs text-muted truncate">
                      {b.charger?.title ?? 'Charger'} · {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              ))}

              {/* Lender: KYC not started, has draft chargers waiting to publish */}
              {isLender && d.kycStatus === 'not_started' && d.draftChargers.length > 0 && (
                <Link
                  href="/profile"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Verification needed</p>
                    <p className="text-xs text-muted">
                      Complete KYC to publish your{' '}
                      {d.draftChargers.length === 1 ? 'charger' : `${d.draftChargers.length} chargers`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              )}

              {/* Lender: KYC rejected or needs resubmission */}
              {isLender && (d.kycStatus === 'rejected' || d.kycStatus === 'resubmission_required') && (
                <Link
                  href="/profile"
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Verification not approved</p>
                    <p className="text-xs text-muted">Update your details in Profile and resubmit</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              )}

              {/* Lender: suspended chargers */}
              {d.offlineChargers.map(c => (
                <Link
                  key={`offline-${c.id}`}
                  href={`/lender/chargers/${c.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Charger offline</p>
                    <p className="text-xs text-muted truncate">{c.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              ))}

              {/* Lender: draft listings with no photos */}
              {d.chargersNeedingPhotos.map(c => (
                <Link
                  key={`photos-${c.id}`}
                  href={`/lender/chargers/${c.id}/edit`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-page transition-colors"
                >
                  <AlertCircle className="w-4 h-4 text-copper mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Listing needs photos</p>
                    <p className="text-xs text-muted truncate">{c.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                </Link>
              ))}

            </div>
          </section>
        )}

        {/* 4. Continue — hidden when empty */}
        {hasContinue && (
          <section className="mb-6">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-muted mb-3">
              Continue
            </p>
            <div className="bg-surface-card border border-border rounded-token-lg divide-y divide-border overflow-hidden">
              {d.draftChargers.map(c => (
                <Link
                  key={c.id}
                  href={`/lender/chargers/${c.id}/edit`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-surface-page transition-colors"
                >
                  <Zap className="w-4 h-4 text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Draft listing</p>
                    <p className="text-xs text-muted truncate">{c.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 5. Hosting Preview — lender / both only */}
        {isLender && (
          <section className="mb-6">
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
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                <div className="px-4 py-4">
                  <p className="font-mono text-base font-bold text-ink tabular-nums">
                    {formatINR(d.weekEarningsPaise)}
                  </p>
                  <p className="text-xs text-muted mt-0.5">This week</p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-mono text-2xl font-bold text-ink">{d.liveCount}</p>
                  <p className="text-xs text-muted mt-0.5">Live</p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-mono text-2xl font-bold text-ink">{d.upcomingLenderCount}</p>
                  <p className="text-xs text-muted mt-0.5">Upcoming</p>
                </div>
              </div>
              <Link
                href="/lender/dashboard"
                className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-page transition-colors"
              >
                <span className="text-sm font-semibold text-ink">Open Hosting Workspace</span>
                <ArrowRight className="w-4 h-4 text-muted" />
              </Link>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
