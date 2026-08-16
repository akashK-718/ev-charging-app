'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureFlags } from '@/lib/edge-config';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Filter, LocateFixed, X, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { purgeLegacyKey } from '@/lib/user-storage';
import { CONNECTOR_LABELS } from '@/lib/constants';
import type { ConnectorType } from '@/lib/constants';
import { maps } from '@/lib/maps/provider';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { toJpegUrl } from '@/lib/cloudinary-url';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { ModeToggle } from '@/components/chargers/ModeToggle';
import { FloatingViewToggle } from '@/components/chargers/FloatingViewToggle';
import { RadiusSlider, RADIUS_STEPS } from '@/components/chargers/RadiusSlider';
import { RouteInputs } from '@/components/chargers/RouteInputs';
import { RouteCompactSummary } from '@/components/chargers/RouteCompactSummary';
import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import { FilterSheet } from '@/components/chargers/FilterSheet';
import type {
  Availability,
  PowerFilter,
  CompatibilityState,
  ExploreFilterState,
  FilterVehicle,
} from '@/components/chargers/FilterSheet';
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

const PANEL_TYPE_LABEL: Record<string, string> = {
  'AC_3.3kW': '3.3 kW · AC',
  'AC_7kW': '7 kW · AC',
  'AC_22kW': '22 kW · AC',
  'DC_fast': 'DC Fast',
};

const DELHI_NCR: Coords = { lat: 28.6139, lng: 77.209 };
const DEFAULT_RADIUS = 10000;
const DEFAULT_BUFFER = 2500;
const MAX_PRICE = 50;
// Legacy User-level key — never written again; purged on first load.
const LEGACY_STORAGE_KEY = 'chargers_map_state_v2';

// Session-scoped storage keys (sessionStorage, cleared on signOut).
// No userId suffix needed — sessionStorage is per-tab and not shared across users.
const SESSION_KEY_MODE        = 'kirin:explore:mode';
const SESSION_KEY_NEAR_ME     = 'kirin:explore:near_me';
const SESSION_KEY_ALONG_ROUTE = 'kirin:explore:along_route';
// Per-mode suggestion dismissal — each mode tracks independently.
const SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME = 'kirin:explore:suggestion-dismissed:near_me';
const SESSION_KEY_SUGGESTION_DISMISSED_ROUTE   = 'kirin:explore:suggestion-dismissed:along_route';

// ── Session state types ───────────────────────────────────────────────────────

type SearchMode = 'near_me' | 'along_route';

// FilterVehicle is the vehicle shape used by both FilterSheet and this page.
type Vehicle = FilterVehicle;

const DEFAULT_FILTER_STATE: ExploreFilterState = {
  compatibility: { type: 'none' },
  availability:  'any',
  powerFilter:   'any',
  maxPrice:      MAX_PRICE,
};

type RouteCharger = ChargerRow & { distance_from_route_m: number };

type NearMeSession = {
  center: Coords;
  radius: number | 'all_india';
  viewMode: 'map' | 'list';
  centerType: 'gps' | 'manual' | 'default';
};

type AlongRouteSession = {
  routeFrom: { coords: Coords; address: string } | null;
  routeFromAddress: string;
  routeTo: { coords: Coords; address: string } | null;
  routeToAddress: string;
  fromIsGps: boolean;
};

function loadSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function saveSession(key: string, value: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
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
  // ── Auth — stored so save effect can scope its key without re-fetching ───
  const userIdRef = useRef<string | null>(null);
  const initCompleteRef = useRef(false); // guards persist effects during async init

  // ── Feature flags — fetched once on mount, default to permissive ─────────
  const [featureFlags, setFeatureFlags] = useState<Pick<FeatureFlags, 'route_planning_enabled'>>({
    route_planning_enabled: true,
  });

  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.json() as Promise<FeatureFlags>)
      .then(f => setFeatureFlags({ route_planning_enabled: f.route_planning_enabled }))
      .catch(() => {});
  }, []);

  // ── Search / view mode ────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchMode, setSearchMode] = useState<SearchMode>('near_me');

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
  const dragDebounceFromRef = useRef<ReturnType<typeof setTimeout>>();
  const dragDebounceToRef = useRef<ReturnType<typeof setTimeout>>();
  /** True when routeFrom was set from GPS — renders a locked "Your location" chip instead of editable input. */
  const [fromIsGps, setFromIsGps] = useState(false);
  /** Prevents the GPS pre-fill effect from re-firing after the user explicitly clears the From field. */
  const userClearedFromRef = useRef(false);
  /** Whether the user is in edit mode for an already-calculated route (State 4). */
  const [routeEditOpen, setRouteEditOpen] = useState(false);
  /** Brief animation flag for the From/To swap — fades fields out, swaps, fades back. */
  const [isSwapping, setIsSwapping] = useState(false);

  // ── Per-mode filter state (Near Me and Along Route are fully independent) ──
  const [nearMeFilters,    setNearMeFilters]    = useState<ExploreFilterState>(DEFAULT_FILTER_STATE);
  const [routeFilters,     setRouteFilters]     = useState<ExploreFilterState>(DEFAULT_FILTER_STATE);
  const [filtersOpen,      setFiltersOpen]      = useState(false);

  // ── Vehicles (fetched once; used by FilterSheet Vehicle section + chip) ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // ── Per-mode suggestion dismissal (session-scoped) ────────────────────────
  const [nearMeSuggestionDismissed, setNearMeSuggestionDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME) === '1'; }
    catch { return false; }
  });
  const [routeSuggestionDismissed, setRouteSuggestionDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY_SUGGESTION_DISMISSED_ROUTE) === '1'; }
    catch { return false; }
  });

  // ── UI ────────────────────────────────────────────────────────────────────
  const [selectedCharger, setSelectedCharger] = useState<ChargerRow | null>(null);
  const [panelHoveredId, setPanelHoveredId] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const chargerItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // ── Init: URL params → session state → user → purge legacy → GPS ──────────
  //
  // URL params are read synchronously at the top (before any await) so a
  // ?mode=near_me deeplink from Home always wins over saved session state —
  // this is the fix for non-deterministic Home shortcut behaviour.
  // initCompleteRef guards persist effects from writing during the async gap.

  useEffect(() => {
    let cancelled = false;

    // ── 1. URL params — read before any await so deeplinks are deterministic ──
    const urlParams = new URLSearchParams(window.location.search);
    const urlMode = urlParams.get('mode');
    const deeplinkedId = urlParams.get('charger_id');
    if (urlParams.toString()) {
      // Strip params immediately so back navigation returns cleanly to /explore
      window.history.replaceState(null, '', '/explore');
    }

    // ── 2. Resolve initial mode: URL param > session memory > default ─────────
    //    URL param is authoritative — Home shortcuts always force a specific mode.
    //    Bottom-nav entry falls back to the last-used mode from this session.
    const sessionMode = loadSession<SearchMode>(SESSION_KEY_MODE);
    const isValidMode = (m: string | null): m is SearchMode =>
      m === 'near_me' || m === 'along_route';

    let resolvedMode: SearchMode =
      isValidMode(urlMode)     ? urlMode     :
      isValidMode(sessionMode) ? sessionMode :
      'near_me'; // default for new sessions

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      userIdRef.current = user?.id ?? null;

      // Purge both legacy storage keys (unscoped and old User-level scoped).
      purgeLegacyKey(LEGACY_STORAGE_KEY);
      if (user?.id) {
        try { localStorage.removeItem(`${LEGACY_STORAGE_KEY}:${user.id}`); } catch {}
      }

      // ── 3. Feature-flag constraint ──────────────────────────────────────────
      if (!featureFlags.route_planning_enabled && resolvedMode === 'along_route') {
        resolvedMode = 'near_me';
      }
      setSearchMode(resolvedMode);

      // ── 4. Restore mode-specific session state ──────────────────────────────
      if (resolvedMode === 'near_me') {
        const saved = loadSession<NearMeSession>(SESSION_KEY_NEAR_ME);
        if (saved) {
          setSearchCenter(saved.center);
          // Never restore centerType as 'gps' — GPS handler below re-sets it
          // if permission is still granted this session.
          setCenterType(saved.centerType === 'manual' ? 'manual' : 'default');
          setViewMode(saved.viewMode);
          const isAllIndia = saved.radius === 'all_india';
          setAllIndiaMode(isAllIndia);
          setRadius(isAllIndia ? RADIUS_STEPS[RADIUS_STEPS.length - 1] : Number(saved.radius));
        }
      } else {
        const saved = loadSession<AlongRouteSession>(SESSION_KEY_ALONG_ROUTE);
        if (saved) {
          if (saved.routeFrom) {
            setRouteFrom(saved.routeFrom);
            setRouteFromAddress(saved.routeFromAddress || saved.routeFrom.address);
          }
          if (saved.routeTo) {
            setRouteTo(saved.routeTo);
            setRouteToAddress(saved.routeToAddress || saved.routeTo.address);
          }
          if (saved.fromIsGps) setFromIsGps(true);
        }
      }

      // ── 5. Deeplinked charger ───────────────────────────────────────────────
      if (deeplinkedId) {
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
      }

      // ── 6. GPS resolution — set initCompleteRef first so any user interaction
      //       during the GPS wait is persisted correctly. ──────────────────────
      const hasSavedNearMe = !!loadSession<NearMeSession>(SESSION_KEY_NEAR_ME);
      initCompleteRef.current = true;

      if (!navigator.geolocation) {
        setGpsAvailable(false);
        if (!hasSavedNearMe) {
          setSearchCenter(DELHI_NCR);
          showToastMsg('Showing chargers near Delhi. Set a location or allow GPS access to personalise.');
        }
        setLocationLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          if (cancelled) return;
          const gps: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsCoords(gps);
          setGpsAvailable(true);
          const nearMe = loadSession<NearMeSession>(SESSION_KEY_NEAR_ME);
          if (!nearMe || nearMe.centerType === 'gps') {
            setSearchCenter(gps);
            setCenterType('gps');
          }
          setLocationLoading(false);
        },
        () => {
          if (cancelled) return;
          setGpsAvailable(false);
          if (!hasSavedNearMe) {
            setSearchCenter(DELHI_NCR);
            showToastMsg('Showing chargers near Delhi. Set a location or allow GPS access to personalise.');
          }
          setLocationLoading(false);
        },
        { timeout: 8000 },
      );
    })();

    return () => {
      cancelled = true;
      clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch vehicles (for FilterSheet Vehicle section + suggestion chip) ─────
  // Fetches all of the user's vehicles once on mount.  The default vehicle is
  // derived from the list so the same data feeds both the Filters sheet and
  // the suggestion chip without a second request.
  useEffect(() => {
    fetch('/api/users/vehicles')
      .then(r => r.ok ? r.json() as Promise<{ vehicles: Vehicle[] }> : null)
      .then(data => { if (data?.vehicles) setVehicles(data.vehicles); })
      .catch(() => {});
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

  // ── Persist: Near Me state ────────────────────────────────────────────────

  useEffect(() => {
    if (!initCompleteRef.current || searchMode !== 'near_me' || !searchCenter) return;
    saveSession(SESSION_KEY_NEAR_ME, {
      center: searchCenter,
      radius: allIndiaMode ? 'all_india' : radius,
      viewMode,
      centerType,
    } satisfies NearMeSession);
  }, [searchMode, searchCenter, radius, allIndiaMode, viewMode, centerType]);

  // ── Persist: Along Route state ────────────────────────────────────────────

  useEffect(() => {
    if (!initCompleteRef.current || searchMode !== 'along_route') return;
    saveSession(SESSION_KEY_ALONG_ROUTE, {
      routeFrom: routeFrom ?? null,
      routeFromAddress,
      routeTo: routeTo ?? null,
      routeToAddress,
      fromIsGps,
    } satisfies AlongRouteSession);
  }, [searchMode, routeFrom, routeFromAddress, routeTo, routeToAddress, fromIsGps]);

  // ── Persist: last-used mode ───────────────────────────────────────────────

  useEffect(() => {
    if (!initCompleteRef.current) return;
    saveSession(SESSION_KEY_MODE, searchMode);
  }, [searchMode]);

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
    if (mode === 'along_route' && !featureFlags.route_planning_enabled) return;

    // Save the departing mode's state then restore the arriving mode's,
    // so each mode maintains independent state across switches.
    if (searchMode === 'near_me' && searchCenter) {
      saveSession(SESSION_KEY_NEAR_ME, {
        center: searchCenter,
        radius: allIndiaMode ? 'all_india' : radius,
        viewMode,
        centerType,
      } satisfies NearMeSession);
    } else if (searchMode === 'along_route') {
      saveSession(SESSION_KEY_ALONG_ROUTE, {
        routeFrom: routeFrom ?? null,
        routeFromAddress,
        routeTo: routeTo ?? null,
        routeToAddress,
        fromIsGps,
      } satisfies AlongRouteSession);
    }

    if (mode === 'near_me') {
      const saved = loadSession<NearMeSession>(SESSION_KEY_NEAR_ME);
      if (saved) {
        setSearchCenter(saved.center);
        setCenterType(saved.centerType === 'manual' ? 'manual' : 'default');
        setViewMode(saved.viewMode);
        const isAllIndia = saved.radius === 'all_india';
        setAllIndiaMode(isAllIndia);
        setRadius(isAllIndia ? RADIUS_STEPS[RADIUS_STEPS.length - 1] : Number(saved.radius));
      }
    } else {
      const saved = loadSession<AlongRouteSession>(SESSION_KEY_ALONG_ROUTE);
      if (saved) {
        if (saved.routeFrom) {
          setRouteFrom(saved.routeFrom);
          setRouteFromAddress(saved.routeFromAddress || saved.routeFrom.address);
        }
        if (saved.routeTo) {
          setRouteTo(saved.routeTo);
          setRouteToAddress(saved.routeToAddress || saved.routeTo.address);
        }
        if (saved.fromIsGps) setFromIsGps(true);
      }
    }

    saveSession(SESSION_KEY_MODE, mode);
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
    const debounceRef = pinId === 'from' ? dragDebounceFromRef : dragDebounceToRef;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
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
      setSearchCenter(gps);
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

  // ── Per-mode filter helpers ───────────────────────────────────────────────

  function setActiveFilters(updater: ExploreFilterState | ((prev: ExploreFilterState) => ExploreFilterState)) {
    if (isRouteMode) setRouteFilters(updater);
    else setNearMeFilters(updater);
  }

  function handleApplyFilters(filters: ExploreFilterState) {
    setActiveFilters(filters);
  }

  function resetFilters() {
    setActiveFilters(DEFAULT_FILTER_STATE);
  }

  function applyVehicleSuggestion() {
    if (!defaultVehicle) return;
    setActiveFilters(prev => ({
      ...prev,
      compatibility: { type: 'vehicle', vehicleId: defaultVehicle.id, connectorTypes: defaultVehicle.connector_types },
    }));
  }

  function dismissVehicleSuggestion() {
    if (isRouteMode) {
      setRouteSuggestionDismissed(true);
      try { sessionStorage.setItem(SESSION_KEY_SUGGESTION_DISMISSED_ROUTE, '1'); } catch {}
    } else {
      setNearMeSuggestionDismissed(true);
      try { sessionStorage.setItem(SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME, '1'); } catch {}
    }
  }

  function clearCompatibility() {
    setActiveFilters(prev => ({ ...prev, compatibility: { type: 'none' } }));
  }

  // Used by ChargerListView's inline connector toggles (manual mode).
  function toggleConnector(ct: string) {
    setActiveFilters(prev => {
      const currentSet = prev.compatibility.type === 'manual'
        ? new Set(prev.compatibility.connectors)
        : new Set<string>();
      currentSet.has(ct) ? currentSet.delete(ct) : currentSet.add(ct);
      const newCompat: CompatibilityState = currentSet.size === 0
        ? { type: 'none' }
        : { type: 'manual', connectors: currentSet };
      return { ...prev, compatibility: newCompat };
    });
  }

  // Used by ChargerListView's inline price slider.
  function handleMaxPriceChange(price: number) {
    setActiveFilters(prev => ({ ...prev, maxPrice: price }));
  }

  function bumpRadius() {
    const steps = Array.from(RADIUS_STEPS);
    const next = steps.find(s => isFinite(s) ? s > radius : true);
    if (next !== undefined) handleRadiusChange(next);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isRouteMode    = searchMode === 'along_route';
  const activeFilters  = isRouteMode ? routeFilters  : nearMeFilters;
  const suggestionDismissed = isRouteMode ? routeSuggestionDismissed : nearMeSuggestionDismissed;

  // The default vehicle is the vehicle with is_default=true, used for the suggestion chip.
  const defaultVehicle = vehicles.find(v => v.is_default) ?? null;

  // Resolve which connector set is currently active for charger filtering.
  const activeConnectors: Set<string> | null = (() => {
    const c = activeFilters.compatibility;
    if (c.type === 'vehicle') return new Set(c.connectorTypes);
    if (c.type === 'manual' && c.connectors.size > 0) return c.connectors;
    return null;
  })();

  // Suggestion chip: Compatibility = none, default vehicle with connectors exists, not dismissed.
  const showSuggestionChip =
    defaultVehicle !== null &&
    defaultVehicle.connector_types.length > 0 &&
    activeFilters.compatibility.type === 'none' &&
    !suggestionDismissed;

  // Active vehicle filter chip: Compatibility = vehicle (suggestion was accepted or set via Filters).
  const showVehicleFilterChip = activeFilters.compatibility.type === 'vehicle';

  function applyConnectorFilter(c: ChargerRow): boolean {
    if (!activeConnectors) return true;
    return (c.connector_types as string[]).some(ct => activeConnectors.has(ct));
  }

  const visibleChargers = chargers.filter(c => {
    if (!applyConnectorFilter(c)) return false;
    if (activeFilters.maxPrice < MAX_PRICE && Number(c.price_per_kwh) > activeFilters.maxPrice) return false;
    if (activeFilters.availability !== 'any' && c.status !== 'active') return false;
    if (activeFilters.powerFilter !== 'any' && c.charger_type !== activeFilters.powerFilter) return false;
    return true;
  });

  const visibleRouteChargers = routeChargers.filter(c => {
    if (!applyConnectorFilter(c)) return false;
    if (activeFilters.maxPrice < MAX_PRICE && Number(c.price_per_kwh) > activeFilters.maxPrice) return false;
    if (activeFilters.availability !== 'any' && c.status !== 'active') return false;
    if (activeFilters.powerFilter !== 'any' && c.charger_type !== activeFilters.powerFilter) return false;
    return true;
  });

  const hiddenByFilters = isRouteMode
    ? routeChargers.length - visibleRouteChargers.length
    : chargers.length - visibleChargers.length;

  // Badge counts ONE per filter DIMENSION deviating from Any — max 4.
  // Multiple manual connector chips still count as 1 (it's one Compatibility dimension).
  const activeFilterCount =
    (activeFilters.compatibility.type !== 'none' ? 1 : 0) +
    (activeFilters.maxPrice < MAX_PRICE ? 1 : 0) +
    (activeFilters.availability !== 'any' ? 1 : 0) +
    (activeFilters.powerFilter !== 'any' ? 1 : 0);
  const compatState = activeFilters.compatibility;
  const activeVehicle: FilterVehicle | null =
    compatState.type === 'vehicle'
      ? (vehicles.find(v => v.id === compatState.vehicleId) ?? null)
      : null;

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
    pricePerKwh: Number(c.price_per_kwh),
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

  const panelChargers = isRouteMode ? visibleRouteChargers : visibleChargers;

  // Scroll the results panel to the selected charger when it changes (desktop).
  useEffect(() => {
    if (!selectedCharger) return;
    chargerItemRefs.current[selectedCharger.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedCharger]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col',
        'desk:h-[calc(100dvh-var(--navbar-h))]',
        viewMode === 'map' ? 'h-dvh' : 'min-h-dvh',
      )}
    >
      {/* ── Header: segmented mode toggle + filters ────────────────────── */}
      <div className="border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-[calc(var(--screen-top-inset)+0.625rem)] md:px-5 desk:px-6">
          {featureFlags.route_planning_enabled && (
            <ModeToggle value={searchMode} onChange={handleSearchModeChange} />
          )}
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

        {/* ── Vehicle compatibility chips ────────────────────────────────── */}
        {showSuggestionChip && defaultVehicle && (
          <div className="flex items-center gap-2 px-3 pb-2.5 md:px-5 desk:px-6">
            <button
              type="button"
              onClick={applyVehicleSuggestion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-soft border border-green/30 text-xs font-semibold text-green-deep hover:bg-green/20 transition-colors"
            >
              {`Show chargers for ${defaultVehicle.nickname ?? 'your vehicle'}`}
            </button>
            <button
              type="button"
              onClick={dismissVehicleSuggestion}
              aria-label="Dismiss suggestion"
              className="shrink-0 size-5 rounded-full bg-gray-100 hover:bg-gray-200 grid place-items-center transition-colors text-muted hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        {showVehicleFilterChip && (
          <div className="flex items-center gap-2 px-3 pb-2.5 md:px-5 desk:px-6">
            <button
              type="button"
              onClick={clearCompatibility}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green text-white border border-green text-xs font-semibold hover:bg-green/90 transition-colors"
            >
              {`${activeVehicle?.nickname ?? 'Your vehicle'} · Compatible`}
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Content: column on mobile/tablet, row at desktop ─────────────── */}
      <div className="flex-1 flex flex-col desk:flex-row desk:overflow-hidden desk:min-h-0">

        {/* ── Map — map mode on mobile/tablet, always visible at desktop ──── */}
        <div
          className={cn(
            'relative overflow-hidden desk:flex-[3]',
            viewMode === 'map' ? 'flex-1' : 'hidden desk:block',
          )}
        >
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
              selectedChargerId={selectedCharger?.id}
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
                      <button onClick={resetFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
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
                      <button onClick={resetFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
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

          {/* Bottom sheet — mobile + tablet only (desk:hidden inside component) */}
          <ChargerBottomSheet
            charger={selectedCharger}
            distanceKm={selectedDistanceKm}
            distanceSuffix={isRouteMode ? 'off your route' : 'away'}
            onClose={() => setSelectedCharger(null)}
            defaultVehicle={defaultVehicle}
          />
        </div>

        {/* ── Results panel — desktop only ──────────────────────────────────── */}
        <aside
          className="hidden desk:flex desk:flex-col desk:flex-[2] border-l border-border bg-surface-page"
          aria-label="Charger results"
        >
          <div className="px-4 py-3 border-b border-border bg-surface-card shrink-0">
            <p className="text-sm font-semibold text-ink">
              {activeFetchLoading
                ? 'Searching…'
                : `${panelChargers.length} charger${panelChargers.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {panelChargers.length === 0 && !activeFetchLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
                <p className="text-sm font-semibold text-ink">No chargers found</p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-xs font-semibold text-green-deep underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              panelChargers.map(c => {
                const distKm = isRouteMode
                  ? (c as RouteCharger).distance_from_route_m / 1000
                  : searchCenter
                    ? haversineKm(searchCenter, { lat: Number(c.latitude), lng: Number(c.longitude) })
                    : undefined;
                const isSelected = selectedCharger?.id === c.id;
                const isHovered = panelHoveredId === c.id;
                const cover = c.photos?.[0];
                const powerLabel = PANEL_TYPE_LABEL[c.charger_type] ?? c.charger_type;
                const isActive = c.status === 'active';
                return (
                  <div
                    key={c.id}
                    ref={el => { chargerItemRefs.current[c.id] = el; }}
                    onMouseEnter={() => setPanelHoveredId(c.id)}
                    onMouseLeave={() => setPanelHoveredId(null)}
                    className={cn(
                      'transition-colors',
                      isSelected
                        ? 'bg-green-soft ring-2 ring-inset ring-green'
                        : isHovered
                          ? 'bg-surface-card'
                          : '',
                    )}
                  >
                    <Link href={`/explore/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-volt-soft">
                        {cover ? (
                          <img src={toJpegUrl(cover)} alt={c.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Zap className="w-5 h-5 text-volt opacity-40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink leading-snug line-clamp-1">{c.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {powerLabel} · <span className="font-semibold text-ink">₹{c.price_per_kwh}/kWh</span>
                        </p>
                        {distKm !== undefined && (
                          <p className="text-xs text-muted mt-0.5">
                            {distKm < 1
                              ? `${Math.round(distKm * 1000)} m`
                              : `${distKm.toFixed(1)} km`}
                            {' '}{isRouteMode ? 'off route' : 'away'}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 w-2 h-2 rounded-full',
                          isActive ? 'bg-green' : 'bg-gray-300',
                        )}
                      />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── List view — mobile/tablet only ──────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="flex-1 px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full desk:hidden">
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
              selectedConnectors={activeConnectors ?? new Set()}
              maxPrice={activeFilters.maxPrice}
              onConnectorToggle={toggleConnector}
              onMaxPriceChange={handleMaxPriceChange}
              onClearFilters={resetFilters}
            />
          </div>
        )}
      </div>

      {/* ── Floating view toggle — mobile/tablet only ── */}
      <div className="fixed bottom-20 right-4 z-30 desk:hidden">
        <FloatingViewToggle value={viewMode} onChange={handleViewModeChange} />
      </div>

      {/* Filter sheet */}
      <FilterSheet
        isOpen={filtersOpen}
        filters={activeFilters}
        vehicles={vehicles}
        onApply={handleApplyFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <PullToRefresh onRefresh={handleRefresh} />
    </div>
  );
}
