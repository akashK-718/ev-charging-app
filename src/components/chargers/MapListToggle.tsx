'use client';

import { Map, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapListToggleProps {
  mode: 'map' | 'list';
  onChange: (mode: 'map' | 'list') => void;
  iconOnly?: boolean;
}

export function MapListToggle({ mode, onChange, iconOnly = false }: MapListToggleProps) {
  return (
    <div
      className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5"
      role="group"
      aria-label="Switch view"
    >
      {(['map', 'list'] as const).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          aria-label={m === 'map' ? 'Map view' : 'List view'}
          className={cn(
            'flex items-center rounded-lg text-xs font-semibold transition-colors',
            iconOnly ? 'p-1.5' : 'gap-1.5 px-3 py-1.5',
            mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {m === 'map' ? <Map className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          {!iconOnly && (m === 'map' ? 'Map' : 'List')}
        </button>
      ))}
    </div>
  );
}
