'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NewChargerDraft } from '@/types/charger-draft';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[260px] rounded-2xl bg-gray-100 animate-pulse" />
  ),
});

// ── Google Maps script loader (singleton) ──────────────────────────────────────
// Uses loading=async + v=weekly to access the new Places API (AutocompleteSuggestion).

const SCRIPT_ID = 'gm-places-script';

function loadGoogleMapsApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (
    typeof google !== 'undefined' &&
    google.maps?.places?.AutocompleteSuggestion
  ) {
    return Promise.resolve();
  }

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Google Maps failed to load')),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // loading=async avoids the synchronous-load perf warning.
    // v=weekly gives access to the new Places API (AutocompleteSuggestion).
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface LocalPrediction {
  placePrediction: google.maps.places.PlacePrediction;
  description: string;
}

interface StepLocationProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StepLocation({ draft, onChange, onValidChange }: StepLocationProps) {
  const [inputValue, setInputValue] = useState(draft.address ?? '');
  const [predictions, setPredictions] = useState<LocalPrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [addressKey, setAddressKey] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Session token groups autocomplete + fetchFields calls for billing efficiency.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const lat = draft.latitude;
  const lng = draft.longitude;
  const isValid = !!draft.address && lat !== undefined && lng !== undefined;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  useEffect(() => {
    loadGoogleMapsApi()
      .then(() => {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        setGoogleReady(true);
      })
      .catch(() => {
        setApiError('Could not load address search. Check your Google Maps API key.');
      });
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const { suggestions } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          includedRegionCodes: ['in'],
          sessionToken: sessionTokenRef.current ?? undefined,
        });

      const local = suggestions
        .map(s => s.placePrediction)
        .filter((p): p is google.maps.places.PlacePrediction => p !== null)
        .map(p => ({ placePrediction: p, description: p.text.text }));

      setPredictions(local);
      setShowDropdown(local.length > 0);
    } catch {
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    if (draft.address) onChange({ address: undefined, latitude: undefined, longitude: undefined });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchPredictions(value); }, 300);
  }

  async function handleSelectPrediction(pred: LocalPrediction) {
    setInputValue(pred.description);
    setPredictions([]);
    setShowDropdown(false);

    try {
      const place = pred.placePrediction.toPlace();
      // fetchFields also closes the billing session started by the session token.
      await place.fetchFields({ fields: ['location', 'formattedAddress'] });

      const location = place.location;
      if (!location) throw new Error('No location in place result');

      // Generate a fresh session token for the next search.
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

      setAddressKey(k => k + 1);
      onChange({
        address: place.formattedAddress ?? pred.description,
        latitude: location.lat(),
        longitude: location.lng(),
      });
    } catch {
      setApiError('Could not get location for that address. Please try again.');
    }
  }

  function handleMarkerDrag(newLat: number, newLng: number) {
    onChange({ latitude: newLat, longitude: newLng });
  }

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Location</h1>
      <p className="mt-2 text-base text-muted">Where is your charger located?</p>

      {apiError && (
        <div className="mt-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {apiError}
        </div>
      )}

      {/* Address input */}
      <div className="mt-8 relative">
        <label
          htmlFor="address-input"
          className="block text-sm font-semibold text-ink mb-2"
        >
          Address
        </label>

        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            id="address-input"
            type="text"
            autoComplete="off"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => predictions.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="e.g. 42 Sector 15, Gurugram, Haryana"
            disabled={!googleReady && !apiError}
            className={cn(
              'w-full pl-10 pr-10 py-3.5 bg-gray-100 rounded-2xl text-ink',
              'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt',
              !googleReady && !apiError && 'opacity-50',
            )}
          />
          {isSearching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-volt border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Predictions dropdown */}
        {showDropdown && predictions.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 z-30 overflow-hidden">
            {predictions.map((pred, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={() => { void handleSelectPrediction(pred); }}
                  className="w-full px-4 py-3.5 text-left flex items-start gap-3 hover:bg-volt-soft transition-colors"
                >
                  <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <span className="text-sm text-ink leading-snug">{pred.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmed address chip */}
      {draft.address && (
        <div className="mt-3 px-4 py-2.5 bg-volt-soft rounded-xl">
          <p className="text-xs font-semibold text-ink leading-snug">
            Selected: {draft.address}
          </p>
        </div>
      )}

      {/* Map — shown once an address is geocoded */}
      {lat !== undefined && lng !== undefined && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-1">Fine-tune pin location</p>
          <p className="text-xs text-muted mb-3">
            Drag the pin to the exact charger entrance
          </p>
          <LocationMap
            lat={lat}
            lng={lng}
            addressKey={addressKey}
            onMarkerDrag={handleMarkerDrag}
          />
        </div>
      )}
    </div>
  );
}
