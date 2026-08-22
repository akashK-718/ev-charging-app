'use client';

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { haptic } from '@/lib/haptics';
import { normalizeAddress } from '@/lib/utils';

const NOMINAL_KW: Record<string, number> = {
  AC_3kW: 3.3,
  'AC_3.3kW': 3.3,
  AC_7kW: 7,
  AC_22kW: 22,
  DC_fast: 50,
};

const POLL_MS = 5000;

type BookingSession = {
  id: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  end_initiated_at: string | null;
  charger: {
    id: string;
    title: string;
    address: string;
    price_per_kwh: number;
    charger_type: string;
  } | null;
  payment: { gross_amount: number } | null;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  return formatElapsed(ms);
}

// SVG battery ring constants
const RING_R = 88;
const RING_STROKE = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function BatteryRing({ progress, animating }: { progress: number; animating: boolean }) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clampedProgress);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={220}
        height={220}
        viewBox="0 0 220 220"
        className="-rotate-90"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={110}
          cy={110}
          r={RING_R}
          fill="none"
          stroke="#1c2e22"
          strokeWidth={RING_STROKE}
        />
        {/* Fill arc */}
        <circle
          cx={110}
          cy={110}
          r={RING_R}
          fill="none"
          stroke="#10d96a"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        {/* Glow — subtle duplicate at lower opacity */}
        {animating && (
          <circle
            cx={110}
            cy={110}
            r={RING_R}
            fill="none"
            stroke="#10d96a"
            strokeWidth={RING_STROKE + 6}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            opacity={0.12}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        )}
      </svg>
    </div>
  );
}

