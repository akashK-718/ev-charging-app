'use client';

import type { ChargerRow } from '@/components/chargers/ChargerCard';
import { toJpegUrl } from '@/lib/cloudinary-url';
import { haversineKm } from '@/lib/haversine';
import type { Coords } from '@/lib/maps/types';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type RouteCharger = ChargerRow & { distance_from_route_m: number };

const PANEL_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW': '7 kW · AC',
  'AC_22kW': '22 kW · AC',
  'DC_fast': 'DC Fast',
};

export function ExploreResultsPanel({ panelChargers, activeFetchLoading, activeFilterCount, resetFilters, isRouteMode, searchCenter, selectedCharger }: {
  panelChargers: ChargerRow[];
  activeFetchLoading: boolean;
  activeFilterCount: number;
  resetFilters: () => void;
  isRouteMode: boolean;
  searchCenter: Coords | null;
  selectedCharger: ChargerRow | null;
}) {
  const [panelHoveredId, setPanelHoveredId] = useState<string | null>(null);
  const chargerItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Scroll the results panel to the selected charger when it changes (desktop).
  useEffect(() => {
    if (!selectedCharger) return;
    chargerItemRefs.current[selectedCharger.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedCharger]);

  return (
    <aside
      className="hidden desk:flex desk:flex-col desk:flex-[2] border-l border-border bg-surface-page"
      aria-label="Charger results"
    >
      <div className="px-4 py-3 border-b border-border bg-surface-card shrink-0">
        <p className="text-sm font-semibold text-ink">
          {activeFetchLoading
            ? 'Searching…'
            : `${panelChargers.length} charger${panelChargers.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {panelChargers.length === 0 && !activeFetchLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
            <p className="text-sm font-semibold text-ink">No chargers found</p>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-green-deep underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          panelChargers.map(c => {
            const distKm = isRouteMode
              ? (c as RouteCharger).distance_from_route_m / 1000
              : searchCenter
                ? haversineKm(searchCenter, { lat: Number(c.latitude), lng: Number(c.longitude) })
                : undefined;
            const isSelected = selectedCharger?.id === c.id;
            const isHovered = panelHoveredId === c.id;
            const cover = c.photos?.[0];
            const powerLabel = PANEL_TYPE_LABEL[c.charger_type] ?? c.charger_type;
            const isActive = c.status === 'active';
            return (
              <div
                key={c.id}
                ref={el => { chargerItemRefs.current[c.id] = el; }}
                onMouseEnter={() => setPanelHoveredId(c.id)}
                onMouseLeave={() => setPanelHoveredId(null)}
                className={cn(
                  'transition-colors',
                  isSelected
                    ? 'bg-green-soft ring-2 ring-inset ring-green'
                    : isHovered
                      ? 'bg-surface-card'
                      : '',
                )}
              >
                <Link href={`/explore/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-volt-soft">
                    {cover ? (
                      <img src={toJpegUrl(cover)} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap className="w-5 h-5 text-volt opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink leading-snug line-clamp-1">{c.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {powerLabel} · <span className="font-semibold text-ink">₹{c.price_per_kwh}/kWh</span>
                    </p>
                    {distKm !== undefined && (
                      <p className="text-xs text-muted mt-0.5">
                        {distKm < 1
                          ? `${Math.round(distKm * 1000)} m`
                          : `${distKm.toFixed(1)} km`}
                        {' '}{isRouteMode ? 'off route' : 'away'}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 w-2 h-2 rounded-full',
                      isActive ? 'bg-green' : 'bg-gray-300',
                    )}
                  />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
