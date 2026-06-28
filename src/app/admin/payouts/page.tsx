'use client';

import { useState, useEffect, useCallback } from 'react';

type PayoutRow = {
  id: string;
  user_id: string;
  amount_paise: number;
  status: string;
  bank_or_upi: string;
  booking_ids: string[];
  created_at: string;
  processed_at: string | null;
  lender: { id: string; name: string | null; phone: string } | null;
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payouts');
      if (!res.ok) { setError('Failed to load payouts'); return; }
      const body = await res.json() as { data: PayoutRow[] };
      setPayouts(body.data ?? []);
    } catch {
      setError('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPayouts(); }, [fetchPayouts]);

  async function handleMarkProcessed(id: string) {
    if (processing) return;
    setProcessing(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${id}/mark-processed`, { method: 'POST' });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to process payout');
        return;
      }
      // Remove from list
      setPayouts(prev => prev.filter(p => p.id !== id));
    } catch {
      setActionError('Failed to process payout');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl text-ink mb-2">Pending payouts</h1>
      <p className="text-muted mb-6">
        {!loading && payouts.length === 0
          ? 'No pending payouts.'
          : !loading
          ? `${payouts.length} payout${payouts.length !== 1 ? 's' : ''} awaiting processing`
          : ''}
      </p>

      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {actionError}
        </div>
      )}

      {loading && <div className="text-center py-12 text-muted">Loading…</div>}

      {!loading && error && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && payouts.length > 0 && (
        <div className="space-y-3">
          {payouts.map(payout => (
            <div key={payout.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm">
                    {payout.lender?.name ?? 'Unknown lender'}
                  </p>
                  <p className="text-xs text-muted">{payout.lender?.phone ?? '—'}</p>
                  <p className="font-display font-bold text-xl text-ink mt-2">
                    ₹{(payout.amount_paise / 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {payout.booking_ids.length} booking{payout.booking_ids.length !== 1 ? 's' : ''}
                    {' · '}
                    {new Date(payout.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-muted font-mono mt-1 truncate">{payout.bank_or_upi}</p>
                </div>
                <button
                  type="button"
                  disabled={processing === payout.id}
                  onClick={() => { void handleMarkProcessed(payout.id); }}
                  className="shrink-0 px-4 py-2 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/90 transition-colors disabled:opacity-50"
                >
                  {processing === payout.id ? 'Processing…' : 'Mark processed'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
