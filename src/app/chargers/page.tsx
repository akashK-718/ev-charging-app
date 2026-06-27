'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, SlidersHorizontal } from 'lucide-react';
import { maps } from '@/lib/maps/provider';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { MapListToggle } from '@/components/chargers/MapListToggle';
import { RadiusSlider, RADIUS_STEPS } from '@/components/chargers/RadiusSlider';
import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import { FilterSheet } from '@/components/chargers/FilterSheet';
import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { Coords } from '@/lib/maps/types';
import type { ChargerMarkerData } from '@/components/maps/MapView';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
  },
);

const AddressAutocomplete = dynamic(
  () => import('@/components/maps/AddressAutocomplete').then(m => ({ default: m.AddressAutocomplete })),
  { ssr: false },
);

// ── Constants ─────────────────────────────────────────────────────────────────

const DELHI_NCR: Coords = { lat: 28.6139, lng: 77.209 };
const DEFAULT_RADIUS = 10000;
const MAX_PRICE = 50;
const STORAGE_KEY = 'chargers_map_state_v1';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

// ── Saved state helpers ───────────────────────────────────────────────────────

type SavedMapState = {
  center: Coords;
  zoom: number;
  radius: number | 'all_india';
  viewMode: 'map' | 'list';
  centerType: 'gps' | 'manual';
  timestamp: number;
};

function loadMapState(): SavedMapState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedMapState;
    if (Date.now() - state.timestamp > EXPIRY_MS) return null;
    return state;
  } catch {
    return null;
  }
}

