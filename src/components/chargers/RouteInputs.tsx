'use client';

import { X, LocateFixed } from 'lucide-react';
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
  routeLoading: boolean;
  activeInput: 'from' | 'to';
  onSetActive: (input: 'from' | 'to') => void;
  fromGeocoding?: boolean;
  toGeocoding?: boolean;
}

export function RouteInputs({
  fromAddress,
  toAddress,
  onFromAddressChange,
  onToAddressChange,
  onFromSelect,
  onToSelect,
  onGpsRefresh,
  routeLoading,
  activeInput,
  onSetActive,
  fromGeocoding,
  toGeocoding,
}: RouteInputsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* From */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'relative flex-1 rounded-2xl ring-2 transition-colors',
            activeInput === 'from' ? 'ring-volt' : 'ring-gray-200',
          )}
          onClick={() => onSetActive('from')}
        >
          <AddressAutocomplete
            value={fromAddress}
            onChange={onFromAddressChange}
            onSelect={onFromSelect}
            placeholder="From…"
          />
          {fromGeocoding ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 border-2 border-volt border-t-transparent rounded-full animate-spin pointer-events-none" />
          ) : fromAddress ? (
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
        <button
          type="button"
          onClick={onGpsRefresh}
          title="Use my location as start"
          className="shrink-0 p-2.5 rounded-xl bg-volt-soft hover:bg-volt/20 transition-colors"
          aria-label="Use current location as start"
        >
          <LocateFixed className="w-4 h-4 text-volt-deep" />
        </button>
      </div>

      {/* To */}
      <div
        className={cn(
          'relative rounded-2xl ring-2 transition-colors',
          activeInput === 'to' ? 'ring-volt' : 'ring-gray-200',
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

      {/* Status line */}
      {routeLoading ? (
        <p className="text-[11px] text-muted text-center">Finding route…</p>
      ) : (
        <p className="text-[11px] text-muted text-center">
          Tap an input, then long-press the map to drop a pin
        </p>
      )}
    </div>
  );
}
