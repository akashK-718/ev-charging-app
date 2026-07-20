'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReviewEntry = {
  id: string;
  booking_id: string;
  flagged_at: string;
  status: 'pending' | 'resolved';
  resolution: string | null;
  admin_notes: string | null;
  booking: {
    id: string;
    status: string;
    scheduled_start: string;
    scheduled_end: string | null;
    started_at: string | null;
    end_initiated_at: string | null;
    driver_name: string | null;
    lender_name: string | null;
    charger_title: string | null;
  } | null;
};

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function elapsedMins(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

function ResolvePanel({ entryId, onResolved }: {
  entryId: string;
  onResolved: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState<'completed' | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(resolution: 'completed' | 'cancelled') {
    setLoading(resolution);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review-queue/${entryId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, admin_notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Admin notes (optional)…"
        rows={2}
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green/30"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => resolve('completed')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-green text-white text-sm font-semibold hover:bg-green/90 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          {loading === 'completed' ? 'Completing…' : 'Complete session'}
        </button>
        <button
          onClick={() => resolve('cancelled')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="w-4 h-4 shrink-0" />
          {loading === 'cancelled' ? 'Cancelling…' : 'Cancel session'}
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ entry, onResolved }: { entry: ReviewEntry; onResolved: () => void }) {
  const b = entry.booking;
  const now = new Date().toISOString();
  const stuckMins  = b?.end_initiated_at ? elapsedMins(b.end_initiated_at, now) : null;
  const sessionMins = b?.started_at && b?.end_initiated_at
    ? elapsedMins(b.started_at, b.end_initiated_at)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl bg-amber-50 grid place-items-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm truncate">{b?.charger_title ?? 'Charger'}</p>
          <p className="text-xs text-muted mt-0.5">
            Driver: {b?.driver_name ?? '—'} · Host: {b?.lender_name ?? '—'}
          </p>
        </div>
        {entry.status === 'resolved' && (
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
            entry.resolution === 'completed' ? 'bg-green-soft text-green' : 'bg-danger-soft text-danger',
          )}>
            {entry.resolution === 'completed' ? 'Completed' : 'Cancelled'}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted uppercase tracking-wider font-semibold text-[10px]">Scheduled</p>
          <p className="text-ink mt-0.5">{b ? fmtDatetime(b.scheduled_start) : '—'}</p>
        </div>
        <div>
          <p className="text-muted uppercase tracking-wider font-semibold text-[10px]">Session started</p>
          <p className="text-ink mt-0.5">{b?.started_at ? fmtDatetime(b.started_at) : '—'}</p>
        </div>
        <div>
          <p className="text-muted uppercase tracking-wider font-semibold text-[10px]">End requested</p>
          <p className="text-ink mt-0.5">{b?.end_initiated_at ? fmtDatetime(b.end_initiated_at) : '—'}</p>
        </div>
        <div>
          <p className="text-muted uppercase tracking-wider font-semibold text-[10px]">Flagged at</p>
          <p className="text-ink mt-0.5">{fmtDatetime(entry.flagged_at)}</p>
        </div>
      </div>

      {(sessionMins !== null || stuckMins !== null) && (
        <div className="mt-3 flex flex-wrap gap-3">
          {sessionMins !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Session ran for {sessionMins} min
            </div>
          )}
          {stuckMins !== null && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Stuck for {stuckMins} min
            </div>
          )}
        </div>
      )}

      {entry.status === 'pending' && (
        <ResolvePanel entryId={entry.id} onResolved={onResolved} />
      )}

      {entry.admin_notes && (
        <p className="mt-3 text-xs text-muted border-t border-gray-100 pt-3">
          <span className="font-semibold">Notes: </span>{entry.admin_notes}
        </p>
      )}
    </div>
  );
}

export default function AdminReviewQueuePage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'pending' | 'resolved'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review-queue');
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = entries.filter(e => e.status === tab);
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  return (
    <main className="min-h-screen px-4 py-8 space-y-5 max-w-2xl mx-auto">
      <div>
        <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">Admin · Review queue</p>
        <h1 className="font-display font-extrabold text-2xl text-ink mt-1">Session review queue</h1>
        <p className="text-sm text-muted mt-1">
          Sessions stuck in "awaiting end confirmation" — cannot be auto-completed without hardware telemetry.
        </p>
      </div>

      <div className="flex gap-2">
        {(['pending', 'resolved'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 h-9 rounded-full text-sm font-semibold border transition-colors',
              tab === t
                ? 'bg-green text-white border-green'
                : 'bg-white text-ink border-gray-200 hover:bg-gray-50',
            )}
          >
            {t === 'pending' ? 'Pending' : 'Resolved'}
            {t === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted py-8 text-center">Loading…</p>
      ) : displayed.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle className="w-10 h-10 text-green mx-auto mb-3" />
          <p className="font-semibold text-ink">
            {tab === 'pending' ? 'No pending reviews' : 'No resolved reviews yet'}
          </p>
          {tab === 'pending' && (
            <p className="text-sm text-muted mt-1">All sessions resolved — nothing needs action.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-10">
          {displayed.map(entry => (
            <ReviewCard key={entry.id} entry={entry} onResolved={load} />
          ))}
        </div>
      )}
    </main>
  );
}
