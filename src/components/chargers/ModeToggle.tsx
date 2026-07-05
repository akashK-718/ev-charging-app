'use client';

import { MapPin, Route } from 'lucide-react';

type SearchMode = 'near_me' | 'along_route';

interface ModeToggleProps {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
}

/**
 * Compact single-button pill that shows the OTHER mode and switches to it on tap.
 * Along route is the default; "Near me" pill appears when in route mode.
 */
export function ModeToggle({ value, onChange }: ModeToggleProps) {
  const isRoute = value === 'along_route';
  const nextMode: SearchMode = isRoute ? 'near_me' : 'along_route';

  return (
    <button
      type="button"
      onClick={() => onChange(nextMode)}
      aria-label={isRoute ? 'Switch to Near me mode' : 'Switch to Along route mode'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-xs font-semibold text-ink transition-all duration-150"
    >
      {isRoute
        ? <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
        : <Route className="w-3.5 h-3.5 text-muted shrink-0" />}
      {isRoute ? 'Near me' : 'Along route'}
    </button>
  );
}
