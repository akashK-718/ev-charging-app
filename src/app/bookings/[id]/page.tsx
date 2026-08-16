'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Phone, MapPin, Clock, ShieldCheck, Download } from 'lucide-react';
import { StatusBadge } from '@/components/bookings/StatusBadge';
import { BookingTimeline } from '@/components/bookings/BookingTimeline';
import { SessionControls } from '@/components/bookings/SessionControls';
import { DriverRatingSection } from '@/components/bookings/DriverRatingSection';
import { MilestoneParticles } from '@/components/ui/MilestoneParticles';
import { RoutineSuccess } from '@/components/ui/RoutineSuccess';
import { Button } from '@/components/ui/Button';
import { haptic } from '@/lib/haptics';
import { checkDriverFirstSession, MILESTONE_LABEL, type MilestoneEvent } from '@/lib/milestones';
import { formatPhoneForDisplay, formatPhoneForCall } from '@/lib/phone';
import { ACTIVE_BOOKING_STATUSES, FREE_CANCEL_MINUTES, FREE_CANCEL_WINDOW_MINUTES, type BookingStatus } from '@/lib/constants';
import { normalizeAddress } from '@/lib/utils';

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
  payment: {
    gross_amount: number;
    platform_fee: number;
    lender_payout: number;
    status: string;
    created_at: string;
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    payment_method: string | null;
    card_network: string | null;
    card_last4: string | null;
  } | null;
};

function formatDuration(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 1000 / 60 / 60);
  const m = Math.floor((diffMs / 1000 / 60) % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatPaymentMethod(method: string | null, network: string | null, last4: string | null): string | null {
  if (!method) return null;
  if (method === 'card' && network && last4) return `${network} •••• ${last4}`;
  if (method === 'card') return 'Card';
  if (method === 'upi') return 'UPI';
  if (method === 'wallet') return 'Wallet';
  if (method === 'netbanking') return 'Net Banking';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function formatPaymentDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
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
  const [activeMilestone, setActiveMilestone] = useState<MilestoneEvent | null>(null);
  const prevStatusRef = useRef<string | null>(null);

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

  // Detect status transition to completed — fire milestone check on first session
  useEffect(() => {
    if (!booking) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = booking.status;
    if (prev === null || prev === booking.status) return;

    if (booking.status === 'completed' && prev !== 'completed') {
      void checkDriverFirstSession().then(m => { if (m) setActiveMilestone(m); });
    }
  }, [booking?.status]);

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
        <StatusBadge
          status={booking.status}
          label={booking.status === 'awaiting_driver_confirmation' ? 'Awaiting your confirmation' : undefined}
        />
      </div>

      {/* Milestone celebration — only fires for the fixed milestone list */}
      {activeMilestone && (
        <div className="relative rounded-xl bg-green-soft border border-green/20 overflow-hidden">
          <RoutineSuccess
            message={MILESTONE_LABEL[activeMilestone]}
            className="py-6"
          />
          <MilestoneParticles onComplete={() => setActiveMilestone(null)} />
        </div>
      )}

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
              className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 border-red-100 active:scale-[0.96]"
              onClick={() => { haptic('heavy'); void handleCancel(); }}
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
        {booking.charger?.address && booking.confirmed_at ? (
          ['confirmed', 'awaiting_driver_confirmation', 'in_progress'].includes(booking.status) ? (
            <Link
              href={`/lender/chargers/${booking.charger_id}/map?readonly=true`}
              className="flex items-center gap-1.5 text-xs text-volt-deep font-semibold tap-target"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{normalizeAddress(booking.charger.address)}</span>
              <span className="shrink-0">View on map →</span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{normalizeAddress(booking.charger.address)}</span>
            </div>
          )
        ) : !booking.confirmed_at ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
            Approximate location — exact address shared after booking confirmed.
          </p>
        ) : null}
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
              {' \u00B7 '}
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
            href={formatPhoneForCall(booking.lender.phone)}
            className="flex items-center gap-1 text-xs text-volt-deep font-semibold"
          >
            <Phone className="w-3 h-3" />
            {formatPhoneForDisplay(booking.lender.phone)}
          </a>
        )}
        {!booking.lender?.phone && booking.status === 'pending' && (
          <p className="text-xs text-muted">Contact details shown once confirmed.</p>
        )}
      </div>

      {/* Payment Receipt */}
      {booking.payment && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-volt-deep" />
              Payment Receipt
            </h2>
            <a
              href={`/api/bookings/${booking.id}/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-volt-deep hover:text-volt-deep/80 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>

          {/* Amount — primary info */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">Amount paid</span>
            <span className="text-lg font-semibold text-ink">
              ₹{(booking.payment.gross_amount / 100).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Payment method — omit if unavailable (historical payments) */}
          {formatPaymentMethod(booking.payment.payment_method, booking.payment.card_network, booking.payment.card_last4) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Payment method</span>
              <span className="text-ink font-medium">
                {formatPaymentMethod(booking.payment.payment_method, booking.payment.card_network, booking.payment.card_last4)}
              </span>
            </div>
          )}

          {/* Booking reference */}
          <div className="flex justify-between text-sm">
            <span className="text-muted">Booking reference</span>
            <span className="font-mono text-ink">{booking.confirmation_code}</span>
          </div>

          {/* Payment date */}
          <div className="flex justify-between text-sm">
            <span className="text-muted">Payment date</span>
            <span className="text-ink">{formatPaymentDate(booking.payment.created_at)}</span>
          </div>

          {/* Razorpay reference IDs — muted, secondary, support/audit use */}
          {(booking.payment.razorpay_payment_id || booking.payment.razorpay_order_id) && (
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <p className="text-[10px] text-muted/70">Reference numbers (for support)</p>
              {booking.payment.razorpay_payment_id && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Payment ID</span>
                  <span className="font-mono text-muted">{booking.payment.razorpay_payment_id}</span>
                </div>
              )}
              {booking.payment.razorpay_order_id && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Order ID</span>
                  <span className="font-mono text-muted">{booking.payment.razorpay_order_id}</span>
                </div>
              )}
            </div>
          )}
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
