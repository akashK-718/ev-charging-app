'use client';

import { MapPin, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchMode = 'near_me' | 'along_route';

interface ModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Search mode"
      className="inline-flex items-center bg-volt-soft rounded-full p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'near_me'}
        onClick={() => { if (value !== 'near_me') onChange('near_me'); }}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && value !== 'near_me') onChange('near_me'); }}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
          value === 'near_me'
            ? 'bg-volt text-ink shadow-sm'
            : 'text-muted hover:text-ink',
        )}
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        Near me
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'along_route'}
        onClick={() => { if (value !== 'along_route') onChange('along_route'); }}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && value !== 'along_route') onChange('along_route'); }}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
          value === 'along_route'
            ? 'bg-volt text-ink shadow-sm'
            : 'text-muted hover:text-ink',
        )}
      >
        <Route className="w-3.5 h-3.5 shrink-0" />
        Along route
      </button>
    </div>
  );
}
