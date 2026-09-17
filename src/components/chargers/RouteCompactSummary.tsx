'use client';

import { Pencil, Zap } from 'lucide-react';
import { CoverageSlider } from './BufferSlider';
import { RadiusSlider } from './RadiusSlider';

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// Off-route slider: 0 → 5 km in five steps, default matches DEFAULT_BUFFER (2500 m).
export const OFF_ROUTE_STEPS  = [0, 500, 1000, 2500, 5000] as const;
export const OFF_ROUTE_LABELS = ['0 m', '500 m', '1 km', '2.5 km', '5 km'] as const;

interface RouteCompactSummaryProps {
  fromAddress: string;
  toAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Visible charger count (after client-side filters). */
  chargerCount: number;
  chargerCountLoading: boolean;
  routeLoading: boolean;
  /** Raw result count the server returned (before client filters). Provided when capped. */
  chargerRawCount?: number;
  /** Server total before the 200-result cap was applied. Signals capped results when present. */
  chargerCappedTotal?: number;
  /** Coverage value in metres, or Infinity for "Entire route". */
  coverageM: number;
  onCoverageChange: (m: number) => void;
  /** Off-route lateral distance in metres (0–5000). */
  offRouteM: number;
  onOffRouteChange: (m: number) => void;
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
  chargerRawCount,
  chargerCappedTotal,
  coverageM,
  onCoverageChange,
  offRouteM,
  onOffRouteChange,
  onEdit,
}: RouteCompactSummaryProps) {
  const isCapped = chargerCappedTotal !== undefined && chargerCappedTotal > 0;
  const rawCount = chargerRawCount ?? chargerCount;

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
                {chargerCountLoading
                  ? '…'
                  : isCapped
                    ? `${rawCount} of ${chargerCappedTotal} charger${chargerCappedTotal !== 1 ? 's' : ''}`
                    : `${chargerCount} charger${chargerCount !== 1 ? '' : ''}`}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Line 3: Coverage slider (route length) */}
      <CoverageSlider value={coverageM} onChange={onCoverageChange} />

      {/* Line 4: Off-route distance slider */}
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-muted shrink-0">Off route</span>
        <RadiusSlider
          value={offRouteM}
          onChange={onOffRouteChange}
          customSteps={OFF_ROUTE_STEPS}
          customLabels={OFF_ROUTE_LABELS as unknown as string[]}
          ariaLabel="Off-route distance"
        />
      </div>
    </div>
  );
}
