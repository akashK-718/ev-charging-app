'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PAYOUT_HOLD_HOURS } from '@/lib/constants';

type PayoutTab = 'pending' | 'processed' | 'all';

type PendingItem = {
  booking_id: string;
  scheduled_start: string;
  scheduled_end: string;
  charger_title: string | null;
  gross_amount: number;
  platform_fee: number;
  lender_payout: number;
};

type ProcessedPayout = {
  id: string;
  amount_paise: number;
  status: string;
  bank_or_upi: string;
  booking_ids: string[];
  created_at: string;
  processed_at: string | null;
};

type PayoutData = {
  pending: {
    items: PendingItem[];
    total_paise: number;
    count: number;
  };
  processed: ProcessedPayout[];
  tab: string;
};

const TABS: { key: PayoutTab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'processed', label: 'Processed' },
  { key: 'all', label: 'All' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function LenderPayoutsPage() {
  const [activeTab, setActiveTab] = useState<PayoutTab>('pending');
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: PayoutTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lender/payouts?tab=${tab}`);
      if (!res.ok) { setError('Failed to load payouts'); return; }
      const body = await res.json() as PayoutData;
      setData(body);
    } catch {
      setError('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(activeTab);
  }, [activeTab, fetchData]);

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl text-ink mb-6">Payouts</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              activeTab === tab.key
                ? 'bg-ink text-white'
                : 'bg-gray-100 text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-muted">Loading…</div>}

      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── Pending tab ─────────────────────────────────────────── */}
          {(activeTab === 'pending' || activeTab === 'all') && (
            <div className="space-y-4 mb-8">
              {activeTab === 'pending' && (
                <h2 className="font-semibold text-lg text-ink">Pending payout</h2>
              )}
              {activeTab === 'all' && (
                <h2 className="font-semibold text-base text-muted uppercase tracking-wide text-xs">Pending</h2>
              )}

              {data.pending.count === 0 ? (
                <p className="text-sm text-muted py-4">No pending payouts.</p>
              ) : (
                <>
                  {/* Summary card */}
                  <div className="bg-volt-soft rounded-2xl border border-volt p-4">
                    <p className="text-sm text-muted">Total pending</p>
                    <p className="font-display font-extrabold text-3xl text-ink mt-0.5">
                      ₹{(data.pending.total_paise / 100).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Across {data.pending.count} booking{data.pending.count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Hold period notice */}
                  <div className="px-4 py-3 bg-blue-50 rounded-2xl text-sm text-blue-700">
                    Payouts are released {PAYOUT_HOLD_HOURS} hours after session completion.
                  </div>

                  {/* Pending items list */}
                  <div className="space-y-2">
                    {data.pending.items.map(item => (
                      <div
                        key={item.booking_id}
                        className="bg-white rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-ink text-sm">
                              {item.charger_title ?? 'Charger'}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {formatDate(item.scheduled_start)}
                            </p>
                          </div>
                          <p className="font-display font-bold text-ink">
                            ₹{(item.lender_payout / 100).toFixed(0)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                          <span>Session: ₹{(item.gross_amount / 100).toFixed(0)}</span>
                          <span>·</span>
                          <span>Fee: −₹{(item.platform_fee / 100).toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Processed tab ───────────────────────────────────────── */}
          {(activeTab === 'processed' || activeTab === 'all') && (
            <div className="space-y-3">
              {activeTab === 'processed' && (
                <h2 className="font-semibold text-lg text-ink">Processed payouts</h2>
              )}
              {activeTab === 'all' && (
                <h2 className="font-semibold text-xs text-muted uppercase tracking-wide">Processed</h2>
              )}

              {data.processed.length === 0 ? (
                <p className="text-sm text-muted py-4">No processed payouts yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.processed.map(payout => (
                    <div
                      key={payout.id}
                      className="bg-white rounded-2xl border border-gray-100 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-display font-bold text-ink">
                            ₹{(payout.amount_paise / 100).toFixed(0)}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {payout.processed_at ? formatDate(payout.processed_at) : '—'}
                            {' · '}
                            {payout.booking_ids.length} booking{payout.booking_ids.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-muted">
                          processed
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-2 font-mono truncate">
                        {payout.bank_or_upi}
                      </p>
                      <p className="text-xs text-muted mt-0.5 font-mono">
                        Ref: {payout.id.slice(0, 8)}…
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
