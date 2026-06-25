'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CONNECTOR_TYPES } from '@/lib/constants';
import { ChargerCard, type ChargerRow } from './ChargerCard';

const MIN_PRICE = 6;
const MAX_PRICE = 50;

export function ChargerListView({ chargers }: { chargers: ChargerRow[] }) {
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);

  const isFiltered = selectedConnectors.size > 0 || maxPrice < MAX_PRICE;

  const visible = chargers.filter(c => {
    if (selectedConnectors.size > 0) {
      const hasMatch = (c.connector_types as string[]).some(ct => selectedConnectors.has(ct));
      if (!hasMatch) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  function toggleConnector(ct: string) {
    setSelectedConnectors(prev => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  function clearFilters() {
    setSelectedConnectors(new Set());
    setMaxPrice(MAX_PRICE);
  }

  const counterText = isFiltered
    ? `Showing ${visible.length} of ${chargers.length} charger${chargers.length === 1 ? '' : 's'}`
    : `${chargers.length} charger${chargers.length === 1 ? '' : 's'}`;

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="space-y-3 mb-5">
        {/* Connector chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CONNECTOR_TYPES.map(ct => {
            const active = selectedConnectors.has(ct);
            return (
              <button
                key={ct}
                onClick={() => toggleConnector(ct)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  active
                    ? 'bg-ink text-white'
                    : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
                )}
              >
                {ct}
              </button>
            );
          })}
        </div>

        {/* Price slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted shrink-0">Max price</span>
          <input
            type="range"
            min={MIN_PRICE}
            max={MAX_PRICE}
            step={0.5}
            value={maxPrice}
            onChange={e => setMaxPrice(Number(e.target.value))}
            className="flex-1 accent-volt h-1"
          />
          <span className="text-xs font-semibold text-ink shrink-0 w-16 text-right">
            {maxPrice < MAX_PRICE ? `₹${maxPrice}/kWh` : 'Any price'}
          </span>
        </div>

        {/* Counter + clear */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{counterText}</span>
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-volt-deep hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────── */}
      {chargers.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-semibold text-ink">No chargers available yet</p>
          <p className="text-sm text-muted mt-1">Check back soon — more are being listed every day.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-semibold text-ink">No chargers match your filters</p>
          <p className="text-sm text-muted mt-1">Try widening your search.</p>
          <button
            onClick={clearFilters}
            className="mt-3 px-4 py-2 rounded-xl bg-ink text-white text-sm font-semibold"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map(c => (
            <ChargerCard key={c.id} charger={c} />
          ))}
        </div>
      )}
    </div>
  );
}
