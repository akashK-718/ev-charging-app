'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { haptic } from '@/lib/haptics';
import { Calendar, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const NOMINAL_KW: Record<string, number> = {
  'AC_3.3kW': 3.3,
  'AC_7kW': 7,
  'AC_22kW': 22,
  'DC_fast': 50,
};

const DURATION_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hrs' },
  { minutes: 120, label: '2 hours' },
];

// Minimum selectable duration — matches the shortest preset.
const MIN_CUSTOM_DURATION_MINUTES = 30;

type Charger = {
  id: string;
  lender_id: string;
  title: string;
  charger_type: string;
  price_per_kwh: number;
  address: string;
  status: string;
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function defaultDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

export default function NewBookingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-muted">Loading…</p>
        </main>
      }
    >
      <NewBookingContent />
    </Suspense>
  );
}

function NewBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chargerId = searchParams.get('charger');

  const [charger, setCharger] = useState<Charger | null>(null);
  const [loadingCharger, setLoadingCharger] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { date: defaultDate, time: defaultTime } = useMemo(defaultDateTime, []);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);

  // Duration mode: 'preset' uses one of the fixed options; 'custom' lets the
  // driver pick an explicit end date+time (supports overnight bookings).
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  // Availability window fetched from server for the selected start time.
  const [maxEnd, setMaxEnd] = useState<Date | null>(null);
  const [maxEndReason, setMaxEndReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!chargerId) { setLoadError('No charger selected'); setLoadingCharger(false); return; }
    fetch(`/api/chargers/${chargerId}`)
      .then(res => res.json())
      .then((body: { data?: Charger; error?: string }) => {
        if (body.data) setCharger(body.data);
        else setLoadError(body.error ?? 'Charger not found');
      })
      .catch(() => setLoadError('Failed to load charger'))
      .finally(() => setLoadingCharger(false));
  }, [chargerId]);

  // Fetch the availability window (maxEnd) whenever the start date/time changes.
  // Debounced 400 ms so rapid typing doesn't flood the server.
  useEffect(() => {
    if (!chargerId) return;
    let cancelled = false;
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      const startIso = new Date(`${date}T${time}:00`).toISOString();
      fetch(
        `/api/chargers/${chargerId}/availability-window?start=${encodeURIComponent(startIso)}`,
        { signal: controller.signal },
      )
        .then(res => res.json())
        .then((body: { data?: { max_end: string; reason: string } }) => {
          if (!cancelled && body.data) {
            setMaxEnd(new Date(body.data.max_end));
            setMaxEndReason(body.data.reason);
          }
        })
        .catch(() => {
          // Fail open — the server independently revalidates on submission.
          if (!cancelled) { setMaxEnd(null); setMaxEndReason(''); }
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [chargerId, date, time]);

  const scheduledStart = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);

  const scheduledEnd = useMemo(() => {
    if (durationMode === 'custom' && customEndDate && customEndTime) {
      const parsed = new Date(`${customEndDate}T${customEndTime}:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(scheduledStart.getTime() + durationMinutes * 60000);
  }, [durationMode, customEndDate, customEndTime, scheduledStart, durationMinutes]);

  const effectiveDurationMinutes = useMemo(
    () => Math.max(0, (scheduledEnd.getTime() - scheduledStart.getTime()) / 60000),
    [scheduledEnd, scheduledStart],
  );

  const estimate = useMemo(() => {
    if (!charger) return null;
    const nominalKw = NOMINAL_KW[charger.charger_type] ?? 7;
    const kwh = Math.round(nominalKw * (effectiveDurationMinutes / 60) * 100) / 100;
    const grossRupees = Math.round(charger.price_per_kwh * kwh);
    return { kwh, grossRupees };
  }, [charger, effectiveDurationMinutes]);

  // True when maxEnd is so close to start that even the 30-minute minimum can't fit.
  const noAvailability = useMemo(
    () => maxEnd !== null && maxEnd <= new Date(scheduledStart.getTime() + MIN_CUSTOM_DURATION_MINUTES * 60000),
    [maxEnd, scheduledStart],
  );

  function isPresetDisabled(minutes: number): boolean {
    if (!maxEnd) return false;
    return scheduledStart.getTime() + minutes * 60000 > maxEnd.getTime();
  }

  function handlePresetSelect(minutes: number) {
    setDurationMode('preset');
    setDurationMinutes(minutes);
  }

  function handleSelectCustom() {
    setDurationMode('custom');
    if (!customEndDate || !customEndTime) {
      // Initialise to start + 1 hour, capped at maxEnd if available.
      const initialMs = scheduledStart.getTime() + 60 * 60000;
      const cappedMs = maxEnd ? Math.min(initialMs, maxEnd.getTime()) : initialMs;
      const initialEnd = new Date(cappedMs);
      setCustomEndDate(initialEnd.toISOString().slice(0, 10));
      setCustomEndTime(initialEnd.toTimeString().slice(0, 5));
    }
  }

  // Derived min/max values for the custom end date+time inputs.
  const minEnd = new Date(scheduledStart.getTime() + MIN_CUSTOM_DURATION_MINUTES * 60000);
  const minEndDate = minEnd.toISOString().slice(0, 10);
  const minEndTimeOnMinDate = minEnd.toTimeString().slice(0, 5);
  const maxEndDateStr = maxEnd ? maxEnd.toISOString().slice(0, 10) : undefined;
  const maxEndTimeOnMaxDate =
    maxEnd && customEndDate === maxEndDateStr
      ? maxEnd.toTimeString().slice(0, 5)
      : undefined;

  const customEndIsValid = useMemo(() => {
    if (durationMode !== 'custom') return true;
    if (!customEndDate || !customEndTime) return false;
    const end = new Date(`${customEndDate}T${customEndTime}:00`);
    if (isNaN(end.getTime())) return false;
    if (end < minEnd) return false;
    if (maxEnd && end > maxEnd) return false;
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMode, customEndDate, customEndTime, scheduledStart, maxEnd]);

  const canSubmit = !submitting && customEndIsValid && !noAvailability;

  async function handlePayAndBook() {
    if (!charger || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charger_id: charger.id,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
        }),
      });
      const orderBody = await orderRes.json() as { data?: Record<string, unknown>; error?: string };
      if (!orderRes.ok || !orderBody.data) {
        setSubmitError(orderBody.error ?? 'Could not start payment');
        setSubmitting(false);
        return;
      }
      const order = orderBody.data;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setSubmitError('Could not load payment gateway. Check your connection and try again.');
        setSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: 'Kirin',
        description: charger.title,
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          void (async () => {
            try {
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...order,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyBody = await verifyRes.json() as { data?: { booking_id: string }; error?: string };
              if (!verifyRes.ok || !verifyBody.data) {
                setSubmitError(verifyBody.error ?? 'Payment verification failed');
                setSubmitting(false);
                return;
              }
              haptic('medium');
              router.push(`/bookings/${verifyBody.data.booking_id}`);
            } catch {
              setSubmitError('Payment verification failed. Contact support if you were charged.');
              setSubmitting(false);
            }
          })();
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
        theme: { color: '#10d96a' },
      });
      rzp.open();
    } catch {
      setSubmitError('Could not start payment. Please try again.');
      setSubmitting(false);
    }
  }

  if (loadingCharger) {
    return <div className="text-center py-12 text-muted">Loading…</div>;
  }

  if (loadError || !charger) {
    return (
      <main className="px-6 py-10">
        <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {loadError ?? 'Charger not found'}
        </div>
      </main>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-10 space-y-5 max-w-lg mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-10">
      <h1 className="text-2xl font-medium text-ink">Book a slot</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
        <p className="font-semibold text-ink">{charger.title}</p>
        <p className="text-xs text-muted">{charger.address}</p>
        <p className="text-sm font-bold text-volt-deep mt-1">₹{charger.price_per_kwh}/kWh</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5" htmlFor="date">
            <Calendar className="w-4 h-4" /> Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            min={minDate}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5" htmlFor="time">
            <Clock className="w-4 h-4" /> Start time
          </label>
          <input
            id="time"
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-ink mb-1.5">Duration</p>

          {noAvailability ? (
            <p className="text-sm text-amber-600 font-medium">
              {maxEndReason} — no slot available at this start time. Choose a different start.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map(opt => {
                  const disabled = isPresetDisabled(opt.minutes);
                  const selected = durationMode === 'preset' && durationMinutes === opt.minutes;
                  return (
                    <button
                      key={opt.minutes}
                      onClick={() => !disabled && handlePresetSelect(opt.minutes)}
                      disabled={disabled}
                      className={cn(
                        'py-2 rounded-xl text-xs font-semibold transition-colors',
                        selected
                          ? 'bg-volt text-ink'
                          : disabled
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-100 text-muted hover:text-ink',
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleSelectCustom}
                className={cn(
                  'mt-2 w-full py-2 rounded-xl text-xs font-semibold transition-colors',
                  durationMode === 'custom'
                    ? 'bg-volt text-ink'
                    : 'bg-gray-100 text-muted hover:text-ink',
                )}
              >
                Custom
              </button>

              {/* Show reason when any preset is disabled and driver hasn't opened Custom */}
              {maxEnd && DURATION_OPTIONS.some(o => isPresetDisabled(o.minutes)) && durationMode !== 'custom' && (
                <p className="text-xs text-muted mt-1.5">{maxEndReason}</p>
              )}

              {durationMode === 'custom' && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5" htmlFor="end-date">
                      <Calendar className="w-4 h-4" /> End date
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      min={minEndDate}
                      max={maxEndDateStr}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5" htmlFor="end-time">
                      <Clock className="w-4 h-4" /> End time
                    </label>
                    <input
                      id="end-time"
                      type="time"
                      value={customEndTime}
                      min={customEndDate === minEndDate ? minEndTimeOnMinDate : undefined}
                      max={maxEndTimeOnMaxDate}
                      onChange={e => setCustomEndTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt"
                    />
                  </div>

                  {maxEndReason && (
                    <p className="text-xs text-amber-600">{maxEndReason}</p>
                  )}

                  {customEndDate && customEndTime && !customEndIsValid && (
                    <p className="text-xs text-red-500">
                      {new Date(`${customEndDate}T${customEndTime}:00`) < minEnd
                        ? `Minimum booking duration is ${MIN_CUSTOM_DURATION_MINUTES} minutes`
                        : 'End time exceeds the available window'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {estimate && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-volt-deep" /> Estimated cost
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">~{estimate.kwh} kWh</span>
            <span className="font-display font-bold text-lg text-ink">₹{estimate.grossRupees}</span>
          </div>
          <p className="text-xs text-muted">
            Final amount may vary slightly based on actual energy delivered.
          </p>
        </div>
      )}

      {submitError && (
        <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600 font-semibold">
          {submitError}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        loading={submitting}
        disabled={!canSubmit}
        onClick={() => { void handlePayAndBook(); }}
      >
        {submitting ? 'Processing…' : `Pay ₹${estimate?.grossRupees ?? ''} & book`}
      </Button>
    </main>
  );
}
