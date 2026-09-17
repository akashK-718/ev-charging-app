'use client';

import { useRef, useState } from 'react';

export const RADIUS_STEPS = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000, Infinity] as const;
const LABELS = ['1 km', '2.5 km', '5 km', '10 km', '25 km', '50 km', '100 km', '200 km', 'All India'];

interface RadiusSliderProps {
  value: number;
  onChange: (meters: number) => void;
  isLoading?: boolean;
  /** Override the default RADIUS_STEPS. When provided the "All India" special-case is suppressed. */
  customSteps?: readonly number[];
  /** Labels matching customSteps length. */
  customLabels?: string[];
  ariaLabel?: string;
}

export function RadiusSlider({
  value,
  onChange,
  isLoading,
  customSteps,
  customLabels,
  ariaLabel,
}: RadiusSliderProps) {
  const steps  = customSteps  ?? RADIUS_STEPS;
  const labels = customLabels ?? LABELS;

  const nearestIdx = steps.reduce(
    (best, step, i) =>
      Math.abs((isFinite(step) ? step : 1e9) - (isFinite(value) ? value : 1e9)) <
      Math.abs((isFinite(steps[best] as number) ? (steps[best] as number) : 1e9) - (isFinite(value) ? value : 1e9))
        ? i
        : best,
    0,
  );
  const [visualIdx, setVisualIdx] = useState(nearestIdx);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = Number(e.target.value);
    setVisualIdx(idx);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(steps[idx] as number), 300);
  }

  const isAllIndia = !customSteps && visualIdx === RADIUS_STEPS.length - 1;

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={visualIdx}
        onChange={handleChange}
        className="flex-1 accent-volt h-1 cursor-pointer"
        aria-label={ariaLabel ?? 'Search radius'}
      />
      <div className="shrink-0 flex items-center gap-1.5 min-w-[5.5rem] justify-end">
        {isLoading && (
          <span className="w-3 h-3 border-2 border-volt border-t-transparent rounded-full animate-spin" />
        )}
        <span
          className={
            'text-xs font-semibold tabular-nums ' +
            (isAllIndia ? 'text-volt-deep' : 'text-ink')
          }
        >
          {labels[visualIdx]}
        </span>
      </div>
    </div>
  );
}
