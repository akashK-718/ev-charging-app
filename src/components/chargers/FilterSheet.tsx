'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CONNECTOR_TYPES, CONNECTOR_LABELS } from '@/lib/constants';
import type { ConnectorType } from '@/lib/constants';
import { CHARGER_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

// ── Exported types ────────────────────────────────────────────────────────────

export type Availability = 'any' | 'now' | 'next_2h';
export type PowerFilter  = 'any' | string;

/**
 * Compatibility is a single mutually-exclusive dimension with three states:
 * - none        → no compatibility filter active ("Any vehicle")
 * - vehicle     → filter by the connector types of a specific saved vehicle
 * - manual      → user has explicitly picked individual connector types
 *
 * vehicle and manual are never both active at the same time. Selecting a vehicle
 * clears any manual selection; tapping a connector chip while vehicle is active
 * switches to manual (starting from scratch, not from the vehicle's connectors).
 */
export type CompatibilityState =
  | { type: 'none' }
  | { type: 'vehicle'; vehicleId: string; connectorTypes: string[] }
  | { type: 'manual'; connectors: Set<string> };

export interface FilterVehicle {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  connector_types: string[];
  is_default: boolean;
}

export type ExploreFilterState = {
  compatibility: CompatibilityState;
  availability: Availability;
  powerFilter: PowerFilter;
  maxPrice: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PRICE_MIN = 6;
const PRICE_MAX = 50;

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'any',     label: 'Any' },
  { value: 'now',     label: 'Available now' },
  { value: 'next_2h', label: 'Available in next 2 hours' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface FilterSheetProps {
  isOpen: boolean;
  filters: ExploreFilterState;
  vehicles: FilterVehicle[];
  onApply: (filters: ExploreFilterState) => void;
  onClose: () => void;
}

export function FilterSheet({
  isOpen,
  filters,
  vehicles,
  onApply,
  onClose,
}: FilterSheetProps) {
  const [draftCompat,       setDraftCompat]       = useState<CompatibilityState>(filters.compatibility);
  const [draftMaxPrice,     setDraftMaxPrice]     = useState(filters.maxPrice);
  const [draftAvailability, setDraftAvailability] = useState<Availability>(filters.availability);
  const [draftPowerFilter,  setDraftPowerFilter]  = useState<PowerFilter>(filters.powerFilter);

  // Sync draft from applied values each time the sheet opens.
  useEffect(() => {
    if (!isOpen) return;
    setDraftCompat(filters.compatibility);
    setDraftMaxPrice(filters.maxPrice);
    setDraftAvailability(filters.availability);
    setDraftPowerFilter(filters.powerFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Tapping a connector chip always operates in manual mode.
  // Selecting a vehicle preset (radio) clears any manual connector selection.
  function toggleConnector(ct: string) {
    setDraftCompat(prev => {
      const currentSet = prev.type === 'manual' ? new Set(prev.connectors) : new Set<string>();
      currentSet.has(ct) ? currentSet.delete(ct) : currentSet.add(ct);
      return currentSet.size === 0
        ? { type: 'none' }
        : { type: 'manual', connectors: currentSet };
    });
  }

  function handleReset() {
    setDraftCompat({ type: 'none' });
    setDraftMaxPrice(PRICE_MAX);
    setDraftAvailability('any');
    setDraftPowerFilter('any');
  }

  function handleApply() {
    onApply({
      compatibility: draftCompat,
      availability:  draftAvailability,
      powerFilter:   draftPowerFilter,
      maxPrice:      draftMaxPrice,
    });
    onClose();
  }

  return (
    <>
      {/* Scrim */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center px-4 pb-4 pt-1">
          <h2 className="font-display font-bold text-ink text-lg flex-1">Filters</h2>
          <button
            onClick={() => { haptic('light'); onClose(); }}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors tap-light"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-6 max-h-[70dvh] overflow-y-auto">

          {/* ── Vehicle (Compatibility) ──────────────────────────────────── */}
          {vehicles.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
                Vehicle
              </p>
              <div className="flex flex-col gap-2.5">
                {/* Any vehicle — checked when no specific vehicle preset is active */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="vehicle"
                    checked={draftCompat.type !== 'vehicle'}
                    onChange={() => setDraftCompat({ type: 'none' })}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--green)' }}
                  />
                  <span className="text-sm font-medium text-ink">Any vehicle</span>
                </label>

                {vehicles.map(v => (
                  <label key={v.id} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="vehicle"
                      checked={draftCompat.type === 'vehicle' && draftCompat.vehicleId === v.id}
                      onChange={() => setDraftCompat({
                        type: 'vehicle',
                        vehicleId: v.id,
                        connectorTypes: v.connector_types,
                      })}
                      className="w-4 h-4 mt-0.5"
                      style={{ accentColor: 'var(--green)' }}
                    />
                    <div>
                      <span className="text-sm font-medium text-ink">
                        {v.nickname ?? `${v.make} ${v.model}`}
                        {v.is_default && (
                          <span className="ml-1.5 text-[10px] font-semibold text-green uppercase tracking-wide">
                            Default
                          </span>
                        )}
                      </span>
                      <p className="text-xs text-muted mt-0.5">
                        {v.connector_types
                          .map(ct => CONNECTOR_LABELS[ct as ConnectorType] ?? ct)
                          .join(' · ')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Availability ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
              Availability
            </p>
            <div className="flex flex-col gap-2.5">
              {AVAILABILITY_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="availability"
                    value={value}
                    checked={draftAvailability === value}
                    onChange={() => setDraftAvailability(value)}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--green)' }}
                  />
                  <span className="text-sm font-medium text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Connector type (manual mode) ─────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
              Connector type
            </p>
            <div className="flex flex-wrap gap-2">
              {CONNECTOR_TYPES.map(ct => {
                const active = draftCompat.type === 'manual' && draftCompat.connectors.has(ct);
                return (
                  <button
                    key={ct}
                    onClick={() => { haptic('light'); toggleConnector(ct); }}
                    className={cn(
                      'px-3.5 py-2 rounded-full text-sm font-semibold tap-light',
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
            {draftCompat.type === 'vehicle' && (
              <p className="text-xs text-muted mt-2">
                Tap a connector to switch to manual selection.
              </p>
            )}
          </div>

          {/* ── Power ────────────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
              Power
            </p>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="power"
                  value="any"
                  checked={draftPowerFilter === 'any'}
                  onChange={() => setDraftPowerFilter('any')}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--green)' }}
                />
                <span className="text-sm font-medium text-ink">Any</span>
              </label>
              {CHARGER_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="power"
                    value={value}
                    checked={draftPowerFilter === value}
                    onChange={() => setDraftPowerFilter(value)}
                    className="w-4 h-4"
                    style={{ accentColor: 'var(--green)' }}
                  />
                  <span className="text-sm font-medium text-ink">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Max price ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Max price</p>
              <span className="text-sm font-bold text-ink">
                {draftMaxPrice === PRICE_MAX ? 'Any price' : `≤ ₹${draftMaxPrice}/kWh`}
              </span>
            </div>
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={1}
              value={draftMaxPrice}
              onChange={e => setDraftMaxPrice(Number(e.target.value))}
              className="w-full accent-volt h-1 cursor-pointer"
              aria-label="Max price per kWh"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-muted">₹{PRICE_MIN}</span>
              <span className="text-xs text-muted">₹{PRICE_MAX}</span>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { haptic('light'); handleReset(); }}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-muted hover:text-ink hover:border-gray-300 transition-colors tap-light"
            >
              Reset all
            </button>
            <button
              onClick={() => { haptic('medium'); handleApply(); }}
              className="flex-[2] py-3 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors tap-medium"
            >
              Apply
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
