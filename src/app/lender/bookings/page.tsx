'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/bookings/StatusBadge';

type FilterTab = 'active' | 'past' | 'cancelled' | 'all';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
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

export default function LenderBookingsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (filter: FilterTab, withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lender/bookings?filter=${filter}`);
      if (!res.ok) {
        setError('Failed to load bookings');
        return;
      }
      const body = await res.json() as { data: BookingRow[] };
      setBookings(body.data ?? []);
    } catch {
      setError('Failed to load bookings');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBookings(activeTab);
  }, [activeTab, fetchBookings]);

  useEffect(() => {
    if (activeTab !== 'active') return;
    const interval = setInterval(() => { void fetchBookings(activeTab, false); }, POLL_MS);
    return () => clearInterval(interval);
  }, [activeTab, fetchBookings]);

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl text-ink mb-6">Bookings</h1>

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

      {loading && (
        <div className="text-center py-12 text-muted">Loading…</div>
      )}

      {error && !loading && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">
            {activeTab === 'all' ? 'No bookings yet.' : `No ${activeTab} bookings.`}
          </p>
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
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
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
