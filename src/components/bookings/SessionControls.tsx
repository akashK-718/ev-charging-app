'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, Square, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RoutineSuccess } from '@/components/ui/RoutineSuccess';
import { haptic } from '@/lib/haptics';
import { SESSION_GRACE_MINUTES, SESSION_END_AUTO_COMPLETE_MINUTES } from '@/lib/constants';

interface SessionControlsProps {
  bookingId: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  endInitiatedAt?: string | null;
  onUpdated: () => void | Promise<void>;
  userRole: 'driver' | 'lender';
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SessionControls({
  bookingId,
  status,
  scheduledStart,
  scheduledEnd,
  startedAt,
  endInitiatedAt,
  onUpdated,
  userRole,
}: SessionControlsProps) {
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0); // increment to re-trigger shake animation
  const [geoWarning, setGeoWarning] = useState<string | null>(null);
  const [showEndSuccess, setShowEndSuccess] = useState(false);

  // Track status transitions for lifecycle haptics — only fire on real changes,
  // never on initial mount or when the same status is re-received via polling.
  const prevStatusRef = useRef<string>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === status) return; // no transition

    // Charging confirmed by driver → in_progress: success haptic on both screens
    if (status === 'in_progress' && prev === 'awaiting_driver_confirmation') {
      haptic('success');
    }

    // Lender ended session → awaiting driver end-confirm: heavy on driver screen
    if (status === 'awaiting_end_confirmation' && prev === 'in_progress' && userRole === 'driver') {
      haptic('heavy');
    }
  }, [status, userRole]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (
    status !== 'confirmed' &&
    status !== 'awaiting_driver_confirmation' &&
    status !== 'in_progress' &&
    status !== 'awaiting_end_confirmation'
  ) return null;

  if (showEndSuccess && userRole === 'driver') {
    return <RoutineSuccess message="Session ended — charging complete." className="py-4" />;
  }

  const graceMs = SESSION_GRACE_MINUTES * 60 * 1000;
  const windowStart = new Date(scheduledStart).getTime() - graceMs;
  const windowEnd = new Date(scheduledEnd).getTime() + graceMs;
  const canStart = now >= windowStart && now <= windowEnd;

  function setActionError(msg: string) {
    setError(msg);
    setErrorKey(k => k + 1); // triggers shake re-animation via key change
    haptic('error');
  }

  async function handleAction(action: 'start' | 'end', body?: Record<string, unknown>) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: 'POST',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const resBody = await res.json() as { error?: string; distance_m?: number; radius_km?: number };
        if (typeof resBody.distance_m === 'number' && typeof resBody.radius_km === 'number') {
          const distanceKm = (resBody.distance_m / 1000).toFixed(2);
          setActionError(`You're ${distanceKm}km away — must be within ${resBody.radius_km}km. Move closer to start.`);
        } else {
          setActionError(resBody.error ?? `Failed to ${action} session`);
        }
        return;
      }
      // Session start/end: heavy haptic — these are significant lifecycle moments.
      haptic('heavy');
      if (action === 'end' && userRole === 'driver') {
        setShowEndSuccess(true);
      }
      await onUpdated();
    } catch {
      setActionError(`Failed to ${action} session`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDriverConfirm() {
    setGeoWarning(null);
    setError(null);

    let coords: { latitude: number; longitude: number } | undefined;
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
        );
        coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      } catch {
        setGeoWarning('Could not verify your location');
      }
    } else {
      setGeoWarning('Could not verify your location');
    }

    void handleAction('start', coords);
  }

  // ── confirmed ──────────────────────────────────────────────────────────────
  if (status === 'confirmed') {
    if (userRole === 'lender') {
      return (
        <div className="space-y-2">
          {error && (
            <p key={errorKey} className="text-xs text-red-600 font-semibold shake-error">{error}</p>
          )}
          {canStart ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={loading}
              className="flex items-center gap-2 justify-center active:scale-[0.96]"
              onClick={() => { void handleAction('start'); }}
            >
              <Zap className="w-5 h-5" />
              {loading ? 'Starting…' : 'Start session'}
            </Button>
          ) : now < windowStart ? (
            <p className="text-xs text-muted text-center">
              Start session opens {SESSION_GRACE_MINUTES} minutes before the booked time.
            </p>
          ) : null}
        </div>
      );
    }

    // Driver — waiting for lender
    return (
      <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700" />
          <p className="text-sm font-semibold text-amber-700">Waiting for lender to start the session</p>
        </div>
        <p className="text-xs text-amber-700/80 mt-1">
          The lender will start the session when you arrive at the charger.
        </p>
      </div>
    );
  }

  // ── awaiting_driver_confirmation ───────────────────────────────────────────
  if (status === 'awaiting_driver_confirmation') {
    if (userRole === 'driver') {
      return (
        <div className="space-y-2">
          {geoWarning && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">{geoWarning}</p>
            </div>
          )}
          {error && (
            <p key={errorKey} className="text-xs text-red-600 font-semibold shake-error">{error}</p>
          )}
          <Button
            variant="secondary"
            size="lg"
            disabled={loading}
            className="justify-center active:scale-[0.96]"
            onClick={() => { void handleDriverConfirm(); }}
          >
            {loading ? 'Confirming…' : 'Confirm start'}
          </Button>
        </div>
      );
    }

    // Lender — waiting for driver to confirm
    return (
      <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-700" />
          <p className="text-sm font-semibold text-blue-700">Waiting for driver to confirm</p>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          Session starts once the driver confirms at the charger.
        </p>
      </div>
    );
  }

  // ── in_progress ────────────────────────────────────────────────────────────
  if (status === 'in_progress') {
    const expectedEndMs = new Date(scheduledEnd).getTime() - now;
    const elapsedMs = now - new Date(startedAt ?? scheduledStart).getTime();

    if (userRole === 'lender') {
      return (
        <div className="space-y-3">
          <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm font-semibold text-blue-700">Session in progress</p>
            <p className="text-xs text-blue-600 mt-1">
              Elapsed {formatClock(elapsedMs)}
              {expectedEndMs > 0 && ` · Expected end in ${formatClock(expectedEndMs)}`}
            </p>
          </div>
          {error && (
            <p key={errorKey} className="text-xs text-red-600 font-semibold shake-error">{error}</p>
          )}
          <Button
            variant="secondary"
            size="lg"
            disabled={loading}
            className="flex items-center gap-2 justify-center active:scale-[0.96]"
            onClick={() => { void handleAction('end'); }}
          >
            <Square className="w-5 h-5" />
            {loading ? 'Requesting end…' : 'End session'}
          </Button>
        </div>
      );
    }

    // Driver — session running, no end action
    return (
      <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
        <p className="text-sm font-semibold text-blue-700">Session in progress</p>
        <p className="text-xs text-blue-600 mt-1">
          Elapsed {formatClock(elapsedMs)}
          {expectedEndMs > 0 && ` · Expected end in ${formatClock(expectedEndMs)}`}
        </p>
      </div>
    );
  }

  // ── awaiting_end_confirmation ──────────────────────────────────────────────
  const autoCompleteMs = endInitiatedAt
    ? new Date(endInitiatedAt).getTime() + SESSION_END_AUTO_COMPLETE_MINUTES * 60 * 1000
    : now + SESSION_END_AUTO_COMPLETE_MINUTES * 60 * 1000;
  const remainingMs = Math.max(0, autoCompleteMs - now);

  const autoCompleteTime = new Date(autoCompleteMs).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (userRole === 'driver') {
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 bg-orange-50 rounded-xl border border-orange-200">
          <p className="text-sm font-semibold text-orange-700">
            Lender has ended the session — confirm below to complete your charge.
            {' '}Auto-completes at {autoCompleteTime} if not confirmed.
          </p>
        </div>
        {error && (
          <p key={errorKey} className="text-xs text-red-600 font-semibold shake-error">{error}</p>
        )}
        <Button
          variant="secondary"
          size="lg"
          disabled={loading}
          className="justify-center active:scale-[0.96]"
          onClick={() => { void handleAction('end'); }}
        >
          {loading ? 'Confirming…' : 'Confirm end'}
        </Button>
      </div>
    );
  }

  // Lender — waiting for driver to confirm end
  return (
    <div className="px-4 py-3 bg-orange-50 rounded-xl border border-orange-200">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-700" />
        <p className="text-sm font-semibold text-orange-700">Waiting for driver to confirm end</p>
      </div>
      <p className="text-xs text-orange-600 mt-1">
        Auto-completes in {formatClock(remainingMs)}.
      </p>
    </div>
  );
}
