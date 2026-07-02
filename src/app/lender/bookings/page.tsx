'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/bookings/StatusBadge';

type FilterTab = 'active' | 'past' | 'cancelled' | 'all';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'active',    label: 'Active' },
  { key: 'past',      label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all',       label: 'All' },
];

type BookingRow = {
  id: string;
  charger_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  charger_title: string | null;
  driver_display: string | null;
  payment: { lender_payout: number } | null;
  created_at: string;
};

const POLL_MS = 10000;

function formatDuration(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 1000 / 60 / 60);
  const m = Math.floor((diffMs / 1000 / 60) % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function LenderBookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chargerId = searchParams.get('charger');

  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [chargerTitle, setChargerTitle] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch charger title when filtering by charger
  useEffect(() => {
    if (!chargerId) { setChargerTitle(null); return; }
    fetch(`/api/chargers/${chargerId}`)
      .then(async res => {
        if (!res.ok) return;
        const body = await res.json() as { data: { title: string } };
        setChargerTitle(body.data?.title ?? null);
      })
      .catch(() => { /* non-fatal */ });
  }, [chargerId]);

  const fetchBookings = useCallback(async (filter: FilterTab, withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/lender/bookings', window.location.origin);
      url.searchParams.set('filter', filter);
      if (chargerId) url.searchParams.set('charger', chargerId);

      const res = await fetch(url.toString());
      if (!res.ok) { setError('Failed to load bookings'); return; }
      const body = await res.json() as { data: BookingRow[] };
      setBookings(body.data ?? []);
    } catch {
      setError('Failed to load bookings');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [chargerId]);

  useEffect(() => {
    void fetchBookings(activeTab);
  }, [activeTab, fetchBookings]);

  useEffect(() => {
    if (activeTab !== 'active') return;
    const interval = setInterval(() => { void fetchBookings(activeTab, false); }, POLL_MS);
    return () => clearInterval(interval);
  }, [activeTab, fetchBookings]);

  function clearChargerFilter() {
    router.replace('/lender/bookings');
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl text-ink mb-6">Bookings</h1>

      {/* Charger filter indicator */}
      {chargerId && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-volt-soft rounded-xl">
          <p className="text-sm font-semibold text-ink flex-1 truncate">
            {chargerTitle ? `Filtered: ${chargerTitle}` : 'Filtered by charger'}
          </p>
          <button
            type="button"
            onClick={clearChargerFilter}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/60 hover:bg-white transition-colors"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5 text-ink" />
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
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
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">{error}</div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">
            {activeTab === 'all' ? 'No bookings yet.' : `No ${activeTab} bookings.`}
          </p>
          {chargerId && (
            <button
              type="button"
              onClick={clearChargerFilter}
              className="mt-3 text-sm font-semibold text-volt-deep"
            >
              Show all chargers
            </button>
          )}
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <div className="space-y-2">
          {bookings.map(booking => (
            <Link
              key={booking.id}
              href={`/lender/bookings/${booking.id}`}
              className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm truncate">
                  {booking.charger_title ?? 'Charger'}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {booking.driver_display ?? 'Driver'} ·{' '}
                  {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short',
                  })}{' '}
                  {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                  {' · '}{formatDuration(booking.scheduled_start, booking.scheduled_end)}
                </p>
              </div>
              <div className="ml-3 flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={booking.status} />
                {booking.payment && (
                  <p className="text-xs font-semibold text-ink">
                    ₹{(booking.payment.lender_payout / 100).toFixed(0)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default function LenderBookingsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted">Loading…</div>}>
      <LenderBookingsContent />
    </Suspense>
  );
}
