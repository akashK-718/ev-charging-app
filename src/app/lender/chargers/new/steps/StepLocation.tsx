'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AddressAutocomplete } from '@/components/maps/AddressAutocomplete';
import { maps } from '@/lib/maps/provider';
import type { NewChargerDraft } from '@/types/charger-draft';
import type { Coords } from '@/lib/maps/types';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full rounded-2xl bg-gray-100 animate-pulse" />,
  },
);

interface StepLocationProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepLocation({ draft, onChange, onValidChange }: StepLocationProps) {
  const [addressText, setAddressText] = useState(draft.address ?? '');
  const [mapKey, setMapKey] = useState(0);
  // Tracks the latest drag position to discard stale reverse-geocode responses
  const latestDragRef = useRef<Coords | null>(null);

  const isValid =
    !!draft.address && draft.latitude !== undefined && draft.longitude !== undefined;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function handleSelect({ coords, address }: { coords: Coords; address: string }) {
    setAddressText(address);
    setMapKey(k => k + 1); // remount map so it flies to the new address
    onChange({ address, latitude: coords.lat, longitude: coords.lng });
  }

  function handleAddressChange(value: string) {
    setAddressText(value);
    // Clear the confirmed location when the user types again
    if (draft.address) {
      onChange({ address: undefined, latitude: undefined, longitude: undefined });
    }
  }

  function handlePinDrag(newCoords: Coords) {
    // Update coords immediately for a responsive feel
    onChange({ latitude: newCoords.lat, longitude: newCoords.lng });
    latestDragRef.current = newCoords;

    // Reverse-geocode in the background to update the address field
    void (async () => {
      try {
        const result = await maps.reverseGeocode(newCoords);
        // Discard if the user has already dragged to a newer position
        if (
          latestDragRef.current?.lat === newCoords.lat &&
          latestDragRef.current?.lng === newCoords.lng
        ) {
          setAddressText(result.formattedAddress);
          onChange({ address: result.formattedAddress, latitude: newCoords.lat, longitude: newCoords.lng });
        }
      } catch {
        // Keep the existing address text if reverse geocoding fails
      }
    })();
  }

  const hasCoords = draft.latitude !== undefined && draft.longitude !== undefined;

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Location</h1>
      <p className="mt-2 text-base text-muted">Where is your charger located?</p>

      <div className="mt-8">
        <label className="block text-sm font-semibold text-ink mb-2">Address</label>
        <AddressAutocomplete
          value={addressText}
          onChange={handleAddressChange}
          onSelect={handleSelect}
          placeholder="e.g. 42 Sector 15, Gurugram, Haryana"
        />
      </div>

      {draft.address && (
        <div className="mt-3 px-4 py-2.5 bg-volt-soft rounded-xl">
          <p className="text-xs font-semibold text-ink leading-snug">
            Selected: {draft.address}
          </p>
        </div>
      )}

      {hasCoords && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-1">Fine-tune pin location</p>
          <p className="text-xs text-muted mb-3">Drag the pin to the exact charger entrance</p>
          <div className="h-[260px] rounded-2xl overflow-hidden">
            <MapView
              key={mapKey}
              center={{ lat: draft.latitude!, lng: draft.longitude! }}
              zoom={16}
              draggablePin={{
                coords: { lat: draft.latitude!, lng: draft.longitude! },
                onDragEnd: handlePinDrag,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
