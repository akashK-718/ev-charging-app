'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NewChargerDraft } from '@/types/charger-draft';

// India lat/lng bounds for manual entry validation
const LAT_MIN = 6;
const LAT_MAX = 37;
const LNG_MIN = 68;
const LNG_MAX = 97;

const mapsApiConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[260px] rounded-2xl bg-gray-100 animate-pulse" />
  ),
});

// ── Google Maps script loader (singleton) ──────────────────────────────────────
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
  // Shared / autocomplete mode state
  const [inputValue, setInputValue] = useState(draft.address ?? '');
  const [predictions, setPredictions] = useState<LocalPrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [addressKey, setAddressKey] = useState(0);

  // Manual fallback mode state
  const [manualLat, setManualLat] = useState(
    draft.latitude !== undefined ? String(draft.latitude) : '',
  );
  const [manualLng, setManualLng] = useState(
    draft.longitude !== undefined ? String(draft.longitude) : '',
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // ── Validity ────────────────────────────────────────────────────────────────

  const isValid = (() => {
    if (!mapsApiConfigured || apiError) {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      return (
        inputValue.trim().length >= 5 &&
        !isNaN(lat) && lat >= LAT_MIN && lat <= LAT_MAX &&
        !isNaN(lng) && lng >= LNG_MIN && lng <= LNG_MAX
      );
    }
    return !!draft.address && draft.latitude !== undefined && draft.longitude !== undefined;
  })();

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  // ── Load Google Maps (autocomplete mode only) ───────────────────────────────

  useEffect(() => {
    if (!mapsApiConfigured) return;
    loadGoogleMapsApi()
      .then(() => {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        setGoogleReady(true);
      })
      .catch(() => {
        setApiError('Could not load address search. Check your Google Maps API key.');
      });
  }, []);

  // ── Autocomplete handlers ───────────────────────────────────────────────────

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
      await place.fetchFields({ fields: ['location', 'formattedAddress'] });
      const location = place.location;
      if (!location) throw new Error('No location in place result');
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

  // ── Manual fallback handlers ────────────────────────────────────────────────

  function handleManualAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    onChange({ address: value });
  }

  function handleLatChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setManualLat(value);
    const parsed = parseFloat(value);
    onChange({
      latitude: !isNaN(parsed) && parsed >= LAT_MIN && parsed <= LAT_MAX ? parsed : undefined,
    });
  }

  function handleLngChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setManualLng(value);
    const parsed = parseFloat(value);
    onChange({
      longitude: !isNaN(parsed) && parsed >= LNG_MIN && parsed <= LNG_MAX ? parsed : undefined,
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!mapsApiConfigured || apiError) {
    return (
      <div>
        <h1 className="font-display font-extrabold text-3xl text-ink">Location</h1>
        <p className="mt-2 text-base text-muted">Where is your charger located?</p>

        {apiError && (
          <div className="mt-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
            {apiError} Enter coordinates manually below.
          </div>
        )}

        {/* Address */}
        <div className="mt-6">
          <label htmlFor="manual-address" className="block text-sm font-semibold text-ink mb-2">
            Address
          </label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              id="manual-address"
              type="text"
              value={inputValue}
              onChange={handleManualAddressChange}
              placeholder="e.g. 42 Sector 15, Gurugram, Haryana"
              className="w-full pl-10 pr-4 py-3.5 bg-gray-100 rounded-2xl text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-volt"
            />
          </div>
        </div>

        {/* Coordinates */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label htmlFor="manual-lat" className="block text-sm font-semibold text-ink mb-2">
              Latitude
            </label>
            <input
              id="manual-lat"
              type="number"
              inputMode="decimal"
              step="any"
              value={manualLat}
              onChange={handleLatChange}
              placeholder="28.6139"
              className={cn(
                'w-full px-4 py-3.5 bg-gray-100 rounded-2xl text-ink placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-volt',
              )}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="manual-lng" className="block text-sm font-semibold text-ink mb-2">
              Longitude
            </label>
            <input
              id="manual-lng"
              type="number"
              inputMode="decimal"
              step="any"
              value={manualLng}
              onChange={handleLngChange}
              placeholder="77.2090"
              className={cn(
                'w-full px-4 py-3.5 bg-gray-100 rounded-2xl text-ink placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-volt',
              )}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted leading-snug">
          Enter coordinates manually. Tip: right-click on Google Maps and choose "What&apos;s here?" to copy them.{' '}
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-volt-deep"
          >
            Open Google Maps
          </a>
        </p>

        {/* Map placeholder */}
        <div className="mt-6 h-[200px] rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-center px-6">
          <p className="text-sm text-muted leading-snug">
            Map preview unavailable — autocomplete will activate once the maps API is configured.
          </p>
        </div>
      </div>
    );
  }

  // ── Autocomplete mode ───────────────────────────────────────────────────────

  const lat = draft.latitude;
  const lng = draft.longitude;

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Location</h1>
      <p className="mt-2 text-base text-muted">Where is your charger located?</p>

      {apiError && (
        <div className="mt-4 px-4 py-3 bg-red-50 rounded-2xl text-sm text-red-600 font-semibold">
          {apiError}
        </div>
      )}

      <div className="mt-8 relative">
        <label htmlFor="address-input" className="block text-sm font-semibold text-ink mb-2">
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

      {draft.address && (
        <div className="mt-3 px-4 py-2.5 bg-volt-soft rounded-xl">
          <p className="text-xs font-semibold text-ink leading-snug">
            Selected: {draft.address}
          </p>
        </div>
      )}

      {lat !== undefined && lng !== undefined && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-1">Fine-tune pin location</p>
          <p className="text-xs text-muted mb-3">Drag the pin to the exact charger entrance</p>
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
