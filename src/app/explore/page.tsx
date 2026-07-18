'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Filter, LocateFixed } from 'lucide-react';
import { maps } from '@/lib/maps/provider';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { ModeToggle } from '@/components/chargers/ModeToggle';
import { FloatingViewToggle } from '@/components/chargers/FloatingViewToggle';
import { RadiusSlider, RADIUS_STEPS } from '@/components/chargers/RadiusSlider';
import { RouteInputs } from '@/components/chargers/RouteInputs';
import { RouteCompactSummary } from '@/components/chargers/RouteCompactSummary';
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

// ── Route geometry simplification ────────────────────────────────────────────
// Mapbox overview=full returns 1000+ points for long routes. URL-encoding that
// as a query param can exceed Vercel's 4 KB limit, causing silent 400 errors.
// We keep at most maxPoints coords — sufficient for ST_DWithin proximity checks.
function simplifyRouteGeoJSON(geojson: string, maxPoints: number): string {
  try {
    const route = JSON.parse(geojson) as { type: string; coordinates: number[][] };
    const coords = route.coordinates;
    if (coords.length <= maxPoints) return geojson;
    const step = Math.ceil(coords.length / maxPoints);
    const simplified: number[][] = [];
    for (let i = 0; i < coords.length; i++) {
      if (i % step === 0 || i === coords.length - 1) simplified.push(coords[i]);
    }
    return JSON.stringify({ type: 'LineString', coordinates: simplified });
  } catch {
    return geojson;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DELHI_NCR: Coords = { lat: 28.6139, lng: 77.209 };
const DEFAULT_RADIUS = 10000;
const DEFAULT_BUFFER = 2500;
const MAX_PRICE = 50;
const STORAGE_KEY = 'chargers_map_state_v2';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

// ── Saved state helpers ───────────────────────────────────────────────────────

type SearchMode = 'near_me' | 'along_route';
type RouteCharger = ChargerRow & { distance_from_route_m: number };

type SavedMapState = {
  center: Coords;
  zoom: number;
  radius: number | 'all_india';
  viewMode: 'map' | 'list';
  centerType: 'gps' | 'manual' | 'default';
  searchMode: SearchMode;
  timestamp: number;
  routeFrom?: { coords: Coords; address: string };
  routeFromAddress?: string;
  routeTo?: { coords: Coords; address: string };
  routeToAddress?: string;
  fromIsGps?: boolean;
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

export default function ExplorePage() {
  // ── Search / view mode ────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchMode, setSearchMode] = useState<SearchMode>('along_route');

  // ── Near-me: search centre ────────────────────────────────────────────────
  const [searchCenter, setSearchCenter] = useState<Coords | null>(null);
  const [centerType, setCenterType] = useState<'gps' | 'manual' | 'default'>('default');
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
  /** Which From/To input is targeted by the next long-press pin drop. */
  const [activeRouteInput, setActiveRouteInput] = useState<'from' | 'to'>('from');
  /** Which pin is currently being reverse-geocoded after a drop or drag. */
  const [geocodingPin, setGeocodingPin] = useState<'from' | 'to' | null>(null);
  const dragDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  /** True when routeFrom was set from GPS — renders a locked "Your location" chip instead of editable input. */
  const [fromIsGps, setFromIsGps] = useState(false);
  /** Prevents the GPS pre-fill effect from re-firing after the user explicitly clears the From field. */
  const userClearedFromRef = useRef(false);
  /** Whether the user is in edit mode for an already-calculated route (State 4). */
  const [routeEditOpen, setRouteEditOpen] = useState(false);
  /** Brief animation flag for the From/To swap — fades fields out, swaps, fades back. */
  const [isSwapping, setIsSwapping] = useState(false);

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
      // Simplify geometry before sending — full Mapbox routes can be 1000+ points,
      // easily exceeding Vercel's 4 KB query-string limit and causing silent 400s.
      const simplified = simplifyRouteGeoJSON(geojson, 100);
      const params = new URLSearchParams({ route: simplified, buffer: String(bufferM) });
      const res = await fetch(`/api/chargers?${params}`);
      if (!res.ok) {
        console.error('[fetchRouteChargers] API error', res.status, await res.text().catch(() => ''));
        setRouteChargers([]);
        return;
      }
      const json = await res.json() as { chargers?: RouteCharger[]; error?: string };
      if (json.error) console.error('[fetchRouteChargers] RPC error:', json.error);
      setRouteChargers(json.chargers ?? []);
    } catch {
      setRouteChargers([]);
    } finally {
      setRouteFetchLoading(false);
    }
  }, []);

  // ── Deeplink: ?charger_id=<id> opens that charger's bottom sheet ────────────

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const deeplinkedId = searchParams.get('charger_id');
    if (!deeplinkedId) return;

    // Strip the param immediately so back navigation returns cleanly to /explore
    window.history.replaceState(null, '', '/explore');

    void (async () => {
      try {
        const res = await fetch(`/api/chargers/${deeplinkedId}`);
        if (!res.ok) return;
        const body = await res.json() as { data: ChargerRow & { latitude: number; longitude: number } };
        const charger = body.data;
        setSelectedCharger(charger);
        setSearchCenter({ lat: Number(charger.latitude), lng: Number(charger.longitude) });
        setCenterType('manual');
      } catch {
        // Deeplink failure must never break the map
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init: restore localStorage or request GPS ─────────────────────────────

  useEffect(() => {
    const saved = loadMapState();

    if (saved) {
      const isAllIndia = saved.radius === 'all_india';
      setSearchCenter(saved.center);
      // Never restore centerType as 'gps' from storage — the GPS success handler
      // below will set it to 'gps' again if permission is still granted this session.
      // Old saved states that are missing centerType are treated as 'default'.
      setCenterType(saved.centerType === 'manual' ? 'manual' : 'default');
      setViewMode(saved.viewMode);
      setSearchMode(saved.searchMode ?? 'along_route');
      setAllIndiaMode(isAllIndia);
      setRadius(isAllIndia ? RADIUS_STEPS[RADIUS_STEPS.length - 1] : Number(saved.radius));
      if (saved.routeFrom) {
        setRouteFrom(saved.routeFrom);
        setRouteFromAddress(saved.routeFromAddress ?? saved.routeFrom.address);
      }
      if (saved.routeTo) {
        setRouteTo(saved.routeTo);
        setRouteToAddress(saved.routeToAddress ?? saved.routeTo.address);
      }
      if (saved.fromIsGps) setFromIsGps(true);
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
        // fetchRouteChargers is triggered by the useEffect watching routeResult —
        // don't call it here too or we get two simultaneous requests.
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
    if (searchMode === 'along_route' && gpsCoords && !routeFrom && !userClearedFromRef.current) {
      setRouteFrom({ coords: gpsCoords, address: 'Your location' });
      setRouteFromAddress('Your location');
      setFromIsGps(true);
      setActiveRouteInput('to');
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
      routeFrom: routeFrom ?? undefined,
      routeFromAddress: routeFromAddress || undefined,
      routeTo: routeTo ?? undefined,
      routeToAddress: routeToAddress || undefined,
      fromIsGps,
    });
  }, [searchCenter, zoom, radius, viewMode, centerType, allIndiaMode, searchMode, routeFrom, routeFromAddress, routeTo, routeToAddress, fromIsGps]);

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
    setRouteEditOpen(false);
    if (mode === 'along_route') {
      setActiveRouteInput('from');
      userClearedFromRef.current = false; // allow GPS pre-fill on fresh entry to route mode
    }
  }

  function handleAddressSelect({ coords, address }: { coords: Coords; address: string }) {
    setSearchCenter(coords);
    setCenterType('manual');
    setSearchAddress(address);
  }

  function handleAddressChange(v: string) {
    setSearchAddress(v);
    if (v === '' && gpsCoords && gpsAvailable === true) {
      setSearchCenter(gpsCoords);
      setCenterType('gps');
    }
  }

  async function handleLongPress(coords: Coords) {
    if (isRouteMode) {
      const target = activeRouteInput;
      setGeocodingPin(target);
      let address: string;
      try {
        const result = await maps.reverseGeocode(coords);
        address = result.formattedAddress;
      } catch {
        address = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      } finally {
        setGeocodingPin(null);
      }
      if (target === 'from') {
        setRouteFrom({ coords, address });
        setRouteFromAddress(address);
        setActiveRouteInput('to');
      } else {
        setRouteTo({ coords, address });
        setRouteToAddress(address);
      }
    } else {
      setSearchCenter(coords);
      setCenterType('manual');
      try {
        const result = await maps.reverseGeocode(coords);
        setSearchAddress(result.formattedAddress);
      } catch {
        setSearchAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      }
    }
  }

  async function handlePinDragEnd(pinId: 'from' | 'to', coords: Coords) {
    clearTimeout(dragDebounceRef.current);
    dragDebounceRef.current = setTimeout(async () => {
      setGeocodingPin(pinId);
      let address: string;
      try {
        const result = await maps.reverseGeocode(coords);
        address = result.formattedAddress;
      } catch {
        address = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      } finally {
        setGeocodingPin(null);
      }
      if (pinId === 'from') {
        setRouteFrom({ coords, address });
        setRouteFromAddress(address);
      } else {
        setRouteTo({ coords, address });
        setRouteToAddress(address);
      }
    }, 300);
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

  async function handleUseGpsLocation() {
    async function apply(gps: Coords) {
      setGpsCoords(gps);
      setGpsAvailable(true);
      setSearchCenter(gps);
      setCenterType('gps');
      try {
        const result = await maps.reverseGeocode(gps);
        setSearchAddress(result.formattedAddress);
      } catch {
        setSearchAddress('');
      }
    }

    if (gpsCoords) { await apply(gpsCoords); return; }
    if (gpsAvailable === false) {
      showToastMsg('Location access denied. Enable it in your browser settings.');
      return;
    }
    if (!navigator.geolocation) {
      setGpsAvailable(false);
      showToastMsg('Location access denied. Enable it in your browser settings.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { void apply({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => {
        setGpsAvailable(false);
        showToastMsg('Location access denied. Enable it in your browser settings.');
      },
      { timeout: 8000 },
    );
  }

  const handleRefresh = useCallback(async () => {
    if (searchMode === 'along_route' && routeResult) {
      await fetchRouteChargers(routeResult.geojson, routeBuffer);
    } else if (searchMode === 'near_me') {
      await fetchChargers(searchCenter, radius, allIndiaMode);
    }
  }, [searchMode, routeResult, routeBuffer, fetchRouteChargers, searchCenter, radius, allIndiaMode, fetchChargers]);

  function handleGpsRouteRefresh() {
    function applyGps(gps: Coords) {
      setGpsCoords(gps);
      setGpsAvailable(true);
      setRouteFrom({ coords: gps, address: 'Your location' });
      setRouteFromAddress('Your location');
      setFromIsGps(true);
      setActiveRouteInput('to');
      userClearedFromRef.current = false;
    }

    if (gpsCoords) {
      applyGps(gpsCoords);
    } else if (gpsAvailable === false) {
      showToastMsg('Location access denied. Enable it in your browser settings.');
    } else {
      navigator.geolocation?.getCurrentPosition(
        pos => applyGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          setGpsAvailable(false);
          showToastMsg('Could not get your location. Please enable location access.');
        },
        { timeout: 8000 },
      );
    }
  }

  function handleFromAddressChange(v: string) {
    setFromIsGps(false);
    setRouteFromAddress(v);
    if (v === '') {
      userClearedFromRef.current = true; // suppress GPS re-fill until user re-enters route mode
      setRouteFrom(null);
      setRouteResult(null);
      setRouteChargers([]);
    }
  }

  function handleToAddressChange(v: string) {
    setRouteToAddress(v);
    if (v === '') {
      setRouteTo(null);
      setRouteResult(null);
      setRouteChargers([]);
    }
  }

  function handleSwap() {
    if (!routeFrom || !routeTo || isSwapping) return;
    setIsSwapping(true);
    setTimeout(() => {
      const prevFrom = routeFrom;
      const prevFromAddr = routeFromAddress;
      setFromIsGps(false); // new From (was To) was never GPS
      setRouteFrom(routeTo);
      setRouteFromAddress(routeToAddress);
      setRouteTo(prevFrom);
      setRouteToAddress(prevFromAddr);
      setIsSwapping(false);
    }, 120);
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
      {/* ── Header: segmented mode toggle + filters ────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white shrink-0">
        <ModeToggle value={searchMode} onChange={handleSearchModeChange} />
        <div className="flex-1" />
        <button
          onClick={() => setFiltersOpen(true)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
            activeFilterCount > 0
              ? 'bg-ink text-white border-ink'
              : 'bg-gray-100 text-muted border-gray-200 hover:text-ink hover:bg-gray-200',
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
        </button>
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
              userLocation={!isRouteMode && centerType === 'gps' && gpsAvailable === true ? (gpsCoords ?? undefined) : undefined}
              manualCenter={!isRouteMode && centerType === 'manual' ? mapCenter : undefined}
              routeGeometry={isRouteMode ? routeResult?.geometry : undefined}
              routeBuffer={isRouteMode ? routeBuffer : undefined}
              routeRecalculating={isRouteMode && routeLoading}
              fromCoords={isRouteMode ? routeFrom?.coords : undefined}
              toCoords={isRouteMode ? routeTo?.coords : undefined}
              fromAddress={isRouteMode ? routeFrom?.address : undefined}
              toAddress={isRouteMode ? routeTo?.address : undefined}
              activeRoutePin={isRouteMode ? activeRouteInput : undefined}
              onFromPinDragEnd={isRouteMode && routeFrom ? c => handlePinDragEnd('from', c) : undefined}
              onToPinDragEnd={isRouteMode && routeTo ? c => handlePinDragEnd('to', c) : undefined}
              fitBoundsTarget={isRouteMode ? fitBoundsTarget : undefined}
              onChargerClick={id => {
                const source = isRouteMode ? routeChargers : chargers;
                const found = source.find(c => c.id === id);
                if (found) setSelectedCharger(found);
              }}
              onMapClick={() => setSelectedCharger(null)}
              onLongPress={handleLongPress}
            />
          )}

          {/* ── Map overlay: controls ─────────────────────────────────────── */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 pointer-events-auto">
                {isRouteMode ? (
                  routeResult && !routeEditOpen ? (
                    /* State 3: compact summary */
                    <RouteCompactSummary
                      fromAddress={routeFromAddress}
                      toAddress={routeToAddress}
                      distanceMeters={routeResult.distanceMeters}
                      durationSeconds={routeResult.durationSeconds}
                      chargerCount={visibleRouteChargers.length}
                      chargerCountLoading={routeFetchLoading}
                      routeLoading={routeLoading}
                      bufferValue={routeBuffer}
                      onBufferChange={setRouteBuffer}
                      onEdit={() => setRouteEditOpen(true)}
                    />
                  ) : (
                    /* States 1/2/4: From + To inputs with swap */
                    <RouteInputs
                      fromAddress={routeFromAddress}
                      toAddress={routeToAddress}
                      onFromAddressChange={handleFromAddressChange}
                      onToAddressChange={handleToAddressChange}
                      onFromSelect={r => { setFromIsGps(false); setRouteFrom(r); setActiveRouteInput('to'); }}
                      onToSelect={r => setRouteTo(r)}
                      onGpsRefresh={handleGpsRouteRefresh}
                      activeInput={activeRouteInput}
                      onSetActive={setActiveRouteInput}
                      fromGeocoding={geocodingPin === 'from'}
                      toGeocoding={geocodingPin === 'to'}
                      fromIsGps={fromIsGps}
                      onSwap={handleSwap}
                      canSwap={!!(routeFrom && routeTo) && !isSwapping}
                      isSwapping={isSwapping}
                      routeLoading={routeLoading}
                      onDone={routeEditOpen ? () => setRouteEditOpen(false) : undefined}
                    />
                  )
                ) : (
                  /* Near-me mode */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={searchAddress}
                          onChange={handleAddressChange}
                          onSelect={handleAddressSelect}
                          placeholder="Search a location…"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { void handleUseGpsLocation(); }}
                        title={gpsAvailable === false ? 'Location access denied' : 'Use my location'}
                        aria-label="Use current GPS location"
                        disabled={gpsAvailable === false}
                        className={cn(
                          'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                          gpsAvailable === false
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : centerType === 'gps' && gpsAvailable === true
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-ink',
                        )}
                      >
                        <LocateFixed className="w-4 h-4" />
                      </button>
                    </div>
                    <span
                      className={cn(
                        'block text-xs font-semibold transition-colors',
                        activeFetchLoading ? 'text-muted' : 'text-ink',
                      )}
                    >
                      {counterLabel}
                    </span>
                    <RadiusSlider
                      value={allIndiaMode ? Infinity : radius}
                      onChange={handleRadiusChange}
                      isLoading={fetchLoading}
                    />
                  </div>
                )}
              </div>
            </div>
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
            (isRouteMode
              ? visibleRouteChargers.length === 0 && routeResult !== null
              : visibleChargers.length === 0) && (
            <div className="absolute inset-0 flex items-end justify-center pb-28 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                {isRouteMode ? (
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
        <div className="flex-1 px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full">
          {/* Search controls — same logic as map overlay but inline */}
          <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-2">
            {isRouteMode ? (
              routeResult && !routeEditOpen ? (
                <RouteCompactSummary
                  fromAddress={routeFromAddress}
                  toAddress={routeToAddress}
                  distanceMeters={routeResult.distanceMeters}
                  durationSeconds={routeResult.durationSeconds}
                  chargerCount={visibleRouteChargers.length}
                  chargerCountLoading={routeFetchLoading}
                  routeLoading={routeLoading}
                  bufferValue={routeBuffer}
                  onBufferChange={setRouteBuffer}
                  onEdit={() => setRouteEditOpen(true)}
                />
              ) : (
                <RouteInputs
                  fromAddress={routeFromAddress}
                  toAddress={routeToAddress}
                  onFromAddressChange={handleFromAddressChange}
                  onToAddressChange={handleToAddressChange}
                  onFromSelect={r => { setFromIsGps(false); setRouteFrom(r); setActiveRouteInput('to'); }}
                  onToSelect={r => setRouteTo(r)}
                  onGpsRefresh={handleGpsRouteRefresh}
                  activeInput={activeRouteInput}
                  onSetActive={setActiveRouteInput}
                  fromGeocoding={geocodingPin === 'from'}
                  toGeocoding={geocodingPin === 'to'}
                  fromIsGps={fromIsGps}
                  onSwap={handleSwap}
                  canSwap={!!(routeFrom && routeTo) && !isSwapping}
                  isSwapping={isSwapping}
                  routeLoading={routeLoading}
                  onDone={routeEditOpen ? () => setRouteEditOpen(false) : undefined}
                />
              )
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={searchAddress}
                      onChange={handleAddressChange}
                      onSelect={handleAddressSelect}
                      placeholder="Search a location…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleUseGpsLocation(); }}
                    title={gpsAvailable === false ? 'Location access denied' : 'Use my location'}
                    aria-label="Use current GPS location"
                    disabled={gpsAvailable === false}
                    className={cn(
                      'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                      gpsAvailable === false
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : centerType === 'gps'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-ink',
                    )}
                  >
                    <LocateFixed className="w-4 h-4" />
                  </button>
                </div>
                <span
                  className={cn(
                    'block text-xs font-semibold transition-colors',
                    activeFetchLoading ? 'text-muted' : 'text-ink',
                  )}
                >
                  {counterLabel}
                </span>
                <RadiusSlider
                  value={allIndiaMode ? Infinity : radius}
                  onChange={handleRadiusChange}
                  isLoading={fetchLoading}
                />
              </>
            )}
          </div>

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

      {/* ── Floating view toggle (always visible, fixed over map or list) ── */}
      <div className="fixed bottom-20 right-4 z-30">
        <FloatingViewToggle value={viewMode} onChange={handleViewModeChange} />
      </div>

      {/* Filter sheet */}
      <FilterSheet
        isOpen={filtersOpen}
        selectedConnectors={selectedConnectors}
        maxPrice={maxPrice}
        onApply={handleApplyFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <PullToRefresh onRefresh={handleRefresh} />
    </div>
  );
}
