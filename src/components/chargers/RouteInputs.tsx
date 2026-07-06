'use client';

import { useState } from 'react';
import { X, LocateFixed, ArrowUpDown, Check } from 'lucide-react';
import { AddressAutocomplete } from '@/components/maps/AddressAutocomplete';
import type { Coords } from '@/lib/maps/types';
import { cn } from '@/lib/utils';

interface RouteInputsProps {
  fromAddress: string;
  toAddress: string;
  onFromAddressChange: (value: string) => void;
  onToAddressChange: (value: string) => void;
  onFromSelect: (result: { coords: Coords; address: string }) => void;
  onToSelect: (result: { coords: Coords; address: string }) => void;
  onGpsRefresh: () => void;
  activeInput: 'from' | 'to';
  onSetActive: (input: 'from' | 'to') => void;
  fromGeocoding?: boolean;
  toGeocoding?: boolean;
  /** When true the From field shows a locked "Your location" chip instead of a text input. */
  fromIsGps?: boolean;
  onSwap: () => void;
  canSwap: boolean;
  isSwapping?: boolean;
  routeLoading?: boolean;
  /** When provided, a "Done" button appears — used when editing an already-calculated route. */
  onDone?: () => void;
}

export function RouteInputs({
  fromAddress,
  toAddress,
  onFromAddressChange,
  onToAddressChange,
  onFromSelect,
  onToSelect,
  onGpsRefresh,
  activeInput,
  onSetActive,
  fromGeocoding,
  toGeocoding,
  fromIsGps,
  onSwap,
  canSwap,
  isSwapping = false,
  routeLoading,
  onDone,
}: RouteInputsProps) {
  // autoFocus only fires on DOM mount — safe to leave true after initial focus
  const [autoFocusFrom, setAutoFocusFrom] = useState(false);

  function handleChipClick() {
    setAutoFocusFrom(true);
    onFromAddressChange('');
  }

  return (
    <div className="flex flex-col gap-2">
      {/* From row */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'relative flex-1 rounded-xl ring-2 transition-all duration-150',
            activeInput === 'from' ? 'ring-volt' : 'ring-gray-200',
            isSwapping && 'opacity-0',
          )}
          onClick={() => onSetActive('from')}
        >
          {fromIsGps ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Change start location"
              onClick={handleChipClick}
              onKeyDown={e => e.key === 'Enter' && handleChipClick()}
              className="w-full pl-4 pr-10 py-3.5 bg-gray-100 rounded-xl flex items-center gap-2 cursor-text"
            >
              <LocateFixed className="w-4 h-4 text-volt shrink-0" />
              <span className="flex-1 text-sm text-ink font-medium truncate">Your location</span>
            </div>
          ) : (
            <AddressAutocomplete
              value={fromAddress}
              onChange={onFromAddressChange}
              onSelect={onFromSelect}
              placeholder="From…"
              autoFocus={autoFocusFrom}
            />
          )}
          {fromGeocoding ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 border-2 border-volt border-t-transparent rounded-full animate-spin pointer-events-none" />
          ) : (fromIsGps || fromAddress) ? (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); onFromAddressChange(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              aria-label="Clear From"
            >
              <X className="w-3.5 h-3.5 text-muted" />
            </button>
          ) : null}
        </div>

        {/* GPS button — right of From field */}
        <button
          type="button"
          onClick={onGpsRefresh}
          title="Use my location as start"
          className="shrink-0 w-9 h-9 rounded-xl bg-volt-soft hover:bg-volt/20 transition-colors flex items-center justify-center"
          aria-label="Use current location as start"
        >
          <LocateFixed className="w-4 h-4 text-volt-deep" />
        </button>
      </div>

      {/* To row */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'relative flex-1 rounded-xl ring-2 transition-all duration-150',
            activeInput === 'to' ? 'ring-volt' : 'ring-gray-200',
            isSwapping && 'opacity-0',
          )}
          onClick={() => onSetActive('to')}
        >
          <AddressAutocomplete
            value={toAddress}
            onChange={onToAddressChange}
            onSelect={onToSelect}
            placeholder="To…"
          />
          {toGeocoding ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 border-2 border-volt border-t-transparent rounded-full animate-spin pointer-events-none" />
          ) : toAddress ? (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); onToAddressChange(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              aria-label="Clear To"
            >
              <X className="w-3.5 h-3.5 text-muted" />
            </button>
          ) : null}
        </div>

        {/* Swap button — right of To field, same column as GPS button */}
        <button
          type="button"
          onClick={onSwap}
          disabled={!canSwap || isSwapping}
          title="Swap From and To"
          aria-label="Swap From and To"
          className={cn(
            'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200',
            canSwap && !isSwapping
              ? 'bg-volt-soft hover:bg-volt/20 hover:scale-105 active:scale-95'
              : 'bg-gray-100 cursor-not-allowed',
          )}
        >
          <ArrowUpDown
            className={cn(
              'w-4 h-4 transition-colors',
              canSwap && !isSwapping ? 'text-volt-deep' : 'text-gray-400',
            )}
          />
        </button>
      </div>

      {/* Helper row: hint text + Done button */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted">
          {routeLoading ? 'Finding route…' : 'Long-press map to drop a pin'}
        </p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex items-center gap-1 text-xs font-semibold text-volt-deep"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        )}
      </div>
    </div>
  );
}
