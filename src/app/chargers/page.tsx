'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Route } from 'lucide-react';
import { CONNECTOR_TYPES } from '@/lib/constants';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { maps } from '@/lib/maps/provider';
import { MapListToggle } from '@/components/chargers/MapListToggle';
import { RadiusSlider } from '@/components/chargers/RadiusSlider';
import { BufferSlider } from '@/components/chargers/BufferSlider';
import { RouteInputs } from '@/components/chargers/RouteInputs';
import { RouteInfoPanel } from '@/components/chargers/RouteInfoPanel';
import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { Coords, RouteResult } from '@/lib/maps/types';
import type { MarkerDef } from '@/components/maps/MapView';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
  },
);

const DELHI_NCR: Coords = { lat: 28.6139, lng: 77.209 };
const DEFAULT_RADIUS = 10000;
const DEFAULT_BUFFER = 2500;
const MAX_PRICE = 50;

type SearchMode = 'near_me' | 'along_route';
type RouteCharger = ChargerRow & { distance_from_route_m: number };

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

export default function ChargersPage() {
  // ── View mode (map / list) ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // ── Search mode (near me / along route) ───────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>('near_me');

  // ── Shared filter state ────────────────────────────────────────────────────
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [selectedCharger, setSelectedCharger] = useState<ChargerRow | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Near-me state ──────────────────────────────────────────────────────────
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [isDefaultLocation, setIsDefaultLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
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

  // ── Restore view mode from localStorage ───────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('chargers:viewMode');
    if (saved === 'map' || saved === 'list') setViewMode(saved);
    const savedMode = localStorage.getItem('chargers:searchMode');
    if (savedMode === 'near_me' || savedMode === 'along_route') setSearchMode(savedMode as SearchMode);
  }, []);

  // ── Geolocation on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserCoords(DELHI_NCR);
      setIsDefaultLocation(true);
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        setUserCoords(DELHI_NCR);
        setIsDefaultLocation(true);
        setLocationLoading(false);
        setShowToast(true);
        toastTimer.current = setTimeout(() => setShowToast(false), 5000);
      },
      { timeout: 8000 },
    );

    return () => clearTimeout(toastTimer.current);
  }, []);

  // ── Pre-fill From with GPS when switching to route mode ───────────────────
  useEffect(() => {
    if (searchMode === 'along_route' && userCoords && !routeFrom) {
      setRouteFrom({ coords: userCoords, address: 'Your location' });
      setRouteFromAddress('Your location');
    }
  }, [searchMode, userCoords, routeFrom]);

  // ── Near-me: fetch chargers ────────────────────────────────────────────────
  const fetchChargers = useCallback(async (coords: Coords, radiusM: number) => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(coords.lat),
        lng: String(coords.lng),
        radius: String(radiusM),
      });
      const res = await fetch(`/api/chargers?${params}`);
      const json = await res.json() as { chargers?: ChargerRow[] };
      setChargers(json.chargers ?? []);
    } catch {
      setChargers([]);
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchMode === 'near_me' && userCoords) {
      void fetchChargers(userCoords, radius);
    }
  }, [userCoords, radius, searchMode, fetchChargers]);

  // ── Route mode: fetch chargers along route ─────────────────────────────────
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

  // Re-fetch when buffer changes (route already loaded)
  useEffect(() => {
    if (!routeResult) return;
    void fetchRouteChargers(routeResult.geojson, routeBuffer);
  }, [routeBuffer, routeResult, fetchRouteChargers]);

  // ── Route mode: get route when From + To are both set ─────────────────────
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
        if (!cancelled) {
          setRouteResult(null);
          setRouteChargers([]);
        }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }

    void loadRoute();
    return () => { cancelled = true; };
    // Only re-run when from/to addresses change; buffer change is handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFrom, routeTo]);

  // ── fitBounds for route ────────────────────────────────────────────────────
  const fitBoundsTarget = useMemo(
    () => (routeResult ? computeRouteBounds(routeResult.geometry) : undefined),
    [routeResult],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleViewModeChange(mode: 'map' | 'list') {
    setViewMode(mode);
    localStorage.setItem('chargers:viewMode', mode);
    if (selectedCharger) setSelectedCharger(null);
  }

  function handleSearchModeChange(mode: SearchMode) {
    setSearchMode(mode);
    localStorage.setItem('chargers:searchMode', mode);
    setSelectedCharger(null);
  }

  function handleGpsRefresh() {
    if (!userCoords) return;
    setRouteFrom({ coords: userCoords, address: 'Your location' });
    setRouteFromAddress('Your location');
  }

  function toggleConnector(ct: string) {
    setSelectedConnectors(prev => {
      const next = new Set(prev);
      next.has(ct) ? next.delete(ct) : next.add(ct);
      return next;
    });
  }

  function clearFilters() {
    setSelectedConnectors(new Set());
    setMaxPrice(MAX_PRICE);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const isRouteMode = searchMode === 'along_route';

  // Client-side filter on near-me chargers
  const visibleChargers = chargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  // Client-side filter on route chargers
  const visibleRouteChargers = routeChargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  const activeChargers = isRouteMode ? visibleRouteChargers : visibleChargers;
  const activeFetchLoading = isRouteMode ? routeFetchLoading : fetchLoading;

  const mapCenter = userCoords ?? DELHI_NCR;

  const markers: MarkerDef[] = activeChargers.map(c => ({
    id: c.id,
    coords: { lat: Number(c.latitude), lng: Number(c.longitude) },
    onClick: () => setSelectedCharger(c),
  }));

  // Distance shown in bottom sheet
  const selectedDistanceKm = useMemo(() => {
    if (!selectedCharger) return undefined;
    if (isRouteMode) {
      const rc = visibleRouteChargers.find(c => c.id === selectedCharger.id);
      return rc ? rc.distance_from_route_m / 1000 : undefined;
    }
    if (!userCoords) return undefined;
    return haversineKm(
      userCoords,
      { lat: Number(selectedCharger.latitude), lng: Number(selectedCharger.longitude) },
    );
  }, [selectedCharger, isRouteMode, visibleRouteChargers, userCoords]);

  const radiusKm = radius / 1000;
  const nearMeCounterLabel = activeFetchLoading
    ? 'Searching…'
    : `${visibleChargers.length} charger${visibleChargers.length === 1 ? '' : 's'} within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`;

  const routeCounterLabel = activeFetchLoading
    ? 'Searching…'
    : routeResult
      ? `${visibleRouteChargers.length} charger${visibleRouteChargers.length === 1 ? '' : 's'} along route`
      : 'Enter a destination to search';

  const counterLabel = isRouteMode ? routeCounterLabel : nearMeCounterLabel;

  return (
    <div
      className={cn(
        'flex flex-col',
        viewMode === 'map' ? 'h-[calc(100dvh-3.5rem)]' : 'min-h-[calc(100dvh-3.5rem)]',
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div>
            <h1 className="font-display font-extrabold text-lg text-ink leading-tight">
              Find a charger
            </h1>
            {!locationLoading && isDefaultLocation && searchMode === 'near_me' && (
              <p className="text-[11px] text-muted">Delhi NCR</p>
            )}
          </div>
          <MapListToggle mode={viewMode} onChange={handleViewModeChange} />
        </div>

        {/* Search mode tabs */}
        <div className="flex gap-1.5 px-4 pb-3">
          <button
            onClick={() => handleSearchModeChange('near_me')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
              searchMode === 'near_me'
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
              searchMode === 'along_route'
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
              zoom={12}
              markers={markers}
              userLocation={userCoords ?? undefined}
              routeGeometry={routeResult?.geometry}
              routeBuffer={routeBuffer}
              fromCoords={routeFrom?.coords}
              toCoords={routeTo?.coords}
              fitBoundsTarget={fitBoundsTarget}
              onMapClick={() => setSelectedCharger(null)}
            />
          )}

          {/* ── Overlay controls ───────────────────────────────────────── */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-3 pointer-events-auto">

                {/* Route mode: From/To inputs */}
                {isRouteMode && (
                  <div className="mb-3">
                    <RouteInputs
                      fromAddress={routeFromAddress}
                      toAddress={routeToAddress}
                      onFromAddressChange={setRouteFromAddress}
                      onToAddressChange={setRouteToAddress}
                      onFromSelect={r => setRouteFrom(r)}
                      onToSelect={r => setRouteTo(r)}
                      onGpsRefresh={handleGpsRefresh}
                      routeLoading={routeLoading}
                    />
                  </div>
                )}

                {/* Counter */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink">{counterLabel}</span>
                </div>

                {/* Near-me: radius slider | Route: buffer slider */}
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
                  <RadiusSlider value={radius} onChange={setRadius} />
                )}

                {/* Connector chips */}
                {CONNECTOR_TYPES.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none mt-2 pb-0.5">
                    {CONNECTOR_TYPES.map(ct => {
                      const active = selectedConnectors.has(ct);
                      return (
                        <button
                          key={ct}
                          onClick={() => toggleConnector(ct)}
                          className={cn(
                            'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                            active
                              ? 'bg-ink text-white'
                              : 'bg-gray-100 text-muted hover:text-ink hover:bg-gray-200',
                          )}
                        >
                          {ct}
                        </button>
                      );
                    })}

                    {maxPrice < MAX_PRICE && (
                      <button
                        onClick={() => setMaxPrice(MAX_PRICE)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-ink text-white"
                      >
                        ≤ ₹{maxPrice}/kWh ×
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Toast: location fallback ───────────────────────────────── */}
          <div
            className={cn(
              'absolute bottom-6 left-4 right-4 z-20 transition-all duration-300',
              showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
            )}
          >
            <div className="bg-ink text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg text-center">
              Showing chargers in Delhi. Allow location access to find chargers near you.
            </div>
          </div>

          {/* ── Empty state ────────────────────────────────────────────── */}
          {!activeFetchLoading && !locationLoading && activeChargers.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-24 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                {isRouteMode ? (
                  routeResult ? (
                    <>
                      <p className="font-semibold text-ink text-sm">No chargers along this route</p>
                      <p className="text-xs text-muted mt-1">Try increasing the buffer radius.</p>
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
                      No chargers within {radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km
                    </p>
                    <p className="text-xs text-muted mt-1">Try increasing the radius.</p>
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
          <ChargerListView
            chargers={isRouteMode ? (routeChargers as ChargerRow[]) : chargers}
            loading={activeFetchLoading || locationLoading}
            userCoords={userCoords ?? undefined}
            selectedConnectors={selectedConnectors}
            maxPrice={maxPrice}
            onConnectorToggle={toggleConnector}
            onMaxPriceChange={setMaxPrice}
            onClearFilters={clearFilters}
          />
        </div>
      )}
    </div>
  );
}