function LiveSessionContent() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const bookingId = params.id;

  const [booking, setBooking] = useState<BookingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [geoWarning, setGeoWarning] = useState<string | null>(null);
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

  // Poll while active
  useEffect(() => {
    if (!booking) return;
    const active = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(booking.status);
    if (!active) return;
    const t = setInterval(() => void fetchBooking(false), POLL_MS);
    return () => clearInterval(t);
  }, [booking, fetchBooking]);

  // When status leaves active states, redirect back to booking detail
  useEffect(() => {
    if (!booking) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = booking.status;
    if (prev === null) return;

    const wasActive = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(prev);
    const isNowTerminal = ['completed', 'cancelled', 'no_show', 'auto_rejected', 'rejected'].includes(booking.status);
    if (wasActive && isNowTerminal) {
      router.replace(`/bookings/${bookingId}`);
    }
  }, [booking?.status, bookingId, router]);

  // ── Derived session state ────────────────────────────────────────────────────
  const nominalKw = useMemo(() => {
    const type = booking?.charger?.charger_type ?? '';
    return NOMINAL_KW[type] ?? 7;
  }, [booking?.charger?.charger_type]);

  const sessionStartMs = booking?.started_at
    ? new Date(booking.started_at).getTime()
    : null;
  const scheduledEndMs = booking ? new Date(booking.scheduled_end).getTime() : null;
  const scheduledDurationMs = booking
    ? new Date(booking.scheduled_end).getTime() - new Date(booking.scheduled_start).getTime()
    : null;

  const elapsedMs = sessionStartMs && booking?.status === 'in_progress'
    ? Math.max(0, now - sessionStartMs)
    : sessionStartMs && booking?.status === 'awaiting_end_confirmation'
      ? Math.max(0, (booking.end_initiated_at ? new Date(booking.end_initiated_at).getTime() : now) - sessionStartMs)
      : 0;

  const remainingMs = scheduledEndMs
    ? Math.max(0, scheduledEndMs - now)
    : 0;

  const progress = scheduledDurationMs && scheduledDurationMs > 0
    ? Math.min(1, elapsedMs / scheduledDurationMs)
    : 0;

  const estimatedKwh = nominalKw * (elapsedMs / 3600000);
  const estimatedCost = booking?.charger?.price_per_kwh
    ? Math.round(booking.charger.price_per_kwh * estimatedKwh)
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

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-[#08110c] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-[#1c2e22] border-t-green animate-spin" />
      </div>
    );
  }

  // Redirect guard — if user lands on this page for a non-active booking
  const isActive = ['awaiting_driver_confirmation', 'in_progress', 'awaiting_end_confirmation'].includes(booking.status);
  if (!isActive) {
    return (
      <div className="min-h-screen bg-[#08110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white/60 text-sm">This session has ended.</p>
        <Link href={`/bookings/${bookingId}`} className="text-green text-sm font-semibold">
          View booking details
        </Link>
      </div>
    );
  }

  const chargerName = booking.charger?.title ?? 'Charger';
  const chargerAddress = booking.charger?.address ? normalizeAddress(booking.charger.address) : null;

  return (
    <main className="min-h-screen bg-[#08110c] flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2">
        <Link
          href={`/bookings/${bookingId}`}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors tap-light"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-semibold">Booking</span>
        </Link>
        <div className="text-right max-w-[60%]">
          <p className="text-white/90 text-xs font-semibold truncate">{chargerName}</p>
          {chargerAddress && (
            <div className="flex items-center gap-0.5 justify-end">
              <MapPin className="w-2.5 h-2.5 text-white/40 shrink-0" />
              <p className="text-white/40 text-[10px] truncate">{chargerAddress}</p>
            </div>
          )}
        </div>
      </div>

      {/* Central ring + clock */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <div className="relative">
          <BatteryRing progress={progress} animating={isInProgress} />

          {/* Overlaid text inside ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {isInProgress ? (
              <>
                <p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase">Elapsed</p>
                <p className="text-4xl font-bold tabular-nums text-white leading-none tracking-tight">
                  {formatElapsed(elapsedMs)}
                </p>
                <p className="text-xs text-white/40">
                  {remainingMs > 0 ? `${formatRemaining(remainingMs)} left` : 'Slot ended'}
                </p>
              </>
            ) : isAwaitingDriverConfirm ? (
              <>
                <p className="text-3xl font-bold text-white">⚡</p>
                <p className="text-xs font-semibold text-white/60 text-center px-8">Plug in and confirm</p>
              </>
            ) : (
              // awaiting_end_confirmation
              <>
                <p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase">Session</p>
                <p className="text-2xl font-bold text-white">Complete</p>
                <p className="text-xs text-white/40">Confirm below</p>
              </>
            )}
          </div>
        </div>

        {/* Stat tiles */}
        {isInProgress && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">kWh</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">
                {estimatedKwh.toFixed(2)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Rate</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">
                {booking.charger?.price_per_kwh != null
                  ? `₹${booking.charger.price_per_kwh}`
                  : '—'}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Est. cost</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">
                {estimatedCost != null ? `₹${estimatedCost}` : '—'}
              </p>
            </div>
          </div>
        )}

        {isAwaitingEndConfirm && elapsedMs > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Duration</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">
                {formatElapsed(elapsedMs)}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Est. cost</p>
              <p className="text-lg font-bold tabular-nums text-white mt-0.5">
                {estimatedCost != null ? `₹${estimatedCost}` : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA area */}
      <div className="px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] space-y-3">
        {/* Status / instruction text */}
        {isInProgress && (
          <p className="text-center text-xs text-white/40">
            The lender will end the session when your slot concludes
          </p>
        )}

        {isAwaitingDriverConfirm && (
          <p className="text-center text-xs text-white/50">
            The lender has started the session — plug in your vehicle and confirm to begin charging
          </p>
        )}

        {isAwaitingEndConfirm && (
          <p className="text-center text-xs text-white/50">
            The lender has ended the session
          </p>
        )}

        {geoWarning && (
          <p className="text-center text-xs text-amber-400">{geoWarning}</p>
        )}

        {actionError && (
          <p className="text-center text-xs text-red-400 font-semibold">{actionError}</p>
        )}

        {isAwaitingDriverConfirm && (
          <PrimaryButton
            size="lg"
            loading={actionLoading}
            onClick={() => { void confirmStart(); }}
          >
            Confirm start
          </PrimaryButton>
        )}

        {isAwaitingEndConfirm && (
          <PrimaryButton
            size="lg"
            loading={actionLoading}
            onClick={() => { void confirmEnd(); }}
          >
            Confirm end
          </PrimaryButton>
        )}

        {isInProgress && (
          <Link
            href={`/bookings/${bookingId}`}
            className="block text-center text-xs text-white/30 py-2 hover:text-white/50 transition-colors"
          >
            View booking details
          </Link>
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
      <LiveSessionContent />
    </Suspense>
  );
}
