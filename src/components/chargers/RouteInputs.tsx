'use client';

import { LocateFixed } from 'lucide-react';
import { AddressAutocomplete } from '@/components/maps/AddressAutocomplete';
import type { Coords } from '@/lib/maps/types';

interface RouteInputsProps {
  fromAddress: string;
  toAddress: string;
  onFromAddressChange: (value: string) => void;
  onToAddressChange: (value: string) => void;
  onFromSelect: (result: { coords: Coords; address: string }) => void;
  onToSelect: (result: { coords: Coords; address: string }) => void;
  onGpsRefresh: () => void;
  routeLoading: boolean;
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
}: RouteInputsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* From */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <AddressAutocomplete
            value={fromAddress}
            onChange={onFromAddressChange}
            onSelect={onFromSelect}
            placeholder="From…"
          />
        </div>
        <button
          type="button"
          onClick={onGpsRefresh}
          title="Use my location"
          className="shrink-0 p-2.5 rounded-xl bg-volt-soft hover:bg-volt/20 transition-colors"
          aria-label="Use current location as start"
        >
          <LocateFixed className="w-4 h-4 text-volt-deep" />
        </button>
      </div>

      {/* To */}
      <AddressAutocomplete
        value={toAddress}
        onChange={onToAddressChange}
        onSelect={onToSelect}
        placeholder="To…"
      />

      {/* Loading indicator */}
      {routeLoading && (
        <p className="text-[11px] text-muted text-center">Finding route…</p>
      )}
    </div>
  );
}
