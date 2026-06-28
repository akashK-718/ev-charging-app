'use client';

import { Map, List } from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'map' | 'list';

interface FloatingViewToggleProps {
  value: View;
  onChange: (view: View) => void;
}

export function FloatingViewToggle({ value, onChange }: FloatingViewToggleProps) {
  const isMap = value === 'map';

  return (
    <button
      type="button"
      onClick={() => onChange(isMap ? 'list' : 'map')}
      aria-label={isMap ? 'Switch to List view' : 'Switch to Map view'}
      className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-300 shadow-md text-xs font-semibold text-ink hover:bg-gray-50 active:scale-95 transition-all duration-200"
    >
      {/* Icon cross-fades between List and Map */}
      <div className="relative w-3.5 h-3.5 shrink-0">
        <List
          className={cn(
            'absolute inset-0 w-3.5 h-3.5 transition-opacity duration-200',
            isMap ? 'opacity-100' : 'opacity-0',
          )}
        />
        <Map
          className={cn(
            'absolute inset-0 w-3.5 h-3.5 transition-opacity duration-200',
            isMap ? 'opacity-0' : 'opacity-100',
          )}
        />
      </div>
      <span>{isMap ? 'List' : 'Map'}</span>
    </button>
  );
}
