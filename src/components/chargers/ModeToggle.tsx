'use client';

import { cn } from '@/lib/utils';
import { MapPin, Route } from 'lucide-react';

type SearchMode = 'near_me' | 'along_route';

interface ModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const MODES = [
  { id: 'near_me' as const,     label: 'Near me',     Icon: MapPin },
  { id: 'along_route' as const, label: 'Along route', Icon: Route  },
];

/** Two-pill segmented control — active mode is filled green, inactive is outlined. */
export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Search mode">
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={cn(
            'flex items-center justify-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border transition-colors',
            value === id
              ? 'bg-green text-white border-green'
              : 'bg-surface-card text-ink border-border hover:bg-surface-page',
          )}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}
