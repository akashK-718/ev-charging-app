'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/bookings/StatusBadge';
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from '@/lib/constants';

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
  confirmation_code: string;
  created_at: string;
  charger: { id: string; title: string; address: string } | null;
};

const POLL_MS = 10000;

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (filter: FilterTab, withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings?filter=${filter}`);
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

  // Poll while viewing the Active tab — pending/confirmed/in_progress bookings change state server-side
  useEffect(() => {
    if (activeTab !== 'active') return;
    const interval = setInterval(() => { void fetchBookings(activeTab, false); }, POLL_MS);
    return () => clearInterval(interval);
  }, [activeTab, fetchBookings]);

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="text-2xl font-medium text-ink mb-6">Your bookings</h1>

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
        <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {error}
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">
            {activeTab === 'all' ? 'No bookings yet.' : `No ${activeTab} bookings.`}
          </p>
          <Link href="/explore" className="inline-block mt-3 text-sm font-semibold text-volt-deep hover:underline">
            Find a charger
          </Link>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <div className="space-y-2">
          {bookings.map(booking => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-colors tap-target"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm truncate">
                  {booking.charger?.title ?? 'Charger'}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short',
                  })}{' '}
                  {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })}
                  {ACTIVE_BOOKING_STATUSES.includes(booking.status as BookingStatus) && (
                    <span className="font-mono ml-1">· {booking.confirmation_code}</span>
                  )}
                </p>
              </div>
              <StatusBadge status={booking.status} className="ml-3 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
