'use client';

import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { FeatureFlags } from '@/lib/edge-config';
import type { SearchMode } from '@/lib/explore/session';
import { maps } from '@/lib/maps/provider';
import type { Coords } from '@/lib/maps/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useExploreChargers } from './useExploreChargers';
import { useExploreLocation } from './useExploreLocation';
import { useExploreRoute } from './useExploreRoute';
import { useExploreSession } from './useExploreSession';

export function useExploreSearch() {
  const [selectedCharger, setSelectedCharger] = useState<ChargerRow | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToastMsg = useCallback((message: string, durationMs = 5000) => {
    setToastMessage(message);
    setShowToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), durationMs);
  }, []);
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

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [searchMode, setSearchMode] = useState<SearchMode>('near_me');
  const results = useExploreChargers(viewMode);
  const { fetchChargers, fetchRouteChargers, setRouteChargers } = results;
  const location = useExploreLocation(showToastMsg);
  const { searchCenter, radius, allIndiaMode, locationLoading, setSearchCenter, setCenterType, setSearchAddress } = location;
  const route = useExploreRoute(searchMode, location, setRouteChargers, showToastMsg);
  const { routeResult, routeBuffer, routeCoverage, activeRouteInput } = route;
  const { handleSearchModeChange } = useExploreSession({ location, route, searchMode, setSearchMode, viewMode, setViewMode, featureFlags, setSelectedCharger, showToastMsg });
  const isRouteMode = searchMode === 'along_route';
  // ── Near-me: fetch on centre / radius / mode change ───────────────────────

  useEffect(() => {
    if (locationLoading || searchMode !== 'near_me') return;
    void fetchChargers(searchCenter, radius, allIndiaMode);
  }, [searchCenter, radius, allIndiaMode, fetchChargers, locationLoading, searchMode]);

  // ── Route: fetch chargers when buffer changes (route already loaded) ───────

  useEffect(() => {
    if (!routeResult) return;
    void fetchRouteChargers(routeResult.geojson, routeBuffer, routeCoverage);
  }, [routeBuffer, routeCoverage, routeResult, fetchRouteChargers]);

  function handleViewModeChange(mode: 'map' | 'list') {
    setViewMode(mode);
    if (selectedCharger) setSelectedCharger(null);
  }

  async function handleLongPress(coords: Coords) {
    if (isRouteMode) {
      route.placePin(activeRouteInput, coords, 0, true);
    } else {
      setSearchCenter(coords);
      setCenterType('manual');
      const isCurrent = location.addressRequests.begin();
      try {
        const result = await maps.reverseGeocode(coords);
        if (isCurrent()) setSearchAddress(result.formattedAddress);
      } catch {
        if (isCurrent()) setSearchAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      }
    }
  }

  const handleRefresh = useCallback(async () => {
    if (searchMode === 'along_route' && routeResult) {
      await fetchRouteChargers(routeResult.geojson, routeBuffer, routeCoverage);
    } else if (searchMode === 'near_me') {
      await fetchChargers(searchCenter, radius, allIndiaMode);
    }
  }, [searchMode, routeResult, routeBuffer, routeCoverage, fetchRouteChargers, searchCenter, radius, allIndiaMode, fetchChargers]);

  return { ...location, ...route, ...results, viewMode, searchMode, featureFlags, selectedCharger, setSelectedCharger, showToast, toastMessage, handleViewModeChange, handleSearchModeChange, handleLongPress, handleRefresh };
}
