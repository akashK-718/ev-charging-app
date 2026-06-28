'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Phone, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { BOOKING_AUTO_CANCEL_MINUTES } from '@/lib/constants';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-volt-soft text-volt-deep',
  active: 'bg-blue-50 text-blue-700',
  completed: 'bg-gray-100 text-muted',
  cancelled: 'bg-red-50 text-red-700',
  disputed: 'bg-orange-50 text-orange-700',
};

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
  cancellation_reason: string | null;
  confirmation_code: string;
  created_at: string;
  charger: { id: string; title: string; address: string } | null;
  driver: { id: string; name: string | null; phone: string | null } | null;
  payment: {
    gross_amount: number;
    platform_fee: number;
    lender_payout: number;
    status: string;
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

function useCountdown(createdAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!createdAt) return;

    function update() {
      const deadline = new Date(createdAt!).getTime() + BOOKING_AUTO_CANCEL_MINUTES * 60 * 1000;
      const diff = deadline - Date.now();
      setRemaining(Math.max(0, diff));
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return remaining;
}

export default function LenderBookingDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const id = params.id;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const remaining = useCountdown(booking?.status === 'pending' ? booking.created_at : null);

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lender/bookings/${id}`);
      if (!res.ok) {
        setError('Booking not found');
        return;
      }
      const body = await res.json() as { data: BookingDetail };
      setBooking(body.data);
    } catch {
      setError('Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  async function handleAccept() {
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/lender/bookings/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to accept');
        return;
      }
      await fetchBooking();
    } catch {
      setActionError('Failed to accept booking');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejection.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/lender/bookings/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        setActionError(b.error ?? 'Failed to reject');
        return;
      }
      router.push('/lender/bookings');
    } catch {
      setActionError('Failed to reject booking');
    } finally {
      setActionLoading(false);
    }
  }

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

  const isPending = booking.status === 'pending';
  const isConfirmedOrLater = ['confirmed', 'active', 'completed', 'cancelled', 'disputed'].includes(booking.status);

  // Format countdown
  let countdownDisplay = '';
  if (remaining !== null && isPending) {
    const totalSeconds = Math.floor(remaining / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    countdownDisplay = `${m}:${String(s).padStart(2, '0')}`;
    const isExpired = remaining === 0;
    if (isExpired) countdownDisplay = 'Expired';
  }

  const driverName = booking.driver?.name ?? 'Driver';
  const driverInitials = driverName
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <main className="min-h-screen px-6 py-10 space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-ink">Booking</h1>
          <p className="text-xs text-muted mt-1 font-mono">{booking.confirmation_code}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-muted'}`}>
          {booking.status}
        </span>
      </div>

      {/* Pending countdown warning */}
      {isPending && remaining !== null && (
        <div className={cn(
          'px-4 py-3 rounded-2xl border',
          remaining === 0
            ? 'bg-red-50 border-red-200 text-red-700'
            : remaining < 5 * 60 * 1000
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-yellow-50 border-yellow-200 text-yellow-700',
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-semibold">
                {remaining === 0
                  ? 'Acceptance window expired'
                  : 'Time to accept'}
              </p>
            </div>
            {remaining > 0 && (
              <span className="font-display font-bold text-lg tabular-nums">{countdownDisplay}</span>
            )}
          </div>
          {remaining > 0 && (
            <p className="text-xs mt-1 opacity-80">
              Accept or reject within {BOOKING_AUTO_CANCEL_MINUTES} minutes of booking creation.
            </p>
          )}
        </div>
      )}

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

      {/* Driver info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="font-semibold text-sm text-ink">Driver</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-volt-soft flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-sm text-ink">{driverInitials}</span>
          </div>
          <div>
            {isConfirmedOrLater ? (
              <>
                <p className="font-semibold text-ink text-sm">{driverName}</p>
                {booking.driver?.phone && (
                  <a
                    href={`tel:${booking.driver.phone}`}
                    className="flex items-center gap-1 text-xs text-volt-deep font-semibold mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    {booking.driver.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="font-semibold text-ink text-sm">
                {driverName.split(' ').length >= 2
                  ? `${driverName.split(' ')[0]} ${driverName.split(' ').slice(-1)[0][0]}.`
                  : driverName}
              </p>
            )}
          </div>
        </div>
        {!isConfirmedOrLater && (
          <p className="text-xs text-muted">Full contact details shown after accepting.</p>
        )}
      </div>

      {/* Payment breakdown */}
      {booking.payment && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink">Earnings breakdown</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Session total</span>
              <span className="font-semibold text-ink">₹{(booking.payment.gross_amount / 100).toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Platform fee (15%)</span>
              <span className="text-muted">−₹{(booking.payment.platform_fee / 100).toFixed(0)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1.5 mt-1">
              <span className="font-semibold text-ink">Your share</span>
              <span className="font-display font-bold text-lg text-ink">
                ₹{(booking.payment.lender_payout / 100).toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {actionError && (
        <div className="px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {actionError}
        </div>
      )}

      {isPending && !showRejectForm && (
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="lg"
            disabled={actionLoading || remaining === 0}
            className="flex items-center gap-2 justify-center"
            onClick={() => { void handleAccept(); }}
          >
            <CheckCircle2 className="w-5 h-5" />
            {actionLoading ? 'Accepting…' : 'Accept booking'}
          </Button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowRejectForm(true)}
            className="w-full flex items-center gap-2 justify-center px-6 py-4 rounded-2xl text-lg font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
            Reject booking
          </button>
        </div>
      )}

      {isPending && showRejectForm && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-ink" htmlFor="reject_reason">
              Reason for rejection
            </label>
            <textarea
              id="reject_reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Charger unavailable for that time slot"
              className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => { setShowRejectForm(false); setRejectReason(''); setActionError(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={actionLoading || !rejectReason.trim()}
              className="flex-1"
              onClick={() => { void handleReject(); }}
            >
              {actionLoading ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
          </div>
        </div>
      )}

      {booking.status === 'confirmed' && (
        <div className="px-4 py-3 bg-volt-soft rounded-2xl border border-volt">
          <p className="font-semibold text-ink text-sm">Booking confirmed</p>
          <p className="text-xs text-muted mt-1">
            The driver will arrive at the scheduled time. Contact them above if needed.
          </p>
        </div>
      )}

      {booking.status === 'cancelled' && booking.cancellation_reason && (
        <div className="px-4 py-3 bg-gray-50 rounded-2xl">
          <p className="text-sm font-semibold text-muted">Cancellation reason</p>
          <p className="text-sm text-ink mt-0.5">{booking.cancellation_reason}</p>
        </div>
      )}

      {booking.status === 'completed' && (
        <div className="px-4 py-3 bg-gray-50 rounded-2xl">
          <p className="text-sm font-semibold text-ink">Session completed</p>
          {booking.kwh_delivered && (
            <p className="text-xs text-muted mt-0.5">{booking.kwh_delivered} kWh delivered</p>
          )}
        </div>
      )}
    </main>
  );
}
