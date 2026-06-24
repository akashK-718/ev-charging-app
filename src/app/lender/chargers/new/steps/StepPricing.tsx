'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';
import type { ChargerType } from '@/types/charger';
import type { NewChargerDraft } from '@/types/charger-draft';

const TYPICAL_SESSION_KWH = 10;
const PRICE_MIN = 6;
const PRICE_MAX = 50;

const PRICE_RANGES: Record<ChargerType, { min: number; max: number }> = {
  'AC_3.3kW': { min: 10, max: 15 },
  'AC_7kW':   { min: 12, max: 18 },
  'AC_22kW':  { min: 15, max: 22 },
  'DC_fast':  { min: 18, max: 28 },
};

interface StepPricingProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepPricing({ draft, onChange, onValidChange }: StepPricingProps) {
  const [rawValue, setRawValue] = useState(
    draft.pricePerKwh !== undefined ? String(draft.pricePerKwh) : '',
  );
  const [touched, setTouched] = useState(false);

  const price = parseFloat(rawValue);
  const isValid = !isNaN(price) && price >= PRICE_MIN && price <= PRICE_MAX;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRawValue(v);
    setTouched(true);
    const n = parseFloat(v);
    onChange({ pricePerKwh: isNaN(n) ? undefined : n });
  }

  const priceRange = draft.chargerType ? PRICE_RANGES[draft.chargerType] : null;

  const estimatedEarnings = isValid
    ? Math.round(price * TYPICAL_SESSION_KWH * (1 - PLATFORM_COMMISSION_PERCENT / 100))
    : null;

  const errorMessage: string | null = (() => {
    if (!touched || isValid) return null;
    if (rawValue === '') return 'Enter a price per kWh';
    if (!isNaN(price) && price < PRICE_MIN) return `Minimum is ₹${PRICE_MIN}/kWh`;
    if (!isNaN(price) && price > PRICE_MAX) return `Maximum is ₹${PRICE_MAX}/kWh`;
    return 'Enter a valid number';
  })();

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Pricing</h1>
      <p className="mt-2 text-base text-muted">Set how much you charge per kWh.</p>

      {priceRange && (
        <div className="mt-6 px-4 py-3 bg-volt-soft rounded-2xl">
          <p className="text-sm text-ink">
            <span className="font-semibold">Suggested for your charger:</span>{' '}
            ₹{priceRange.min}–₹{priceRange.max}/kWh
          </p>
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="price-input" className="block text-sm font-semibold text-ink mb-2">
          Your price per kWh
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink pointer-events-none select-none">
            ₹
          </span>
          <input
            id="price-input"
            type="number"
            inputMode="decimal"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step="0.5"
            value={rawValue}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder="14"
            className={cn(
              'w-full pl-8 pr-4 py-3 bg-gray-100 rounded-2xl',
              'focus:outline-none focus:ring-2 focus:ring-volt',
              errorMessage && 'ring-2 ring-red-400 focus:ring-red-400',
            )}
          />
        </div>
        {errorMessage && (
          <p className="mt-1.5 text-xs text-red-500 font-semibold">{errorMessage}</p>
        )}
      </div>

      {estimatedEarnings !== null && (
        <div className="mt-6 p-5 rounded-2xl border-2 border-volt-soft bg-white">
          <p className="text-xs text-muted uppercase tracking-wide font-semibold">
            Estimated per session
          </p>
          <p className="mt-1 font-display font-extrabold text-3xl text-ink">
            ₹{estimatedEarnings}
          </p>
          <p className="mt-1 text-xs text-muted">
            Typical {TYPICAL_SESSION_KWH} kWh session at ₹{price}/kWh,
            after {PLATFORM_COMMISSION_PERCENT}% platform fee
          </p>
        </div>
      )}
    </div>
  );
}
