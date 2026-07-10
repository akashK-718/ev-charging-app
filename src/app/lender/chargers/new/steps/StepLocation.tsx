'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, Loader2 } from 'lucide-react';
import { AddressAutocomplete } from '@/components/maps/AddressAutocomplete';
import { maps } from '@/lib/maps/provider';
import type { NewChargerDraft } from '@/types/charger-draft';
import type { Coords } from '@/lib/maps/types';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full rounded-xl bg-gray-100 animate-pulse" />,
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
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Local coords state — decoupled from draft so validation survives any draft merges
  // that might clear latitude/longitude in the edit flow.
  const [coords, setCoords] = useState<Coords | null>(() =>
    draft.latitude !== undefined && draft.longitude !== undefined
      ? { lat: draft.latitude, lng: draft.longitude }
      : null,
  );
  const latestDragRef = useRef<Coords | null>(null);

  // Sync addressText when draft.address arrives asynchronously (edit flow).
  useEffect(() => {
    if (draft.address && !addressText) {
      setAddressText(draft.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.address]);

  // Sync coords when edit-flow data arrives asynchronously after mount.
  useEffect(() => {
    if (draft.latitude !== undefined && draft.longitude !== undefined && coords === null) {
      setCoords({ lat: draft.latitude, lng: draft.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.latitude, draft.longitude]);

  const isValid = !!draft.address && coords !== null;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGpsError('Could not get your location. Please enter address manually.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const result = await maps.reverseGeocode(c);
          handleSelect({ coords: c, address: result.formattedAddress });
        } catch {
          setGpsError('Could not get your location. Please enter address manually.');
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsError('Could not get your location. Please enter address manually.');
        setGpsLoading(false);
      },
      { timeout: 10000 },
    );
  }

  function handleSelect({ coords: newCoords, address }: { coords: Coords; address: string }) {
    setAddressText(address);
    setMapKey(k => k + 1);
    setCoords(newCoords);
    onChange({ address, latitude: newCoords.lat, longitude: newCoords.lng });
  }

  function handleAddressChange(value: string) {
    setAddressText(value);
    // Clear confirmed location only when the user types something different.
    if (draft.address && value !== draft.address) {
      setCoords(null);
      onChange({ address: undefined, latitude: undefined, longitude: undefined });
    }
  }

  function handlePinDrag(newCoords: Coords) {
    setCoords(newCoords);
    onChange({ latitude: newCoords.lat, longitude: newCoords.lng });
    latestDragRef.current = newCoords;

    void (async () => {
      try {
        const result = await maps.reverseGeocode(newCoords);
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

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Location</h1>
      <p className="mt-2 text-base text-muted">Where is your charger located?</p>

      <div className="mt-8">
        <label className="block text-sm font-semibold text-ink mb-2">Address</label>
        <AddressAutocomplete
          value={addressText}
          onChange={handleAddressChange}
          onSelect={handleSelect}
          placeholder="e.g. 42 Sector 15, Gurugram, Haryana"
        />
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsLoading}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-volt-deep hover:text-volt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {gpsLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <LocateFixed className="w-3.5 h-3.5" />}
          {gpsLoading ? 'Getting location…' : 'Use my location'}
        </button>
        {gpsError && (
          <p className="mt-1.5 text-xs text-red-600 font-semibold">{gpsError}</p>
        )}
      </div>

      {draft.address && (
        <div className="mt-3 px-4 py-2.5 bg-volt-soft rounded-xl">
          <p className="text-xs font-semibold text-ink leading-snug">
            Selected: {draft.address}
          </p>
        </div>
      )}

      {coords && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-1">Fine-tune pin location</p>
          <p className="text-xs text-muted mb-3">Drag the pin to the exact charger entrance</p>
          <div className="h-[260px] rounded-xl overflow-hidden">
            <MapView
              key={mapKey}
              center={coords}
              zoom={16}
              draggablePin={{
                coords,
                onDragEnd: handlePinDrag,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
