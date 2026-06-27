'use client';

import { useRef, useState } from 'react';

export const RADIUS_STEPS = [1000, 2500, 5000, 10000, 20000, 50000] as const;
const LABELS = ['1 km', '2.5 km', '5 km', '10 km', '20 km', '50 km'];

interface RadiusSliderProps {
  value: number;
  onChange: (meters: number) => void;
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const nearestIdx = RADIUS_STEPS.reduce(
    (best, step, i) =>
      Math.abs(step - value) < Math.abs(RADIUS_STEPS[best] - value) ? i : best,
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
      <span className="text-xs font-semibold text-ink shrink-0 w-12 text-right tabular-nums">
        {LABELS[visualIdx]}
      </span>
    </div>
  );
}
