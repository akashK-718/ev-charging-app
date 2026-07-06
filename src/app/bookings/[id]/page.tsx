'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Phone, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/bookings/StatusBadge';
import { BookingTimeline } from '@/components/bookings/BookingTimeline';
import { SessionControls } from '@/components/bookings/SessionControls';
import { DriverRatingSection } from '@/components/bookings/DriverRatingSection';
import { Button } from '@/components/ui/Button';
import { ACTIVE_BOOKING_STATUSES, FREE_CANCEL_MINUTES, FREE_CANCEL_WINDOW_MINUTES, type BookingStatus } from '@/lib/constants';

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
  end_initiated_at: string | null;
  no_show_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  charger: { id: string; title: string; address: string; photos: string[] } | null;
  lender: { id: string; name: string | null; phone: string | null } | null;
  payment: { gross_amount: number; platform_fee: number; lender_payout: number; status: string; created_at: string } | null;
};

function formatDuration(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 1000 / 60 / 60);
  const m = Math.floor((diffMs / 1000 / 60) % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const POLL_MS = 10000;

export default function BookingDetailPage() {
  const params = useParams() as { id: string };
  const id = params.id;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  useEffect(() => { void fetchBooking(); }, [fetchBooking]);

  // Poll every 10s while active
  useEffect(() => {
    if (!booking || !ACTIVE_BOOKING_STATUSES.includes(booking.status as BookingStatus)) return;
    const interval = setInterval(() => { void fetchBooking(false); }, POLL_MS);
    return () => clearInterval(interval);
  }, [booking, fetchBooking]);

  // 1-second ticker for countdown
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleCancel() {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setCancelError(body.error ?? 'Failed to cancel booking');
        return;
      }
      setShowCancelConfirm(false);
      await fetchBooking(false);
    } catch {
      setCancelError('Failed to cancel booking');
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading…</div>;
  }

  if (error || !booking) {
    return (
      <main className="px-6 py-10">
        <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {error ?? 'Booking not found'}
        </div>
      </main>
    );
  }

  const lenderName = booking.lender?.name ?? 'Lender';
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

  // Free window calculation
  const paymentCreatedMs = booking.payment?.created_at
    ? new Date(booking.payment.created_at).getTime()
    : null;
  const freeWindowEndMs = paymentCreatedMs
    ? paymentCreatedMs + FREE_CANCEL_WINDOW_MINUTES * 60 * 1000
    : null;
  const freeWindowRemainingMs = freeWindowEndMs
    ? Math.max(0, freeWindowEndMs - nowMs)
    : 0;
  const inFreeWindow = freeWindowRemainingMs > 0;

  // Refund policy outside free window
  const minutesToStart = (new Date(booking.scheduled_start).getTime() - nowMs) / 60000;
  const fullRefundOutsideWindow = minutesToStart > FREE_CANCEL_MINUTES;

  return (
    <main className="min-h-screen px-6 py-10 space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">Booking</h1>
          <p className="text-xs text-muted mt-1 font-mono">{booking.confirmation_code}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Status messages */}
      {booking.status === 'pending' && (
        <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
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
        <div className="px-4 py-3 bg-green-50 rounded-xl border border-green-200">
          <p className="text-sm font-semibold text-green-700">Confirmed! Head to the charger — the lender will start the session.</p>
        </div>
      )}

      {booking.status === 'awaiting_driver_confirmation' && (
        <div className="px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm font-semibold text-blue-700">Lender has started the session — confirm below to begin charging.</p>
        </div>
      )}


      {(booking.status === 'rejected' || booking.status === 'auto_rejected') && (
        <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm font-semibold text-red-700">Booking was declined. Refund initiated.</p>
          {booking.rejection_reason && (
            <p className="text-xs text-red-700/80 mt-1">{booking.rejection_reason}</p>
          )}
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-ink">Booking cancelled.</p>
          {booking.cancellation_reason === 'driver_late_cancel' ? (
            <p className="text-xs text-muted mt-1">No refund — cancelled within {FREE_CANCEL_MINUTES} minutes of the slot.</p>
          ) : (
            <p className="text-xs text-muted mt-1">Refund has been initiated.</p>
          )}
        </div>
      )}

      {booking.status === 'completed' && (
        <DriverRatingSection
          bookingId={booking.id}
          chargerTitle={booking.charger?.title ?? '—'}
          startedAt={booking.started_at}
          endedAt={booking.ended_at}
          paymentPaise={booking.payment?.gross_amount ?? null}
        />
      )}

      {/* Session controls (start/end) */}
      <SessionControls
        bookingId={booking.id}
        status={booking.status}
        scheduledStart={booking.scheduled_start}
        scheduledEnd={booking.scheduled_end}
        startedAt={booking.started_at}
        endInitiatedAt={booking.end_initiated_at}
        onUpdated={() => fetchBooking(false)}
        userRole="driver"
      />

      {/* Cancel section */}
      {canCancel && !showCancelConfirm && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="w-full text-sm font-semibold text-red-600 hover:text-red-700 py-2 transition-colors"
        >
          {inFreeWindow
            ? `Cancel for free (${formatCountdown(freeWindowRemainingMs)} remaining)`
            : 'Cancel booking'}
        </button>
      )}

      {canCancel && showCancelConfirm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {inFreeWindow ? (
            <>
              <p className="text-sm font-semibold text-ink">Cancel this booking?</p>
              <p className="text-xs text-muted">
                You&apos;re within the free cancellation window — you&apos;ll get a full refund.
                {' '}Window closes in {formatCountdown(freeWindowRemainingMs)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">Cancellation policy</p>
              {fullRefundOutsideWindow ? (
                <p className="text-xs text-muted">
                  You&apos;re cancelling more than {FREE_CANCEL_MINUTES} minutes before the slot — you&apos;ll receive a full refund.
                </p>
              ) : (
                <p className="text-xs text-red-600 font-semibold">
                  You&apos;re cancelling within {FREE_CANCEL_MINUTES} minutes of the slot — no refund will be issued.
                </p>
              )}
            </>
          )}
          {cancelError && (
            <p className="text-xs text-red-600 font-semibold">{cancelError}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="md"
              disabled={cancelLoading}
              onClick={() => { setShowCancelConfirm(false); setCancelError(null); }}
            >
              Keep booking
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={cancelLoading}
              className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 border-red-100"
              onClick={() => { void handleCancel(); }}
            >
              {cancelLoading ? 'Cancelling…' : 'Yes, cancel'}
            </Button>
          </div>
        </div>
      )}

      {/* Charger info */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-sm text-ink">Charger</h2>
        <p className="font-semibold text-ink">{booking.charger?.title ?? '—'}</p>
        {booking.confirmed_at ? (
          booking.charger?.address && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{booking.charger.address}</span>
            </div>
          )
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
            Approximate location — exact address shared after booking confirmed.
          </p>
        )}
      </div>

      {/* Time slot */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
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
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
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
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
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
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-semibold text-sm text-ink mb-3">Timeline</h2>
        <BookingTimeline booking={booking} />
      </div>
    </main>
  );
}
