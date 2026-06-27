'use client';

import { useRef, useState } from 'react';

export const RADIUS_STEPS = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000, Infinity] as const;
const LABELS = ['1 km', '2.5 km', '5 km', '10 km', '25 km', '50 km', '100 km', '200 km', 'All India'];

interface RadiusSliderProps {
  value: number;
  onChange: (meters: number) => void;
  isLoading?: boolean;
}

export function RadiusSlider({ value, onChange, isLoading }: RadiusSliderProps) {
  const nearestIdx = RADIUS_STEPS.reduce(
    (best, step, i) =>
      Math.abs((isFinite(step) ? step : 1e9) - (isFinite(value) ? value : 1e9)) <
      Math.abs((isFinite(RADIUS_STEPS[best]) ? RADIUS_STEPS[best] : 1e9) - (isFinite(value) ? value : 1e9))
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
    timerRef.current = setTimeout(() => onChange(RADIUS_STEPS[idx]), 300);
  }

  const isAllIndia = visualIdx === RADIUS_STEPS.length - 1;

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="range"
        min={0}
        max={RADIUS_STEPS.length - 1}
        step={1}
        value={visualIdx}
        onChange={handleChange}
        className="flex-1 accent-volt h-1 cursor-pointer"
        aria-label="Search radius"
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
          {LABELS[visualIdx]}
        </span>
      </div>
    </div>
  );
}
