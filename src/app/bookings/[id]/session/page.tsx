'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StarRating } from '@/components/bookings/StarRating';
import { haptic } from '@/lib/haptics';
import { computeSessionEstimate } from '@/lib/bookings/session-estimate';

const POLL_MS = 5000;

type BookingSession = {
  id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  end_initiated_at: string | null;
  constraint_type: 'duration' | 'budget' | null;
  constraint_value: number | null;
  charger: {
    id: string;
    title: string;
    address: string;
    price_per_kwh: number;
    charger_type: string;
  } | null;
  lender: {
    id: string;
    name: string | null;
  } | null;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function chargerPowerLabel(chargerType: string): string {
  const map: Record<string, string> = {
    'AC_3.3kW': '3.3 kW AC',
    'AC_7kW': '7 kW AC',
    'AC_22kW': '22 kW AC',
    'DC_fast': '50 kW DC',
  };
  return map[chargerType] ?? chargerType;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

// SVG ring constants
const RING_R = 88;
const RING_STROKE = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function SessionRing({ progress, animating }: { progress: number; animating: boolean }) {
  const p = Math.min(1, Math.max(0, progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - p);
  return (
    <svg width={220} height={220} viewBox="0 0 220 220" className="-rotate-90" aria-hidden>
      <circle cx={110} cy={110} r={RING_R} fill="none" stroke="#1c2e22" strokeWidth={RING_STROKE} />
      <circle
        cx={110} cy={110} r={RING_R}
        fill="none" stroke="#10d96a" strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
      {animating && (
        <circle
          cx={110} cy={110} r={RING_R}
          fill="none" stroke="#10d96a" strokeWidth={RING_STROKE + 6}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          opacity={0.12}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      )}
    </svg>
  );
}

type View = 'live' | 'complete' | 'rating';

function SessionContent() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const bookingId = params.id;

  const [booking, setBooking] = useState<BookingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('live');
  const [finalElapsedMs, setFinalElapsedMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [geoWarning, setGeoWarning] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const fetchBooking = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) return;
      const body = await res.json() as { data: BookingSession };
      setBooking(body.data);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { void fetchBooking(); }, [fetchBooking]);

  // 1-second ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll while in live view with active booking status
  useEffect(() => {
    if (!booking || view !== 'live') return;
    const active = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(booking.status);
    if (!active) return;
    const t = setInterval(() => void fetchBooking(false), POLL_MS);
    return () => clearInterval(t);
  }, [booking, view, fetchBooking]);

  // Redirect when booking moves to a terminal state externally (e.g., lender cancels, auto-complete sweep)
  useEffect(() => {
    if (!booking || view !== 'live') return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = booking.status;
    if (prev === null) return;
    const wasActive = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(prev);
    const isNowTerminal = ['completed', 'cancelled', 'no_show', 'auto_rejected', 'rejected'].includes(booking.status);
    if (wasActive && isNowTerminal) {
      router.replace(`/bookings/${bookingId}`);
    }
  }, [booking?.status, bookingId, router, view]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const sessionStartMs = booking?.started_at ? new Date(booking.started_at).getTime() : null;
  const scheduledDurationMs = booking
    ? new Date(booking.scheduled_end).getTime() - new Date(booking.scheduled_start).getTime()
    : null;

  const elapsedMs: number = (() => {
    if (!sessionStartMs || !booking) return 0;
    if (booking.status === 'in_progress') return Math.max(0, now - sessionStartMs);
    if (booking.status === 'awaiting_end_confirmation') {
      const endInitMs = booking.end_initiated_at ? new Date(booking.end_initiated_at).getTime() : now;
      return Math.max(0, endInitMs - sessionStartMs);
    }
    return 0;
  })();

  const progress = scheduledDurationMs && scheduledDurationMs > 0
    ? Math.min(1, elapsedMs / scheduledDurationMs)
    : 0;

  const estimate = booking?.charger
    ? computeSessionEstimate(booking.charger.charger_type, booking.charger.price_per_kwh, elapsedMs)
    : null;

  const finalEstimate = booking?.charger
    ? computeSessionEstimate(booking.charger.charger_type, booking.charger.price_per_kwh, finalElapsedMs)
    : null;

  // Budget advisory thresholds (advisory only — never blocks or auto-completes)
  const budgetRupees = booking?.constraint_type === 'budget' ? (booking.constraint_value ?? null) : null;
  const budgetPct = budgetRupees && estimate ? estimate.estimatedCostRupees / budgetRupees : 0;
  const budgetWarning: 'approaching' | 'reached' | null =
    budgetRupees == null ? null
    : budgetPct >= 1 ? 'reached'
    : budgetPct >= 0.8 ? 'approaching'
    : null;

  const isInProgress = booking?.status === 'in_progress';
  const isAwaitingDriverConfirm = booking?.status === 'awaiting_driver_confirmation';
  const isAwaitingEndConfirm = booking?.status === 'awaiting_end_confirmation';

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function confirmStart() {
    setGeoWarning(null);
    setActionError(null);
    let coords: { latitude: number; longitude: number } | undefined;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
        );
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        setGeoWarning('Could not verify your location — proceeding anyway');
      }
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/start`, {
        method: 'POST',
        ...(coords ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(coords) } : {}),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string; distance_m?: number; radius_km?: number };
        if (typeof body.distance_m === 'number' && typeof body.radius_km === 'number') {
          setActionError(`You're ${(body.distance_m / 1000).toFixed(2)}km away — must be within ${body.radius_km}km`);
        } else {
          setActionError(body.error ?? 'Failed to confirm start');
        }
        haptic('error');
        return;
      }
      haptic('success');
      await fetchBooking(false);
    } catch {
      setActionError('Failed to confirm start');
      haptic('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function stopCharging() {
    const snapElapsed = elapsedMs;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/end`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setActionError(body.error ?? 'Failed to stop charging');
        haptic('error');
        return;
      }
      haptic('heavy');
      setFinalElapsedMs(snapElapsed);
      setView('complete');
    } catch {
      setActionError('Failed to stop charging');
      haptic('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmEnd() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/end`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setActionError(body.error ?? 'Failed to confirm end');
        haptic('error');
        return;
      }
      haptic('heavy');
      router.replace(`/bookings/${bookingId}`);
    } catch {
      setActionError('Failed to confirm end');
      haptic('error');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitRating() {
    if (rating === 0) return;
    setRatingLoading(true);
    try {
      await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charger_rating: rating, lender_rating: rating }),
      });
    } finally {
      router.replace(`/bookings/${bookingId}`);
    }
  }

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08110c] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-[#1c2e22] border-t-green animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#08110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white/60 text-sm">Booking not found.</p>
        <Link href="/activity" className="text-green text-sm font-semibold">Go to Activity</Link>
      </div>
    );
  }

  const isActive = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(booking.status);

  if (view === 'live' && !isActive) {
    return (
      <div className="min-h-screen bg-[#08110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white/60 text-sm">This session has ended.</p>
        <Link href={`/bookings/${bookingId}`} className="text-green text-sm font-semibold">View booking</Link>
      </div>
    );
  }

  const chargerName = booking.charger?.title ?? 'Charger';
  const lenderName = booking.lender?.name ?? 'Your host';

  // ── Render: SESSION COMPLETE view ────────────────────────────────────────────
  if (view === 'complete') {
    const kwh = finalEstimate?.estimatedKwh ?? 0;
    const cost = finalEstimate?.estimatedCostRupees ?? 0;
    const duration = formatElapsed(finalElapsedMs);
    const rate = booking.charger?.price_per_kwh ?? 0;
    const power = booking.charger ? chargerPowerLabel(booking.charger.charger_type) : '';

    return (
      <main className="min-h-screen bg-[#08110c] flex flex-col select-none">
        <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2">
          <div />
          <button
            onClick={() => router.replace(`/bookings/${bookingId}`)}
            className="size-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white/90 tap-light"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          <div className="text-center space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green">Session complete</p>
            <p className="text-white/60 text-sm truncate max-w-[240px]">{chargerName}</p>
          </div>

          {/* Cost card */}
          <div className="w-full max-w-xs bg-white/5 rounded-3xl p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-5xl font-bold tabular-nums text-white">~₹{cost}</p>
              <p className="text-xs text-white/40">Estimated total</p>
            </div>
            <div className="h-px bg-white/10" />
            <div className="text-center space-y-1">
              <p className="text-sm text-white/60 tabular-nums">
                ~{kwh.toFixed(2)} kWh&ensp;·&ensp;{duration}&ensp;·&ensp;₹{rate}/kWh
              </p>
              <p className="text-xs text-white/30">{power}</p>
            </div>
            <p className="text-[10px] text-white/25 text-center leading-relaxed">
              Estimated from rated charger power — not measured from hardware telemetry
            </p>
          </div>
        </div>

        <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <PrimaryButton
            size="lg"
            onClick={() => setView('rating')}
          >
            Done
          </PrimaryButton>
        </div>
      </main>
    );
  }

  // ── Render: RATING view ──────────────────────────────────────────────────────
  if (view === 'rating') {
    return (
      <main className="min-h-screen bg-[#08110c] flex flex-col select-none">
        <div className="flex items-center justify-end px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2">
          <button
            onClick={() => router.replace(`/bookings/${bookingId}`)}
            className="size-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white/90 tap-light"
            aria-label="Skip rating"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          {/* Host avatar */}
          <div className="size-16 rounded-full bg-green/20 border border-green/30 grid place-items-center">
            <span className="text-xl font-bold text-green">{initials(booking.lender?.name)}</span>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-white">How was your session?</p>
            <p className="text-sm text-white/50">at {chargerName} with {lenderName}</p>
          </div>

          <StarRating value={rating} onChange={setRating} size="md" />
        </div>

        <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] space-y-3">
          <PrimaryButton
            size="lg"
            disabled={rating === 0}
            loading={ratingLoading}
            onClick={() => { void submitRating(); }}
          >
            Submit rating
          </PrimaryButton>
          <button
            onClick={() => router.replace(`/bookings/${bookingId}`)}
            className="block w-full text-center text-sm text-white/30 py-2 hover:text-white/50 transition-colors"
          >
            Skip
          </button>
        </div>
      </main>
    );
  }

  // ── Render: LIVE view ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#08110c] flex flex-col select-none">
      {/* Top bar: X dismiss (no API call) + charger name */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2">
        <button
          onClick={() => router.replace(`/bookings/${bookingId}`)}
          className="size-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white/90 tap-light"
          aria-label="Back to booking"
        >
          <X className="size-4" />
        </button>
        <p className="text-white/70 text-xs font-semibold truncate max-w-[60%] text-right">{chargerName}</p>
      </div>

      {/* Budget advisory banner */}
      {budgetWarning === 'reached' && (
        <div className="mx-5 mb-2 rounded-xl px-4 py-2.5 bg-red-900/60 border border-red-500/30">
          <p className="text-sm font-semibold text-red-300 text-center">
            ₹{budgetRupees} budget reached — tap Stop charging when ready
          </p>
        </div>
      )}
      {budgetWarning === 'approaching' && (
        <div className="mx-5 mb-2 rounded-xl px-4 py-2.5 bg-amber-900/40 border border-amber-500/20">
          <p className="text-sm font-semibold text-amber-300 text-center">
            Approaching your ₹{budgetRupees} budget
          </p>
        </div>
      )}

      {/* Central ring + label */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <div className="relative">
          <SessionRing progress={isInProgress ? progress : isAwaitingEndConfirm ? 1 : 0} animating={isInProgress} />

          {/* Text inside ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {isInProgress && (
              <>
                <p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase">Elapsed</p>
                <p className="text-4xl font-bold tabular-nums text-white leading-none tracking-tight">
                  {formatElapsed(elapsedMs)}
                </p>
              </>
            )}
            {isAwaitingDriverConfirm && (
              <>
                <p className="text-3xl font-bold text-white">⚡</p>
                <p className="text-xs font-semibold text-white/50 text-center px-8">Plug in and confirm</p>
              </>
            )}
            {isAwaitingEndConfirm && (
              <>
                <p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase">Session</p>
                <p className="text-2xl font-bold text-white">Ended</p>
                <p className="text-xs text-white/40">Confirm below</p>
              </>
            )}
          </div>

          {/* "Session progress" label below ring */}
          {isInProgress && (
            <p className="absolute -bottom-6 inset-x-0 text-center text-[10px] font-semibold text-white/30 tracking-wider uppercase">
              Session progress
            </p>
          )}
        </div>

        {/* Stat tiles — in_progress only */}
        {isInProgress && estimate && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-4">
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[9px] text-white/35 font-semibold uppercase tracking-wider">Estimated</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">~{estimate.estimatedKwh.toFixed(2)}</p>
              <p className="text-[9px] text-white/35 mt-0.5">kWh</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[9px] text-white/35 font-semibold uppercase tracking-wider">Elapsed</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">{formatElapsed(elapsedMs)}</p>
              <p className="text-[9px] text-white/35 mt-0.5">time</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[9px] text-white/35 font-semibold uppercase tracking-wider">Estimated</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">~₹{estimate.estimatedCostRupees}</p>
              <p className="text-[9px] text-white/35 mt-0.5">cost</p>
            </div>
          </div>
        )}

        {/* Summary tiles — awaiting_end_confirmation */}
        {isAwaitingEndConfirm && estimate && elapsedMs > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-4">
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[9px] text-white/35 font-semibold uppercase tracking-wider">Duration</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">{formatElapsed(elapsedMs)}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[9px] text-white/35 font-semibold uppercase tracking-wider">Estimated</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">~₹{estimate.estimatedCostRupees}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] space-y-3">
        {isAwaitingDriverConfirm && (
          <p className="text-center text-xs text-white/40">
            Your host has started the session — plug in and confirm to begin charging
          </p>
        )}
        {isAwaitingEndConfirm && (
          <p className="text-center text-xs text-white/40">
            Your host has ended the session
          </p>
        )}
        {geoWarning && (
          <p className="text-center text-xs text-amber-400">{geoWarning}</p>
        )}
        {actionError && (
          <p className="text-center text-xs text-red-400 font-semibold">{actionError}</p>
        )}

        {isAwaitingDriverConfirm && (
          <PrimaryButton size="lg" loading={actionLoading} onClick={() => { void confirmStart(); }}>
            Start charging
          </PrimaryButton>
        )}

        {isInProgress && (
          <PrimaryButton size="lg" loading={actionLoading} onClick={() => { void stopCharging(); }}>
            Stop charging
          </PrimaryButton>
        )}

        {isAwaitingEndConfirm && (
          <PrimaryButton size="lg" loading={actionLoading} onClick={() => { void confirmEnd(); }}>
            Confirm end
          </PrimaryButton>
        )}
      </div>
    </main>
  );
}

export default function LiveSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08110c] flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-2 border-[#1c2e22] border-t-green animate-spin" />
        </div>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
