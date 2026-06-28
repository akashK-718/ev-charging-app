'use client';

import { Pencil, Zap } from 'lucide-react';
import { BufferSlider } from './BufferSlider';

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

interface RouteCompactSummaryProps {
  fromAddress: string;
  toAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  chargerCount: number;
  chargerCountLoading: boolean;
  routeLoading: boolean;
  bufferValue: number;
  onBufferChange: (m: number) => void;
  onEdit: () => void;
}

export function RouteCompactSummary({
  fromAddress,
  toAddress,
  distanceMeters,
  durationSeconds,
  chargerCount,
  chargerCountLoading,
  routeLoading,
  bufferValue,
  onBufferChange,
  onEdit,
}: RouteCompactSummaryProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Line 1: From → To + Edit button */}
      <div className="flex items-center gap-2 min-w-0">
        <p className="flex-1 text-sm font-semibold text-ink min-w-0 truncate">
          <span>{fromAddress || 'Start'}</span>
          <span className="text-muted font-normal mx-1.5">→</span>
          <span>{toAddress || 'End'}</span>
        </p>
        <button
          onClick={onEdit}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Edit route"
        >
          <Pencil className="w-3 h-3 text-muted" />
          <span className="text-xs text-muted font-medium">Edit</span>
        </button>
      </div>

      {/* Line 2: Distance · Duration · Chargers */}
      <div className="flex items-center gap-2 text-xs">
        {routeLoading ? (
          <span className="text-muted">Calculating route…</span>
        ) : (
          <>
            <span className="font-semibold text-ink">{formatDistance(distanceMeters)}</span>
            <span className="text-gray-300 select-none">·</span>
            <span className="text-muted">{formatDuration(durationSeconds)}</span>
            <span className="text-gray-300 select-none">·</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-volt" />
              <span className="font-semibold text-ink">
                {chargerCountLoading ? '…' : `${chargerCount} charger${chargerCount === 1 ? '' : 's'}`}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Line 3: Buffer slider */}
      <BufferSlider value={bufferValue} onChange={onBufferChange} />
    </div>
  );
}
