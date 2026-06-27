'use client';

import { Zap } from 'lucide-react';

interface RouteInfoPanelProps {
  distanceMeters: number;
  durationSeconds: number;
  chargerCount: number;
  isLoading: boolean;
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function RouteInfoPanel({
  distanceMeters,
  durationSeconds,
  chargerCount,
  isLoading,
}: RouteInfoPanelProps) {
  return (
    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-ink">{formatDistance(distanceMeters)}</span>
        <span className="text-gray-300 select-none">·</span>
        <span className="text-xs text-muted">{formatDuration(durationSeconds)}</span>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <Zap className="w-3.5 h-3.5 text-volt" />
        <span className="text-xs font-semibold text-ink">
          {isLoading ? '…' : `${chargerCount} charger${chargerCount === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}
