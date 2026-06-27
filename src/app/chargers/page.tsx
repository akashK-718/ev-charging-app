'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, MapPin, Route, SlidersHorizontal } from 'lucide-react';
import { maps } from '@/lib/maps/provider';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { MapListToggle } from '@/components/chargers/MapListToggle';
import { RadiusSlider, RADIUS_STEPS } from '@/components/chargers/RadiusSlider';
import { BufferSlider } from '@/components/chargers/BufferSlider';
import { RouteInputs } from '@/components/chargers/RouteInputs';
import { RouteInfoPanel } from '@/components/chargers/RouteInfoPanel';
import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import { FilterSheet } from '@/components/chargers/FilterSheet';
import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { Coords, RouteResult } from '@/lib/maps/types';
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
const DEFAULT_BUFFER = 2500;
const MAX_PRICE = 50;
const STORAGE_KEY = 'chargers_map_state_v1';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

// ── Saved state helpers ───────────────────────────────────────────────────────

type SearchMode = 'near_me' | 'along_route';
type RouteCharger = ChargerRow & { distance_from_route_m: number };

type SavedMapState = {
  center: Coords;
  zoom: number;
  radius: number | 'all_india';
  viewMode: 'map' | 'list';
  centerType: 'gps' | 'manual';
  searchMode: SearchMode;
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

function computeRouteBounds(
  geometry: Coords[],
): [[number, number], [number, number]] | undefined {
  if (geometry.length < 2) return undefined;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of geometry) {
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ChargersPage() {
  // ── Search / view mode ────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchMode, setSearchMode] = useState<SearchMode>('near_me');

  // ── Near-me: search centre ────────────────────────────────────────────────
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [centerType, setCenterType] = useState<'gps' | 'manual'>('gps');
  const [searchAddress, setSearchAddress] = useState('');

  // GPS position — kept fresh independently of searchCenter
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState<boolean | null>(null);

  // ── Near-me: data ─────────────────────────────────────────────────────────
  const [zoom] = useState(12);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [allIndiaMode, setAllIndiaMode] = useState(false);
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);

  // ── Route mode state ───────────────────────────────────────────────────────
  const [routeFrom, setRouteFrom] = useState<{ coords: Coords; address: string } | null>(null);
  const [routeFromAddress, setRouteFromAddress] = useState('');
  const [routeTo, setRouteTo] = useState<{ coords: Coords; address: string } | null>(null);
  const [routeToAddress, setRouteToAddress] = useState('');
  const [routeBuffer, setRouteBuffer] = useState(DEFAULT_BUFFER);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeChargers, setRouteChargers] = useState<RouteCharger[]>([]);
  const [routeFetchLoading, setRouteFetchLoading] = useState(false);

  // ── Shared filters ────────────────────────────────────────────────────────
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── UI ────────────────────────────────────────────────────────────────────
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
          params.set('limit', viewMode === 'list' ? '100' : '500');
        } else if (coords) {
          params.set('lat', String(coords.lat));
          params.set('lng', String(coords.lng));
          params.set('radius', String(radiusM));
        } else {
          return;
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

  const fetchRouteChargers = useCallback(async (geojson: string, bufferM: number) => {
    setRouteFetchLoading(true);
    try {
      const params = new URLSearchParams({ route: geojson, buffer: String(bufferM) });
      const res = await fetch(`/api/chargers?${params}`);
      const json = await res.json() as { chargers?: RouteCharger[] };
      setRouteChargers(json.chargers ?? []);
    } catch {
      setRouteChargers([]);
    } finally {
      setRouteFetchLoading(false);
    }
  }, []);

  // ── Init: restore localStorage or request GPS ─────────────────────────────

  useEffect(() => {
    const saved = loadMapState();

    if (saved) {
      const isAllIndia = saved.radius === 'all_india';
      setSearchCenter(saved.center);
      setCenterType(saved.centerType);
      setViewMode(saved.viewMode);
      setSearchMode(saved.searchMode ?? 'near_me');
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

  // ── Near-me: fetch on centre / radius / mode change ───────────────────────

  useEffect(() => {
    if (locationLoading || searchMode !== 'near_me') return;
    void fetchChargers(searchCenter, radius, allIndiaMode);
  }, [searchCenter, radius, allIndiaMode, fetchChargers, locationLoading, searchMode]);

  // ── Route: fetch chargers when buffer changes (route already loaded) ───────

  useEffect(() => {
    if (!routeResult) return;
    void fetchRouteChargers(routeResult.geojson, routeBuffer);
  }, [routeBuffer, routeResult, fetchRouteChargers]);

  // ── Route: get route when From + To are set ───────────────────────────────

  useEffect(() => {
    if (!routeFrom || !routeTo) return;
    let cancelled = false;

    async function loadRoute() {
      if (!routeFrom || !routeTo) return;
      setRouteLoading(true);
      try {
        const result = await maps.getRoute(routeFrom.coords, routeTo.coords);
        if (cancelled) return;
        setRouteResult(result);
        await fetchRouteChargers(result.geojson, routeBuffer);
      } catch {
        if (!cancelled) { setRouteResult(null); setRouteChargers([]); }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }

    void loadRoute();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFrom, routeTo]);

  // ── Pre-fill From with GPS when switching to route mode ───────────────────

  useEffect(() => {
    if (searchMode === 'along_route' && gpsCoords && !routeFrom) {
      setRouteFrom({ coords: gpsCoords, address: 'Your location' });
      setRouteFromAddress('Your location');
    }
  }, [searchMode, gpsCoords, routeFrom]);

  // ── Persist state ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchCenter) return;
    saveMapState({
      center: searchCenter,
      zoom,
      radius: allIndiaMode ? 'all_india' : radius,
      viewMode,
      centerType,
      searchMode,
    });
  }, [searchCenter, zoom, radius, viewMode, centerType, allIndiaMode, searchMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleRadiusChange(meters: number) {
    if (!isFinite(meters)) {
      setAllIndiaMode(true);
    } else {
      setAllIndiaMode(false);
      setRadius(meters);
    }
  }

  function handleViewModeChange(mode: 'map' | 'list') {
    setViewMode(mode);
    if (selectedCharger) setSelectedCharger(null);
  }

  function handleSearchModeChange(mode: SearchMode) {
    setSearchMode(mode);
    setSelectedCharger(null);
  }

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

  function handleGpsRouteRefresh() {
    if (!gpsCoords) return;
    setRouteFrom({ coords: gpsCoords, address: 'Your location' });
    setRouteFromAddress('Your location');
  }

  function handleApplyFilters({ connectors, maxPrice: mp }: { connectors: Set<string>; maxPrice: number }) {
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

  function bumpRadius() {
    const steps = Array.from(RADIUS_STEPS);
    const next = steps.find(s => isFinite(s) ? s > radius : true);
    if (next !== undefined) handleRadiusChange(next);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isRouteMode = searchMode === 'along_route';

  const visibleChargers = chargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  const visibleRouteChargers = routeChargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  const hiddenByFilters = isRouteMode
    ? routeChargers.length - visibleRouteChargers.length
    : chargers.length - visibleChargers.length;

  const activeFilterCount = selectedConnectors.size + (maxPrice < MAX_PRICE ? 1 : 0);
  const activeFetchLoading = isRouteMode ? routeFetchLoading : fetchLoading;

  const radiusKm = isFinite(radius) ? radius / 1000 : 0;

  const counterLabel = activeFetchLoading
    ? 'Searching…'
    : isRouteMode
      ? routeResult
        ? hiddenByFilters > 0
          ? `${visibleRouteChargers.length} of ${routeChargers.length} charger${routeChargers.length === 1 ? '' : 's'} (${hiddenByFilters} hidden)`
          : `${visibleRouteChargers.length} charger${visibleRouteChargers.length === 1 ? '' : 's'} along route`
        : 'Enter a destination to search'
      : allIndiaMode
        ? `${chargers.length.toLocaleString('en-IN')} chargers across India`
        : hiddenByFilters > 0
          ? `${visibleChargers.length} of ${chargers.length} charger${chargers.length === 1 ? '' : 's'} (${hiddenByFilters} hidden)`
          : `${visibleChargers.length} charger${visibleChargers.length === 1 ? '' : 's'} within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`;

  const mapCenter = searchCenter ?? DELHI_NCR;

  const chargerMarkersData: ChargerMarkerData[] = (isRouteMode ? visibleRouteChargers : visibleChargers).map(c => ({
    id: c.id,
    coords: { lat: Number(c.latitude), lng: Number(c.longitude) },
    status: c.status as 'active' | 'paused',
  }));

  const selectedDistanceKm = useMemo(() => {
    if (!selectedCharger) return undefined;
    if (isRouteMode) {
      const rc = visibleRouteChargers.find(c => c.id === selectedCharger.id);
      return rc ? rc.distance_from_route_m / 1000 : undefined;
    }
    if (!searchCenter) return undefined;
    return haversineKm(searchCenter, {
      lat: Number(selectedCharger.latitude),
      lng: Number(selectedCharger.longitude),
    });
  }, [selectedCharger, isRouteMode, visibleRouteChargers, searchCenter]);

  const fitBoundsTarget = useMemo(
    () => (routeResult ? computeRouteBounds(routeResult.geometry) : undefined),
    [routeResult],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col',
        viewMode === 'map' ? 'h-[calc(100dvh-3.5rem)]' : 'min-h-[calc(100dvh-3.5rem)]',
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
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

        {/* Search mode tabs */}
        <div className="flex gap-1.5 px-4 pb-3">
          <button
            onClick={() => handleSearchModeChange('near_me')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              !isRouteMode
                ? 'bg-volt text-ink'
                : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
            )}
          >
            <MapPin className="w-3.5 h-3.5" />
            Near me
          </button>
          <button
            onClick={() => handleSearchModeChange('along_route')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              isRouteMode
                ? 'bg-volt text-ink'
                : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
            )}
          >
            <Route className="w-3.5 h-3.5" />
            Along route
          </button>
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
              fitIndia={!isRouteMode && allIndiaMode}
              chargerMarkers={chargerMarkersData}
              searchRadius={!isRouteMode && !allIndiaMode ? radius : undefined}
              userLocation={!isRouteMode && centerType === 'gps' ? (gpsCoords ?? undefined) : undefined}
              manualCenter={!isRouteMode && centerType === 'manual' ? mapCenter : undefined}
              routeGeometry={routeResult?.geometry}
              routeBuffer={routeBuffer}
              fromCoords={routeFrom?.coords}
              toCoords={routeTo?.coords}
              fitBoundsTarget={fitBoundsTarget}
              onChargerClick={id => {
                const source = isRouteMode ? routeChargers : chargers;
                const found = source.find(c => c.id === id);
                if (found) setSelectedCharger(found);
              }}
              onMapClick={() => setSelectedCharger(null)}
              onLongPress={!isRouteMode ? handleLongPress : undefined}
            />
          )}

          {/* ── Map overlay: controls ─────────────────────────────────────── */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-3 pointer-events-auto space-y-2">

                {/* Route mode: From/To inputs */}
                {isRouteMode ? (
                  <RouteInputs
                    fromAddress={routeFromAddress}
                    toAddress={routeToAddress}
                    onFromAddressChange={setRouteFromAddress}
                    onToAddressChange={setRouteToAddress}
                    onFromSelect={r => setRouteFrom(r)}
                    onToSelect={r => setRouteTo(r)}
                    onGpsRefresh={handleGpsRouteRefresh}
                    routeLoading={routeLoading}
                  />
                ) : (
                  /* Near-me: address search */
                  <AddressAutocomplete
                    value={searchAddress}
                    onChange={handleAddressChange}
                    onSelect={handleAddressSelect}
                    placeholder="Search a location…"
                  />
                )}

                {/* Counter */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-semibold transition-colors',
                      activeFetchLoading ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {counterLabel}
                  </span>
                </div>

                {/* Slider: radius (near-me) or buffer (route) */}
                {isRouteMode ? (
                  <>
                    <BufferSlider value={routeBuffer} onChange={setRouteBuffer} />
                    {routeResult && (
                      <RouteInfoPanel
                        distanceMeters={routeResult.distanceMeters}
                        durationSeconds={routeResult.durationSeconds}
                        chargerCount={visibleRouteChargers.length}
                        isLoading={routeFetchLoading}
                      />
                    )}
                  </>
                ) : (
                  <RadiusSlider
                    value={allIndiaMode ? Infinity : radius}
                    onChange={handleRadiusChange}
                    isLoading={fetchLoading}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Recenter / GPS button (near-me only) ─────────────────────── */}
          {!locationLoading && !isRouteMode && (
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

          {/* ── Toast ─────────────────────────────────────────────────────── */}
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

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!activeFetchLoading && !locationLoading &&
            (isRouteMode ? visibleRouteChargers.length === 0 : visibleChargers.length === 0) && (
            <div className="absolute inset-0 flex items-end justify-center pb-28 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                {isRouteMode ? (
                  routeResult ? (
                    <>
                      <p className="font-semibold text-ink text-sm">No chargers along this route</p>
                      {activeFilterCount > 0 ? (
                        <button onClick={clearFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
                          Clear filters
                        </button>
                      ) : (
                        <p className="text-xs text-muted mt-1">Try increasing the buffer radius.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-ink text-sm">Enter a destination</p>
                      <p className="text-xs text-muted mt-1">Set From and To to find chargers along your route.</p>
                    </>
                  )
                ) : (
                  <>
                    <p className="font-semibold text-ink text-sm">
                      {allIndiaMode
                        ? 'No chargers found across India'
                        : `No chargers within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`}
                    </p>
                    {activeFilterCount > 0 ? (
                      <button onClick={clearFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
                        Clear filters
                      </button>
                    ) : !allIndiaMode ? (
                      <button
                        onClick={bumpRadius}
                        className="mt-2 px-4 py-1.5 rounded-xl bg-ink text-white text-xs font-semibold"
                      >
                        Search wider area
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom sheet */}
          <ChargerBottomSheet
            charger={selectedCharger}
            distanceKm={selectedDistanceKm}
            distanceSuffix={isRouteMode ? 'off your route' : 'away'}
            onClose={() => setSelectedCharger(null)}
          />
        </div>
      )}

      {/* ── List view ─────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
          {!isRouteMode && allIndiaMode && chargers.length >= 100 && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-volt-soft border border-volt/20 text-volt-deep text-xs font-semibold">
              Showing 100 of many chargers — narrow your radius to see more.
            </div>
          )}
          <ChargerListView
            chargers={isRouteMode ? (routeChargers as ChargerRow[]) : chargers}
            loading={activeFetchLoading || locationLoading}
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
