'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CONNECTOR_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface FilterSheetProps {
  isOpen: boolean;
  selectedConnectors: Set<string>;
  maxPrice: number;
  onApply: (filters: { connectors: Set<string>; maxPrice: number }) => void;
  onClose: () => void;
}

const PRICE_MIN = 6;
const PRICE_MAX = 50;

export function FilterSheet({ isOpen, selectedConnectors, maxPrice, onApply, onClose }: FilterSheetProps) {
  const [draftConnectors, setDraftConnectors] = useState(new Set(selectedConnectors));
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);

  // Sync draft to applied values each time the sheet opens
  useEffect(() => {
    if (!isOpen) return;
    setDraftConnectors(new Set(selectedConnectors));
    setDraftMaxPrice(maxPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function toggleConnector(ct: string) {
    setDraftConnectors(prev => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  function handleClear() {
    setDraftConnectors(new Set());
    setDraftMaxPrice(PRICE_MAX);
  }

  function handleApply() {
    onApply({ connectors: draftConnectors, maxPrice: draftMaxPrice });
    onClose();
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

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
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-6 max-h-[70dvh] overflow-y-auto">
          {/* Connector type */}
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">
              Connector type
            </p>
            <div className="flex flex-wrap gap-2">
              {CONNECTOR_TYPES.map(ct => {
                const active = draftConnectors.has(ct);
                return (
                  <button
                    key={ct}
                    onClick={() => toggleConnector(ct)}
                    className={cn(
                      'px-3.5 py-2 rounded-full text-sm font-semibold transition-colors',
                      active ? 'bg-ink text-white' : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
                    )}
                  >
                    {ct}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max price */}
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

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleClear}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-muted hover:text-ink hover:border-gray-300 transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={handleApply}
              className="flex-[2] py-3 rounded-2xl bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
