'use client';

import { useEffect, useState } from 'react';
import { Zap, Square, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SESSION_GRACE_MINUTES } from '@/lib/constants';

interface SessionControlsProps {
  bookingId: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
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
  onUpdated,
  userRole,
}: SessionControlsProps) {
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (status !== 'confirmed' && status !== 'awaiting_driver_confirmation' && status !== 'in_progress') return null;

  const graceMs = SESSION_GRACE_MINUTES * 60 * 1000;
  const windowStart = new Date(scheduledStart).getTime() - graceMs;
  const windowEnd = new Date(scheduledEnd).getTime() + graceMs;
  const canStart = now >= windowStart && now <= windowEnd;

  async function handleAction(action: 'start' | 'end') {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setError(body.error ?? `Failed to ${action} session`);
        return;
      }
      await onUpdated();
    } catch {
      setError(`Failed to ${action} session`);
    } finally {
      setLoading(false);
    }
  }

  // ── confirmed ──────────────────────────────────────────────────────────────
  if (status === 'confirmed') {
    if (userRole === 'lender') {
      return (
        <div className="space-y-2">
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          {canStart ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={loading}
              className="flex items-center gap-2 justify-center"
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
      <div className="px-4 py-3 bg-amber-50 rounded-2xl border border-amber-200">
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
          <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
            <p className="text-sm font-semibold text-blue-700">Lender has started the session</p>
            <p className="text-xs text-blue-600 mt-1">Confirm to begin charging.</p>
          </div>
          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          <Button
            variant="secondary"
            size="lg"
            disabled={loading}
            className="flex items-center gap-2 justify-center"
            onClick={() => { void handleAction('start'); }}
          >
            <Zap className="w-5 h-5" />
            {loading ? 'Confirming…' : 'Confirm start'}
          </Button>
        </div>
      );
    }

    // Lender — waiting for driver to confirm
    return (
      <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
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
  const expectedEndMs = new Date(scheduledEnd).getTime() - now;
  const elapsedMs = now - new Date(startedAt ?? scheduledStart).getTime();

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-blue-50 rounded-2xl border border-blue-200">
        <p className="text-sm font-semibold text-blue-700">Session in progress</p>
        <p className="text-xs text-blue-600 mt-1">
          Elapsed {formatClock(elapsedMs)}
          {expectedEndMs > 0 && ` · Expected end in ${formatClock(expectedEndMs)}`}
        </p>
      </div>
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      <Button
        variant="secondary"
        size="lg"
        disabled={loading}
        className="flex items-center gap-2 justify-center"
        onClick={() => { void handleAction('end'); }}
      >
        <Square className="w-5 h-5" />
        {loading ? 'Ending…' : 'End session'}
      </Button>
    </div>
  );
}
