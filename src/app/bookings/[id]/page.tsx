'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Phone, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/bookings/StatusBadge';
import { BookingTimeline } from '@/components/bookings/BookingTimeline';
import { SessionControls } from '@/components/bookings/SessionControls';
import { ACTIVE_BOOKING_STATUSES, type BookingStatus } from '@/lib/constants';

type BookingDetail = {
  id: string;
  charger_id: string;
  driver_id: string;
  lender_id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  kwh_delivered: number | null;
  status: string;
  confirmation_code: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  charger: { id: string; title: string; address: string; photos: string[] } | null;
  lender: { id: string; name: string | null; phone: string | null } | null;
  payment: { gross_amount: number; platform_fee: number; lender_payout: number; status: string } | null;
};

function formatDuration(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 1000 / 60 / 60);
  const m = Math.floor((diffMs / 1000 / 60) % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const POLL_MS = 10000;

export default function BookingDetailPage() {
  const params = useParams() as { id: string };
  const id = params.id;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`);
      if (!res.ok) {
        setError('Booking not found');
        return;
      }
      const body = await res.json() as { data: BookingDetail };
      setBooking(body.data);
    } catch {
      setError('Failed to load booking');
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  // Poll every 10s while the booking is in an active state
  useEffect(() => {
    if (!booking || !ACTIVE_BOOKING_STATUSES.includes(booking.status as BookingStatus)) return;
    const interval = setInterval(() => { void fetchBooking(false); }, POLL_MS);
    return () => clearInterval(interval);
  }, [booking, fetchBooking]);

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading…</div>;
  }

  if (error || !booking) {
    return (
      <main className="px-6 py-10">
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {error ?? 'Booking not found'}
        </div>
      </main>
    );
  }

  const lenderName = booking.lender?.name ?? 'Lender';

  return (
    <main className="min-h-screen px-6 py-10 space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-ink">Booking</h1>
          <p className="text-xs text-muted mt-1 font-mono">{booking.confirmation_code}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Status messages */}
      {booking.status === 'pending' && (
        <div className="px-4 py-3 bg-amber-50 rounded-2xl border border-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            <p className="text-sm font-semibold text-amber-700">Awaiting lender confirmation</p>
          </div>
          <p className="text-xs text-amber-700/80 mt-1">
            We&apos;ll notify you as soon as the lender responds, usually within 30 minutes.
          </p>
        </div>
      )}

      {booking.status === 'confirmed' && (
        <div className="px-4 py-3 bg-green-50 rounded-2xl border border-green-200">
          <p className="text-sm font-semibold text-green-700">Confirmed! Charger details below.</p>
        </div>
      )}

      {(booking.status === 'rejected' || booking.status === 'auto_rejected') && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-200">
          <p className="text-sm font-semibold text-red-700">Booking was declined. Refund initiated.</p>
          {booking.rejection_reason && (
            <p className="text-xs text-red-700/80 mt-1">{booking.rejection_reason}</p>
          )}
        </div>
      )}

      {booking.status === 'completed' && (
        <div className="px-4 py-3 bg-gray-50 rounded-2xl space-y-1">
          <p className="text-sm font-semibold text-ink">
            Session completed at {booking.ended_at ? new Date(booking.ended_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
          </p>
          {booking.started_at && booking.ended_at && (
            <p className="text-xs text-muted">Duration: {formatDuration(booking.started_at, booking.ended_at)}</p>
          )}
          {booking.payment && (
            <p className="text-xs text-muted">Amount: ₹{(booking.payment.gross_amount / 100).toFixed(0)}</p>
          )}
        </div>
      )}

      {/* Session controls (start/end) */}
      <SessionControls
        bookingId={booking.id}
        status={booking.status}
        scheduledStart={booking.scheduled_start}
        scheduledEnd={booking.scheduled_end}
        startedAt={booking.started_at}
        onUpdated={() => fetchBooking(false)}
      />

      {/* Charger info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-sm text-ink">Charger</h2>
        <p className="font-semibold text-ink">{booking.charger?.title ?? '—'}</p>
        {booking.charger?.address && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{booking.charger.address}</span>
          </div>
        )}
      </div>

      {/* Time slot */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-sm text-ink">Time slot</h2>
        <div className="flex items-center gap-2 text-sm text-ink">
          <Clock className="w-4 h-4 text-muted shrink-0" />
          <div>
            <p className="font-semibold">
              {new Date(booking.scheduled_start).toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
              })}
            </p>
            <p className="text-muted text-xs">
              {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true,
              })}
              {' → '}
              {new Date(booking.scheduled_end).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true,
              })}
              {' · '}
              {formatDuration(booking.scheduled_start, booking.scheduled_end)}
            </p>
          </div>
        </div>
      </div>

      {/* Lender info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-sm text-ink">Lender</h2>
        <p className="font-semibold text-ink text-sm">{lenderName}</p>
        {booking.lender?.phone && (
          <a
            href={`tel:${booking.lender.phone}`}
            className="flex items-center gap-1 text-xs text-volt-deep font-semibold"
          >
            <Phone className="w-3 h-3" />
            {booking.lender.phone}
          </a>
        )}
        {!booking.lender?.phone && booking.status === 'pending' && (
          <p className="text-xs text-muted">Contact details shown once confirmed.</p>
        )}
      </div>

      {/* Payment */}
      {booking.payment && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-volt-deep" />
            Payment
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Amount paid</span>
            <span className="font-semibold text-ink">₹{(booking.payment.gross_amount / 100).toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h2 className="font-semibold text-sm text-ink mb-3">Timeline</h2>
        <BookingTimeline booking={booking} />
      </div>
    </main>
  );
}
