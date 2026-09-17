'use client';

import { useRef, useState } from 'react';

// Existing coverage steps preserved exactly; Infinity = "Entire route" added as 7th option.
export const COVERAGE_STEPS = [500, 1000, 2500, 5000, 10000, 25000, Infinity] as const;
const LABELS = ['500 m', '1 km', '2.5 km', '5 km', '10 km', '25 km', 'Entire route'];

/** @deprecated Use COVERAGE_STEPS. Kept so existing imports don't break during migration. */
export const BUFFER_STEPS = COVERAGE_STEPS;

interface CoverageSliderProps {
  value: number;
  onChange: (meters: number) => void;
}

export function CoverageSlider({ value, onChange }: CoverageSliderProps) {
  const nearestIdx = COVERAGE_STEPS.reduce(
    (best, step, i) => {
      const a = isFinite(step)    ? step    : 1e12;
      const b = isFinite(COVERAGE_STEPS[best]) ? COVERAGE_STEPS[best] : 1e12;
      const v = isFinite(value)   ? value   : 1e12;
      return Math.abs(a - v) < Math.abs(b - v) ? i : best;
    },
    0,
  );
  const [visualIdx, setVisualIdx] = useState(nearestIdx);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = Number(e.target.value);
    setVisualIdx(idx);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(COVERAGE_STEPS[idx]), 300);
  }

  const isEntireRoute = visualIdx === COVERAGE_STEPS.length - 1;

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-muted shrink-0">Coverage</span>
      <input
        type="range"
        min={0}
        max={COVERAGE_STEPS.length - 1}
        step={1}
        value={visualIdx}
        onChange={handleChange}
        className="flex-1 accent-volt h-1 cursor-pointer"
        aria-label="Route coverage distance"
      />
      <span
        className={
          'text-xs font-semibold shrink-0 w-[6rem] text-right tabular-nums ' +
          (isEntireRoute ? 'text-volt-deep' : 'text-ink')
        }
      >
        {LABELS[visualIdx]}
      </span>
    </div>
  );
}

/** @deprecated Use CoverageSlider. */
export const BufferSlider = CoverageSlider;
