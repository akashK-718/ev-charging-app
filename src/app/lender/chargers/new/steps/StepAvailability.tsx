'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { NewChargerDraft, AvailabilityDay } from '@/types/charger-draft';

interface DayState {
  day_of_week: number;
  label: string;
  shortLabel: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

const DEFAULT_DAYS: Omit<DayState, 'enabled' | 'start_time' | 'end_time'>[] = [
  { day_of_week: 1, label: 'Monday',    shortLabel: 'Mon' },
  { day_of_week: 2, label: 'Tuesday',   shortLabel: 'Tue' },
  { day_of_week: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { day_of_week: 4, label: 'Thursday',  shortLabel: 'Thu' },
  { day_of_week: 5, label: 'Friday',    shortLabel: 'Fri' },
  { day_of_week: 6, label: 'Saturday',  shortLabel: 'Sat' },
  { day_of_week: 0, label: 'Sunday',    shortLabel: 'Sun' },
];

const WEEKDAY_NUMS = new Set([1, 2, 3, 4, 5]);
const WEEKEND_NUMS = new Set([0, 6]);

function buildDays(saved?: AvailabilityDay[]): DayState[] {
  return DEFAULT_DAYS.map(d => {
    const slot = saved?.find(s => s.day_of_week === d.day_of_week);
    const isWeekend = WEEKEND_NUMS.has(d.day_of_week);
    return {
      ...d,
      enabled: slot !== undefined,
      start_time: slot?.start_time ?? (isWeekend ? '08:00' : '06:00'),
      end_time:   slot?.end_time   ?? (isWeekend ? '23:00' : '22:00'),
    };
  });
}

interface StepAvailabilityProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

function toDraftSlots(days: DayState[]): AvailabilityDay[] {
  return days
    .filter(d => d.enabled)
    .map(d => ({ day_of_week: d.day_of_week, start_time: d.start_time, end_time: d.end_time }));
}

function isValid(days: DayState[]): boolean {
  const enabled = days.filter(d => d.enabled);
  if (enabled.length === 0) return false;
  return enabled.every(d => d.start_time < d.end_time);
}

// ─── DayRow ──────────────────────────────────────────────────────────────────

interface DayRowProps {
  day: DayState;
  onToggle: () => void;
  onTimeChange: (field: 'start_time' | 'end_time', value: string) => void;
}

function DayRow({ day, onToggle, onTimeChange }: DayRowProps) {
  const timeError = day.enabled && day.start_time >= day.end_time;

  return (
    <div
      className={cn(
        // border-2 on both states to prevent 1px layout-shift when toggling
        'p-3 rounded-xl border-2 transition-colors duration-150',
        day.enabled
          ? 'border-green bg-green-soft'
          : 'border-gray-200 bg-white',
      )}
    >
      {/* Row 1 — toggle + day label */}
      <div className="flex items-center gap-3">
        {/*
          Toggle track. No overflow-hidden so the thumb's shadow renders fully.
          The thumb is anchored with left-0 so translate values are predictable
          across all browsers (without left-0, "auto" positioning is ambiguous).
        */}
        <button
          type="button"
          role="switch"
          aria-checked={day.enabled}
          aria-label={`${day.enabled ? 'Disable' : 'Enable'} ${day.label}`}
          onClick={onToggle}
          className={cn(
            'relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200',
            day.enabled ? 'bg-green' : 'bg-gray-300',
          )}
        >
          {/* Thumb: left-0 + translate for crisp left/right knob position */}
          <span
            className={cn(
              'pointer-events-none absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-md',
              'transition-transform duration-200',
              day.enabled ? 'translate-x-5' : 'translate-x-1',
            )}
          />
        </button>

        <span
          className={cn(
            'flex-1 text-sm font-semibold select-none',
            day.enabled ? 'text-ink' : 'text-muted',
          )}
        >
          {day.label}
        </span>
      </div>

      {/*
        Row 2 — time inputs.
        pl-[52px] = 40px toggle + 12px gap, aligning inputs under the day label.
        Always rendered (not conditionally) so the row height is stable on toggle.
      */}
      <div className="mt-2.5 flex items-center gap-2 pl-[52px]">
        <input
          type="time"
          value={day.start_time}
          disabled={!day.enabled}
          onChange={e => onTimeChange('start_time', e.target.value)}
          className={cn(
            'flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-semibold bg-white border',
            'focus:outline-none focus:ring-2 focus:ring-green',
            timeError ? 'border-red-400' : 'border-gray-200',
            !day.enabled && 'opacity-40',
          )}
        />
        <span className="shrink-0 text-xs text-muted">–</span>
        <input
          type="time"
          value={day.end_time}
          disabled={!day.enabled}
          onChange={e => onTimeChange('end_time', e.target.value)}
          className={cn(
            'flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-semibold bg-white border',
            'focus:outline-none focus:ring-2 focus:ring-green',
            timeError ? 'border-red-400' : 'border-gray-200',
            !day.enabled && 'opacity-40',
          )}
        />
      </div>
    </div>
  );
}

// ─── StepAvailability ────────────────────────────────────────────────────────

export function StepAvailability({ draft, onChange, onValidChange }: StepAvailabilityProps) {
  const [days, setDays] = useState<DayState[]>(() => buildDays(draft.availability));

  // Edit mode: draft.availability arrives async after mount. Sync once it lands
  // if all days are still at their initial disabled state.
  useEffect(() => {
    if (draft.availability?.length && !days.some(d => d.enabled)) {
      setDays(buildDays(draft.availability));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.availability]);

  const valid = isValid(days);

  useEffect(() => {
    onValidChange(valid);
  }, [valid, onValidChange]);

  function updateDays(next: DayState[]) {
    setDays(next);
    onChange({ availability: toDraftSlots(next) });
  }

  function toggleDay(dayOfWeek: number) {
    updateDays(days.map(d =>
      d.day_of_week === dayOfWeek ? { ...d, enabled: !d.enabled } : d,
    ));
  }

  function setTime(dayOfWeek: number, field: 'start_time' | 'end_time', value: string) {
    updateDays(days.map(d =>
      d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d,
    ));
  }

  function applyWeekdays() {
    updateDays(days.map(d => ({ ...d, enabled: WEEKDAY_NUMS.has(d.day_of_week) })));
  }

  function applyWeekends() {
    updateDays(days.map(d => ({ ...d, enabled: WEEKEND_NUMS.has(d.day_of_week) })));
  }

  function apply247() {
    updateDays(days.map(d => ({ ...d, enabled: true, start_time: '00:00', end_time: '23:59' })));
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Availability</h1>
      <p className="mt-2 text-base text-muted">
        When is your charger available for bookings?
      </p>

      {/* Quick-set presets */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { label: 'Weekdays only', action: applyWeekdays },
          { label: 'Weekends only', action: applyWeekends },
          { label: '24/7 always',   action: apply247 },
        ].map(({ label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-ink hover:bg-green-soft transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Day rows */}
      <div className="mt-5 flex flex-col gap-2">
        {days.map(day => (
          <DayRow
            key={day.day_of_week}
            day={day}
            onToggle={() => toggleDay(day.day_of_week)}
            onTimeChange={(field, value) => setTime(day.day_of_week, field, value)}
          />
        ))}
      </div>

      {/* Validation hints */}
      {days.filter(d => d.enabled).length === 0 && (
        <p className="mt-3 text-xs text-red-500 font-semibold">
          Enable at least one day.
        </p>
      )}
      {days.some(d => d.enabled && d.start_time >= d.end_time) && (
        <p className="mt-2 text-xs text-red-500 font-semibold">
          End time must be after start time.
        </p>
      )}
    </div>
  );
}
