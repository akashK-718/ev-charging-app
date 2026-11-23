'use client';

import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { FeatureFlags } from '@/lib/edge-config';
import type { AlongRouteSession, NearMeSession, SearchMode } from '@/lib/explore/session';
import {
  DELHI_NCR,
  LEGACY_STORAGE_KEY,
  loadSession,
  readAlongRouteSession,
  readNearMeSession,
  resolveSearchMode,
  saveSession,
  SESSION_KEY_ALONG_ROUTE,
  SESSION_KEY_MODE,
  SESSION_KEY_NEAR_ME,
} from '@/lib/explore/session';
import type { Coords } from '@/lib/maps/types';
import { createClient } from '@/lib/supabase/client';
import { purgeLegacyKey } from '@/lib/user-storage';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { useExploreLocation } from './useExploreLocation';
import type { useExploreRoute } from './useExploreRoute';

type Options = {
  location: ReturnType<typeof useExploreLocation>;
  route: ReturnType<typeof useExploreRoute>;
  searchMode: SearchMode;
  setSearchMode: Dispatch<SetStateAction<SearchMode>>;
  viewMode: 'map' | 'list';
  setViewMode: Dispatch<SetStateAction<'map' | 'list'>>;
  featureFlags: Pick<FeatureFlags, 'route_planning_enabled'>;
  setSelectedCharger: Dispatch<SetStateAction<ChargerRow | null>>;
  showToastMsg: (message: string) => void;
};

export function useExploreSession({ location, route, searchMode, setSearchMode, viewMode, setViewMode, featureFlags, setSelectedCharger, showToastMsg }: Options) {
  const initialParams = useRef<URLSearchParams | null>(null);
  const initCompleteRef = useRef(false);
  const { searchCenter, setSearchCenter, centerType, setCenterType, setGpsCoords, setGpsAvailable, radius, setRadius, allIndiaMode, setAllIndiaMode, setLocationLoading } = location;
  const { routeFrom, setRouteFrom, routeFromAddress, setRouteFromAddress, routeTo, setRouteTo, routeToAddress, setRouteToAddress, setActiveRouteInput, fromIsGps, setFromIsGps, userClearedFromRef, setRouteEditOpen } = route;
  function restoreMode(mode: SearchMode) {
    if (mode === 'near_me') {
      const saved = readNearMeSession();
      if (!saved) return;
      setSearchCenter(saved.center);
      setCenterType(saved.centerType === 'manual' ? 'manual' : 'default');
      setViewMode(saved.viewMode);
      setAllIndiaMode(saved.radius === 'all_india');
      setRadius(saved.radius === 'all_india' ? Infinity : saved.radius);
    } else {
      const saved = readAlongRouteSession();
      if (!saved) return;
      setRouteFrom(saved.routeFrom);
      setRouteFromAddress(saved.routeFromAddress || saved.routeFrom?.address || '');
      setRouteTo(saved.routeTo);
      setRouteToAddress(saved.routeToAddress || saved.routeTo?.address || '');
      setFromIsGps(saved.fromIsGps);
    }
  }

  // ── Init: URL params → session state → user → purge legacy → GPS ──────────
  //
  // URL params are read synchronously at the top (before any await) so a
  // ?mode=near_me deeplink from Home always wins over saved session state —
  // this is the fix for non-deterministic Home shortcut behaviour.
  // initCompleteRef guards persist effects from writing during the async gap.

  useEffect(() => {
    let cancelled = false;

    // ── 1. URL params — read before any await so deeplinks are deterministic ──
    initialParams.current ??= new URLSearchParams(window.location.search);
    const urlParams = initialParams.current;
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
    let resolvedMode = resolveSearchMode(urlMode, sessionMode, featureFlags.route_planning_enabled);

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;


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
      // Persist explicitly: resolving to the initial React value does not rerun its effect.
      saveSession(SESSION_KEY_MODE, resolvedMode);

      // ── 4. Restore mode-specific session state ──────────────────────────────
      const savedNearMe = readNearMeSession();
      restoreMode(resolvedMode);

      // Ensure failed deep links and denied GPS still leave a usable search center.
      if (!savedNearMe) setSearchCenter(DELHI_NCR);

      // ── 5. Deeplinked charger ───────────────────────────────────────────────
      if (deeplinkedId) {
        const isCurrent = location.locationRequests.begin();
        void (async () => {
          try {
            const res = await fetch(`/api/chargers/${deeplinkedId}`);
            if (!res.ok) return;
            const body = await res.json() as { data: ChargerRow & { latitude: number; longitude: number } };
            if (cancelled || !isCurrent()) return;
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
      const hasSavedNearMe = !!savedNearMe;
      initCompleteRef.current = true;

      const isLocationCurrent = location.locationRequests.capture();
      if (!navigator.geolocation) {
        setGpsAvailable(false);
        if (!hasSavedNearMe && !deeplinkedId && isLocationCurrent()) {
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
          if (!deeplinkedId && isLocationCurrent() && (!savedNearMe || savedNearMe.centerType === 'gps')) {
            setSearchCenter(gps);
            setCenterType('gps');
          }
          setLocationLoading(false);
        },
        () => {
          if (cancelled) return;
          setGpsAvailable(false);
          if (!hasSavedNearMe && !deeplinkedId && isLocationCurrent()) {
            setSearchCenter(DELHI_NCR);
            showToastMsg('Showing chargers near Delhi. Set a location or allow GPS access to personalise.');
          }
          setLocationLoading(false);
        },
        { timeout: 8000 },
      );
    })().catch(() => {
      if (cancelled) return;
      initCompleteRef.current = true;
      setSearchCenter(DELHI_NCR);
      setLocationLoading(false);
      showToastMsg('Could not restore your location. Choose a location to search.');
    });

    return () => {
      cancelled = true;
      initCompleteRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!featureFlags.route_planning_enabled && searchMode === 'along_route') setSearchMode('near_me');
  }, [featureFlags.route_planning_enabled, searchMode, setSearchMode]);

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

    restoreMode(mode);

    saveSession(SESSION_KEY_MODE, mode);
    setSearchMode(mode);
    setSelectedCharger(null);
    setRouteEditOpen(false);
    if (mode === 'along_route') {
      setActiveRouteInput('from');
      userClearedFromRef.current = false; // allow GPS pre-fill on fresh entry to route mode
    }
  }

  return { handleSearchModeChange };
}
