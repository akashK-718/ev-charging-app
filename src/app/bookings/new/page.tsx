'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { haptic } from '@/lib/haptics';
import { Calendar, Car, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CONNECTOR_LABELS } from '@/lib/constants';
import { cn, normalizeAddress } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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

const BUDGET_OPTIONS = [
  { rupees: 200,  label: '₹200' },
  { rupees: 500,  label: '₹500' },
  { rupees: 1000, label: '₹1,000' },
];

const MIN_CUSTOM_DURATION_MINUTES = 30;

type Charger = {
  id: string;
  lender_id: string;
  title: string;
  charger_type: string;
  connector_types: string[];
  price_per_kwh: number;
  address: string | null;
  status: string;
};

type Vehicle = {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  connector_types: string[];
  is_default: boolean;
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
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
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
  const { user: currentUser, loading: authLoading } = useAuth();

  const [charger, setCharger] = useState<Charger | null>(null);
  const [loadingCharger, setLoadingCharger] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { date: defaultDate, time: defaultTime } = useMemo(defaultDateTime, []);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);

  // ── Constraint mode ────────────────────────────────────────────────────────
  // 'duration' = existing time-based flow; 'budget' = new budget-based flow.
  const [constraintMode, setConstraintMode] = useState<'duration' | 'budget'>('duration');

  // ── Duration mode state ────────────────────────────────────────────────────
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  // ── Budget mode state ──────────────────────────────────────────────────────
  const [budgetMode, setBudgetMode] = useState<'preset' | 'custom'>('preset');
  const [budgetRupees, setBudgetRupees] = useState(500);
  const [budgetCustomInput, setBudgetCustomInput] = useState('');

  // ── Availability window ────────────────────────────────────────────────────
  const [maxEnd, setMaxEnd] = useState<Date | null>(null);
  const [maxEndReason, setMaxEndReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/users/vehicles')
      .then(res => res.ok ? res.json() : null)
      .then((body: { vehicles?: Vehicle[] } | null) => {
        if (!body?.vehicles?.length) return;
        setVehicles(body.vehicles);
        const def = body.vehicles.find(v => v.is_default) ?? body.vehicles[0];
        setSelectedVehicleId(def.id);
      })
      .catch(() => {});
  }, []);

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
          if (!cancelled) { setMaxEnd(null); setMaxEndReason(''); }
        });
    }, 400);
    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort(); };
  }, [chargerId, date, time]);

  const scheduledStart = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);
  const nominalKw = useMemo(() => charger ? (NOMINAL_KW[charger.charger_type] ?? 7) : 7, [charger]);

  // ── Budget resolution ──────────────────────────────────────────────────────
  // candidate_duration = budget ÷ (price/kWh × rated_kW) — what the budget would buy
  // in an unconstrained world. Resolved duration is capped at maxEnd availability.
  const budgetResolution = useMemo(() => {
    if (!charger || constraintMode !== 'budget' || budgetRupees <= 0) return null;
    const candidateDurationMinutes = (budgetRupees / charger.price_per_kwh / nominalKw) * 60;
    const availableMinutes = maxEnd
      ? (maxEnd.getTime() - scheduledStart.getTime()) / 60000
      : Infinity;
    const resolvedDurationMinutes = Math.min(candidateDurationMinutes, availableMinutes);
    const resolvedKwh = Math.round(nominalKw * (resolvedDurationMinutes / 60) * 100) / 100;
    const resolvedGrossRupees = Math.round(charger.price_per_kwh * resolvedKwh);
    const isCapped = isFinite(availableMinutes) && availableMinutes < candidateDurationMinutes;
    return { candidateDurationMinutes, resolvedDurationMinutes, resolvedKwh, resolvedGrossRupees, isCapped };
  }, [charger, constraintMode, budgetRupees, nominalKw, maxEnd, scheduledStart]);

  // ── Resolved scheduled end ─────────────────────────────────────────────────
  const scheduledEnd = useMemo(() => {
    if (constraintMode === 'budget' && budgetResolution) {
      return new Date(scheduledStart.getTime() + budgetResolution.resolvedDurationMinutes * 60000);
    }
    if (durationMode === 'custom' && customEndDate && customEndTime) {
      const parsed = new Date(`${customEndDate}T${customEndTime}:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(scheduledStart.getTime() + durationMinutes * 60000);
  }, [constraintMode, budgetResolution, durationMode, customEndDate, customEndTime, scheduledStart, durationMinutes]);

  const effectiveDurationMinutes = useMemo(
    () => Math.max(0, (scheduledEnd.getTime() - scheduledStart.getTime()) / 60000),
    [scheduledEnd, scheduledStart],
  );

  // Duration-mode estimate (unchanged from existing logic)
  const estimate = useMemo(() => {
    if (!charger || constraintMode !== 'duration') return null;
    const kwh = Math.round(nominalKw * (effectiveDurationMinutes / 60) * 100) / 100;
    const grossRupees = Math.round(charger.price_per_kwh * kwh);
    return { kwh, grossRupees };
  }, [charger, constraintMode, nominalKw, effectiveDurationMinutes]);

  const noAvailability = useMemo(
    () => maxEnd !== null && maxEnd <= new Date(scheduledStart.getTime() + MIN_CUSTOM_DURATION_MINUTES * 60000),
    [maxEnd, scheduledStart],
  );

  // ── Duration-mode helpers (unchanged) ─────────────────────────────────────
  function isPresetDisabled(minutes: number): boolean {
    if (!maxEnd) return false;
    return scheduledStart.getTime() + minutes * 60000 > maxEnd.getTime();
  }

  function handlePresetSelect(minutes: number) {
    setDurationMode('preset');
    setDurationMinutes(minutes);
  }

  function handleSelectCustomDuration() {
    setDurationMode('custom');
    if (!customEndDate || !customEndTime) {
      const initialMs = scheduledStart.getTime() + 60 * 60000;
      const cappedMs = maxEnd ? Math.min(initialMs, maxEnd.getTime()) : initialMs;
      const initialEnd = new Date(cappedMs);
      setCustomEndDate(initialEnd.toISOString().slice(0, 10));
      setCustomEndTime(initialEnd.toTimeString().slice(0, 5));
    }
  }

  const minEnd = new Date(scheduledStart.getTime() + MIN_CUSTOM_DURATION_MINUTES * 60000);
  const minEndDate = minEnd.toISOString().slice(0, 10);
  const minEndTimeOnMinDate = minEnd.toTimeString().slice(0, 5);
  const maxEndDateStr = maxEnd ? maxEnd.toISOString().slice(0, 10) : undefined;
  const maxEndTimeOnMaxDate =
    maxEnd && customEndDate === maxEndDateStr ? maxEnd.toTimeString().slice(0, 5) : undefined;

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

  // ── Budget-mode helpers ────────────────────────────────────────────────────
  function handleBudgetPresetSelect(rupees: number) {
    setBudgetMode('preset');
    setBudgetRupees(rupees);
  }

  function handleSelectCustomBudget() {
    setBudgetMode('custom');
    if (!budgetCustomInput) setBudgetCustomInput(String(budgetRupees));
  }

  function handleBudgetCustomChange(raw: string) {
    setBudgetCustomInput(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) setBudgetRupees(parsed);
  }

  const budgetTooSmall = useMemo(
    () => constraintMode === 'budget' && budgetResolution !== null &&
      budgetResolution.resolvedDurationMinutes < MIN_CUSTOM_DURATION_MINUTES,
    [constraintMode, budgetResolution],
  );

  // ── Submit gate ────────────────────────────────────────────────────────────
  const canSubmit = !submitting && !noAvailability && (
    constraintMode === 'duration'
      ? customEndIsValid
      : (budgetResolution !== null && !budgetTooSmall && budgetRupees >= 1)
  );

  // The rupee amount that will actually be charged (resolved, never raw budget)
  const paymentGrossRupees = constraintMode === 'budget'
    ? (budgetResolution?.resolvedGrossRupees ?? 0)
    : (estimate?.grossRupees ?? 0);

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
          vehicle_id: selectedVehicleId,
          constraint_type: constraintMode,
          constraint_value: constraintMode === 'duration'
            ? Math.round(effectiveDurationMinutes)
            : budgetRupees,
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
        modal: { ondismiss: () => setSubmitting(false) },
        theme: { color: '#10d96a' },
      });
      rzp.open();
    } catch {
      setSubmitError('Could not start payment. Please try again.');
      setSubmitting(false);
    }
  }

  if (loadingCharger || authLoading) {
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

  if (currentUser && currentUser.id === charger.lender_id) {
    return (
      <main className="px-6 py-10 space-y-4">
        <div className="px-4 py-3 bg-amber-50 rounded-xl text-sm text-amber-800 font-semibold">
          This is your charger — you can&apos;t book your own listing.
        </div>
        <Link href={`/lender/chargers/${charger.id}/edit`} className="block">
          <Button variant="secondary" className="w-full">Edit listing</Button>
        </Link>
        <Link href="/explore" className="block">
          <Button variant="primary" className="w-full">Find another charger</Button>
        </Link>
      </main>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-10 space-y-5 max-w-lg mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10">
      <h1 className="text-2xl font-medium text-ink">Book a slot</h1>

      {/* Charger summary */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
        <p className="font-semibold text-ink">{charger.title}</p>
        {charger.address && <p className="text-xs text-muted">{normalizeAddress(charger.address)}</p>}
        <p className="text-sm font-bold text-volt-deep mt-1">₹{charger.price_per_kwh}/kWh</p>
      </div>

      {/* Vehicle selector — only shown when driver has 2+ vehicles */}
      {vehicles.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
            <Car className="w-4 h-4 text-muted" /> Vehicle
          </h2>
          <div className="space-y-2">
            {vehicles.map(v => {
              const label = v.nickname ?? `${v.make} ${v.model}`;
              const connectorLabel = v.connector_types
                .map(c => CONNECTOR_LABELS[c as keyof typeof CONNECTOR_LABELS] ?? c)
                .join(', ');
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={cn(
                    'w-full text-left rounded-xl border px-3 py-2.5 transition-colors',
                    selectedVehicleId === v.id
                      ? 'border-volt bg-volt/10'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  {connectorLabel && (
                    <p className="text-xs text-muted mt-0.5">{connectorLabel}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date / time / constraint card */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        {/* Date */}
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

        {/* Start time */}
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

        {/* Constraint mode tabs */}
        <div>
          <p className="text-sm font-semibold text-ink mb-2">How do you want to charge?</p>
          <div className="flex gap-2 mb-4">
            {(['duration', 'budget'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setConstraintMode(mode)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-semibold transition-colors',
                  constraintMode === mode
                    ? 'bg-volt text-ink'
                    : 'bg-gray-100 text-muted hover:text-ink',
                )}
              >
                {mode === 'duration' ? 'By time' : 'By budget'}
              </button>
            ))}
          </div>

          {/* ── By time ─────────────────────────────────────────────────────── */}
          {constraintMode === 'duration' && (
            noAvailability ? (
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
                  onClick={handleSelectCustomDuration}
                  className={cn(
                    'mt-2 w-full py-2 rounded-xl text-xs font-semibold transition-colors',
                    durationMode === 'custom'
                      ? 'bg-volt text-ink'
                      : 'bg-gray-100 text-muted hover:text-ink',
                  )}
                >
                  Custom
                </button>

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
            )
          )}

          {/* ── By budget ────────────────────────────────────────────────────── */}
          {constraintMode === 'budget' && (
            noAvailability ? (
              <p className="text-sm text-amber-600 font-medium">
                {maxEndReason} — no slot available at this start time. Choose a different start.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {BUDGET_OPTIONS.map(opt => {
                    const selected = budgetMode === 'preset' && budgetRupees === opt.rupees;
                    return (
                      <button
                        key={opt.rupees}
                        onClick={() => handleBudgetPresetSelect(opt.rupees)}
                        className={cn(
                          'py-2 rounded-xl text-xs font-semibold transition-colors',
                          selected
                            ? 'bg-volt text-ink'
                            : 'bg-gray-100 text-muted hover:text-ink',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleSelectCustomBudget}
                  className={cn(
                    'mt-2 w-full py-2 rounded-xl text-xs font-semibold transition-colors',
                    budgetMode === 'custom'
                      ? 'bg-volt text-ink'
                      : 'bg-gray-100 text-muted hover:text-ink',
                  )}
                >
                  Custom amount
                </button>

                {budgetMode === 'custom' && (
                  <div className="mt-3">
                    <label className="text-sm font-semibold text-ink mb-1.5 block" htmlFor="budget-amount">
                      Budget limit (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">₹</span>
                      <input
                        id="budget-amount"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={budgetCustomInput}
                        onChange={e => handleBudgetCustomChange(e.target.value)}
                        placeholder="e.g. 750"
                        className="w-full rounded-xl border border-gray-200 pl-8 pr-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt"
                      />
                    </div>
                  </div>
                )}

                {/* Budget resolution summary */}
                {budgetResolution && !budgetTooSmall && (
                  <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        Spend up to ₹{budgetRupees.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {budgetResolution.isCapped && maxEnd && (
                      <p className="text-xs text-muted">
                        This charger is available for {formatMinutes(
                          (maxEnd.getTime() - scheduledStart.getTime()) / 60000
                        )} from your start time
                      </p>
                    )}
                    {budgetResolution.isCapped && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted">Maximum estimated charge</span>
                        <span className="text-sm font-bold text-ink">₹{budgetResolution.resolvedGrossRupees}</span>
                      </div>
                    )}
                  </div>
                )}

                {budgetTooSmall && (
                  <p className="mt-2 text-xs text-red-500">
                    Budget too low — increase it to cover at least {MIN_CUSTOM_DURATION_MINUTES} minutes of charging at this charger.
                  </p>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Estimate card */}
      {constraintMode === 'duration' && estimate && (
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
          {(() => {
            const sv = vehicles.find(v => v.id === selectedVehicleId);
            if (!sv || !charger.connector_types?.length || !sv.connector_types.length) return null;
            const ok = sv.connector_types.some(c => charger.connector_types.includes(c));
            const vehicleName = sv.nickname ?? `${sv.make} ${sv.model}`;
            return (
              <p className={cn('text-xs font-medium', ok ? 'text-green' : 'text-amber-600')}>
                {ok
                  ? `${vehicleName} is compatible with this charger`
                  : `${vehicleName} may not be compatible — verify connectors before arriving`}
              </p>
            );
          })()}
        </div>
      )}

      {constraintMode === 'budget' && budgetResolution && !budgetTooSmall && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-volt-deep" />
            {budgetResolution.isCapped ? 'Estimated maximum' : 'Estimated cost'}
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">~{budgetResolution.resolvedKwh} kWh · {formatMinutes(budgetResolution.resolvedDurationMinutes)}</span>
            <span className="font-display font-bold text-lg text-ink">₹{budgetResolution.resolvedGrossRupees}</span>
          </div>
          {budgetResolution.isCapped ? (
            <p className="text-xs text-muted">
              You will be charged up to ₹{budgetResolution.resolvedGrossRupees} — the maximum available in your selected window.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Final amount may vary slightly based on actual energy delivered.
            </p>
          )}
          {(() => {
            const sv = vehicles.find(v => v.id === selectedVehicleId);
            if (!sv || !charger.connector_types?.length || !sv.connector_types.length) return null;
            const ok = sv.connector_types.some(c => charger.connector_types.includes(c));
            const vehicleName = sv.nickname ?? `${sv.make} ${sv.model}`;
            return (
              <p className={cn('text-xs font-medium', ok ? 'text-green' : 'text-amber-600')}>
                {ok
                  ? `${vehicleName} is compatible with this charger`
                  : `${vehicleName} may not be compatible — verify connectors before arriving`}
              </p>
            );
          })()}
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
        {submitting ? 'Processing…' : `Pay ₹${paymentGrossRupees} & book`}
      </Button>
    </main>
  );
}
