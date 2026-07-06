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
  const enabledDays = days.filter(d => d.enabled);
  if (enabledDays.length === 0) return false;
  return enabledDays.every(d => d.start_time < d.end_time);
}

export function StepAvailability({ draft, onChange, onValidChange }: StepAvailabilityProps) {
  const [days, setDays] = useState<DayState[]>(() => buildDays(draft.availability));

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
      d.day_of_week === dayOfWeek ? { ...d, enabled: !d.enabled } : d
    ));
  }

  function setTime(dayOfWeek: number, field: 'start_time' | 'end_time', value: string) {
    updateDays(days.map(d =>
      d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d
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

      {/* Quick-set buttons */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { label: 'Weekdays only', action: applyWeekdays },
          { label: 'Weekends only', action: applyWeekends },
          { label: '24/7 always', action: apply247 },
        ].map(({ label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-ink hover:bg-volt-soft transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Day rows */}
      <div className="mt-5 flex flex-col gap-2">
        {days.map(day => {
          const endError = day.enabled && day.start_time >= day.end_time;
          return (
            <div
              key={day.day_of_week}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 transition-colors',
                day.enabled ? 'border-volt bg-volt-soft' : 'border-gray-100 bg-white',
              )}
            >
              {/* Toggle */}
              <button
                type="button"
                aria-label={`${day.enabled ? 'Disable' : 'Enable'} ${day.label}`}
                onClick={() => toggleDay(day.day_of_week)}
                className={cn(
                  'shrink-0 w-10 h-6 rounded-full relative transition-colors',
                  day.enabled ? 'bg-volt' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    day.enabled ? 'translate-x-5' : 'translate-x-1',
                  )}
                />
              </button>

              {/* Day label */}
              <span className={cn(
                'w-8 text-xs font-bold shrink-0',
                day.enabled ? 'text-ink' : 'text-muted',
              )}>
                {day.shortLabel}
              </span>

              {/* Time inputs */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="time"
                  value={day.start_time}
                  disabled={!day.enabled}
                  onChange={e => setTime(day.day_of_week, 'start_time', e.target.value)}
                  className={cn(
                    'flex-1 min-w-0 px-2 py-1.5 rounded-xl text-xs font-semibold',
                    'bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-volt',
                    !day.enabled && 'opacity-40',
                    endError && 'border-red-400',
                  )}
                />
                <span className="text-muted text-xs shrink-0">–</span>
                <input
                  type="time"
                  value={day.end_time}
                  disabled={!day.enabled}
                  onChange={e => setTime(day.day_of_week, 'end_time', e.target.value)}
                  className={cn(
                    'flex-1 min-w-0 px-2 py-1.5 rounded-xl text-xs font-semibold',
                    'bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-volt',
                    !day.enabled && 'opacity-40',
                    endError && 'border-red-400',
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation hint */}
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