function saveMapState(s: Omit<SavedMapState, 'timestamp'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, timestamp: Date.now() }));
  } catch { /* quota exceeded — silently skip */ }
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ChargersPage() {
  // Search centre
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [centerType, setCenterType] = useState<'gps' | 'manual'>('gps');
  const [searchAddress, setSearchAddress] = useState('');

  // GPS position — kept fresh independently of searchCenter
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState<boolean | null>(null);

  // Map / data state
  const [zoom] = useState(12);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [allIndiaMode, setAllIndiaMode] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Charger data
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);

  // Session-only filters (not persisted)
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // UI
  const [selectedCharger, setSelectedCharger] = useState<ChargerRow | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToastMsg(msg: string, durationMs = 5000) {
    setToastMessage(msg);
    setShowToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), durationMs);
  }

  const fetchChargers = useCallback(
    async (coords: Coords | null, radiusM: number, india: boolean) => {
      setFetchLoading(true);
      try {
        const params = new URLSearchParams();
        if (india) {
          params.set('radius', 'all_india');
          // list mode gets a tighter cap so the page doesn't render 500 cards
          params.set('limit', viewMode === 'list' ? '100' : '500');
        } else if (coords) {
          params.set('lat', String(coords.lat));
          params.set('lng', String(coords.lng));
          params.set('radius', String(radiusM));
        } else {
          return; // nothing to query
        }
        const res = await fetch(`/api/chargers?${params}`);
        const json = await res.json() as { chargers?: ChargerRow[] };
        setChargers(json.chargers ?? []);
      } catch {
        setChargers([]);
      } finally {
        setFetchLoading(false);
      }
    },
    [viewMode],
  );

  // ── Initialisation: restore localStorage or request GPS ───────────────────

  useEffect(() => {
    const saved = loadMapState();

    if (saved) {
      const isAllIndia = saved.radius === 'all_india';
      setSearchCenter(saved.center);
      setCenterType(saved.centerType);
      setViewMode(saved.viewMode);
      setAllIndiaMode(isAllIndia);
      setRadius(isAllIndia ? RADIUS_STEPS[RADIUS_STEPS.length - 1] : Number(saved.radius));
    }

    if (!navigator.geolocation) {
      setGpsAvailable(false);
      if (!saved) {
        setSearchCenter(DELHI_NCR);
        showToastMsg('Showing chargers near Delhi. Set a location or allow GPS access to personalise.');
      }
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const gps: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(gps);
        setGpsAvailable(true);
        if (!saved || saved.centerType === 'gps') {
          setSearchCenter(gps);
          setCenterType('gps');
        }
        setLocationLoading(false);
      },
      () => {
        setGpsAvailable(false);
        if (!saved) {
          setSearchCenter(DELHI_NCR);
          showToastMsg('Showing chargers near Delhi. Set a location or allow GPS access to personalise.');
        }
        setLocationLoading(false);
      },
      { timeout: 8000 },
    );

    return () => clearTimeout(toastTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch whenever centre / radius / mode changes ─────────────────────────

  useEffect(() => {
    if (locationLoading) return; // wait until initialisation completes
    void fetchChargers(searchCenter, radius, allIndiaMode);
  }, [searchCenter, radius, allIndiaMode, fetchChargers, locationLoading]);

  // ── Persist whenever relevant state changes ───────────────────────────────

  useEffect(() => {
    if (!searchCenter) return;
    saveMapState({
      center: searchCenter,
      zoom,
      radius: allIndiaMode ? 'all_india' : radius,
      viewMode,
      centerType,
    });
  }, [searchCenter, zoom, radius, viewMode, centerType, allIndiaMode]);

  // ── Radius change (including All India toggle) ────────────────────────────

  function handleRadiusChange(meters: number) {
    if (!isFinite(meters)) {
      setAllIndiaMode(true);
    } else {
      setAllIndiaMode(false);
      setRadius(meters);
    }
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  function handleViewModeChange(mode: 'map' | 'list') {
    setViewMode(mode);
    if (selectedCharger) setSelectedCharger(null);
  }

  // ── Address autocomplete ──────────────────────────────────────────────────

  function handleAddressSelect({ coords, address }: { coords: Coords; address: string }) {
    setSearchCenter(coords);
    setCenterType('manual');
    setSearchAddress(address);
  }

  function handleAddressChange(v: string) {
    setSearchAddress(v);
    if (v === '' && gpsCoords) {
      setSearchCenter(gpsCoords);
      setCenterType('gps');
    }
  }

  // ── Long press → set manual search centre ────────────────────────────────

  async function handleLongPress(coords: Coords) {
    setSearchCenter(coords);
    setCenterType('manual');
    try {
      const result = await maps.reverseGeocode(coords);
      setSearchAddress(result.formattedAddress);
    } catch {
      setSearchAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    }
  }

  // ── Recenter on GPS ───────────────────────────────────────────────────────

  function handleRecenter() {
    if (gpsCoords) {
      setSearchCenter(gpsCoords);
      setCenterType('gps');
      setSearchAddress('');
    } else if (gpsAvailable === false) {
      showToastMsg('Location access denied. Enable it in your browser settings.');
    } else {
      navigator.geolocation?.getCurrentPosition(pos => {
        const gps: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(gps);
        setGpsAvailable(true);
        setSearchCenter(gps);
        setCenterType('gps');
        setSearchAddress('');
      });
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  function handleApplyFilters({
    connectors,
    maxPrice: mp,
  }: {
    connectors: Set<string>;
    maxPrice: number;
  }) {
    setSelectedConnectors(connectors);
    setMaxPrice(mp);
  }

  function clearFilters() {
    setSelectedConnectors(new Set());
    setMaxPrice(MAX_PRICE);
  }

  function toggleConnector(ct: string) {
    setSelectedConnectors(prev => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  // ── Bump radius to next step (empty state CTA) ────────────────────────────

  function bumpRadius() {
    const steps = Array.from(RADIUS_STEPS);
    const next = steps.find(s => isFinite(s) ? s > radius : true);
    if (next !== undefined) handleRadiusChange(next);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const visibleChargers = chargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  const hiddenByFilters = chargers.length - visibleChargers.length;
  const activeFilterCount = selectedConnectors.size + (maxPrice < MAX_PRICE ? 1 : 0);

  const radiusKm = isFinite(radius) ? radius / 1000 : 0;

  const counterLabel = fetchLoading
    ? 'Searching…'
    : allIndiaMode
      ? `${chargers.length.toLocaleString('en-IN')} chargers across India`
      : hiddenByFilters > 0
        ? `${visibleChargers.length} of ${chargers.length} charger${chargers.length === 1 ? '' : 's'} (${hiddenByFilters} hidden)`
        : `${visibleChargers.length} charger${visibleChargers.length === 1 ? '' : 's'} within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`;

  const mapCenter = searchCenter ?? DELHI_NCR;

  const chargerMarkersData: ChargerMarkerData[] = visibleChargers.map(c => ({
    id: c.id,
    coords: { lat: Number(c.latitude), lng: Number(c.longitude) },
    status: c.status as 'active' | 'paused',
  }));

  const selectedDistanceKm =
    selectedCharger && searchCenter
      ? haversineKm(searchCenter, {
          lat: Number(selectedCharger.latitude),
          lng: Number(selectedCharger.longitude),
        })
      : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col',
        viewMode === 'map' ? 'h-[calc(100dvh-3.5rem)]' : 'min-h-[calc(100dvh-3.5rem)]',
      )}
    >
      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0 gap-3">
        <h1 className="font-display font-extrabold text-lg text-ink leading-tight shrink-0">
          Find a charger
        </h1>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setFiltersOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              activeFilterCount > 0
                ? 'bg-ink text-white'
                : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </button>
          <MapListToggle mode={viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      {/* ── Map view ──────────────────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <div className="flex-1 relative overflow-hidden">
          {locationLoading ? (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
              <p className="text-sm text-muted">Getting your location…</p>
            </div>
          ) : (
            <MapView
              center={mapCenter}
              zoom={zoom}
              fitIndia={allIndiaMode}
              chargerMarkers={chargerMarkersData}
              searchRadius={allIndiaMode ? undefined : radius}
              userLocation={centerType === 'gps' ? (gpsCoords ?? undefined) : undefined}
              manualCenter={centerType === 'manual' ? mapCenter : undefined}
              onChargerClick={id => {
                const found = chargers.find(c => c.id === id);
                if (found) setSelectedCharger(found);
              }}
              onMapClick={() => setSelectedCharger(null)}
              onLongPress={handleLongPress}
            />
          )}

          {/* Map overlay: address search + counter + radius slider */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-3 pointer-events-auto space-y-2">
                <AddressAutocomplete
                  value={searchAddress}
                  onChange={handleAddressChange}
                  onSelect={handleAddressSelect}
                  placeholder="Search a location…"
                />

                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-semibold transition-colors',
                      fetchLoading ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {counterLabel}
                  </span>
                </div>

                <RadiusSlider
                  value={allIndiaMode ? Infinity : radius}
                  onChange={handleRadiusChange}
                  isLoading={fetchLoading}
                />
              </div>
            </div>
          )}

          {/* Recenter / GPS button */}
          {!locationLoading && (
            <button
              onClick={handleRecenter}
              disabled={gpsAvailable === false}
              title={gpsAvailable === false ? 'Location access denied' : 'Recenter on my location'}
              className={cn(
                'absolute bottom-8 right-4 z-10 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors',
                gpsAvailable === false
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : centerType === 'gps'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-ink hover:bg-gray-50',
              )}
              aria-label="Recenter on my location"
            >
              <LocateFixed className="w-5 h-5" />
            </button>
          )}

          {/* Toast */}
          <div
            className={cn(
              'absolute bottom-6 left-4 right-16 z-20 transition-all duration-300',
              showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
            )}
          >
            <div className="bg-ink text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg text-center">
              {toastMessage}
            </div>
          </div>

          {/* Empty state: no chargers in radius */}
          {!fetchLoading && !locationLoading && visibleChargers.length === 0 && !allIndiaMode && searchCenter && (
            <div className="absolute inset-0 flex items-end justify-center pb-28 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                <p className="font-semibold text-ink text-sm">
                  No chargers within{' '}
                  {radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km
                </p>
                {activeFilterCount > 0 ? (
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-xs font-semibold text-volt-deep underline"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    onClick={bumpRadius}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-ink text-white text-xs font-semibold"
                  >
                    Search wider area
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom sheet */}
          <ChargerBottomSheet
            charger={selectedCharger}
            distanceKm={selectedDistanceKm}
            onClose={() => setSelectedCharger(null)}
          />
        </div>
      )}

      {/* ── List view ─────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
          {allIndiaMode && chargers.length >= 100 && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-volt-soft border border-volt/20 text-volt-deep text-xs font-semibold">
              Showing 100 of many chargers — narrow your radius to see more.
            </div>
          )}
          <ChargerListView
            chargers={chargers}
            loading={fetchLoading || locationLoading}
            userCoords={searchCenter ?? undefined}
            selectedConnectors={selectedConnectors}
            maxPrice={maxPrice}
            onConnectorToggle={toggleConnector}
            onMaxPriceChange={setMaxPrice}
            onClearFilters={clearFilters}
          />
        </div>
      )}

      {/* Filter sheet */}
      <FilterSheet
        isOpen={filtersOpen}
        selectedConnectors={selectedConnectors}
        maxPrice={maxPrice}
        onApply={handleApplyFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
