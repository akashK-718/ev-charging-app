'use client';

import { createRequestGuard } from '@/lib/explore/requests';
import type { RouteCharger } from '@/lib/explore/session';
import { simplifyRouteGeoJSON, truncateRouteGeometry } from '@/lib/maps/geometry';
import type { Coords } from '@/lib/maps/types';
import type { Database } from '@/lib/supabase/types';
import { useCallback, useEffect, useRef, useState } from 'react';
type ChargerRow = Database['public']['Tables']['chargers']['Row'];

/** Owns near-me and route result loading; callers decide when a search is needed. */
export function useExploreChargers(viewMode: 'map' | 'list') {
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [routeChargers, updateRouteChargers] = useState<RouteCharger[]>([]);
  const [routeFetchLoading, setRouteFetchLoading] = useState(false);
  /** Server total before the result cap; zero when results are not capped. */
  const [routeChargerTotal, setRouteChargerTotal] = useState(0);
  const nearRequests = useRef(createRequestGuard()).current;
  const routeRequests = useRef(createRequestGuard()).current;
  const setRouteChargers = useCallback((chargers: RouteCharger[]) => {
    routeRequests.invalidate();
    updateRouteChargers(chargers);
    setRouteFetchLoading(false);
    setRouteChargerTotal(0);
  }, [routeRequests]);
  useEffect(() => () => {
    nearRequests.invalidate();
    routeRequests.invalidate();
  }, [nearRequests, routeRequests]);
  const fetchChargers = useCallback(
    async (coords: Coords | null, radiusM: number, india: boolean) => {
      const isCurrent = nearRequests.begin();
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
        if (isCurrent()) setChargers(json.chargers ?? []);
      } catch {
        if (isCurrent()) setChargers([]);
      } finally {
        if (isCurrent()) setFetchLoading(false);
      }
    },
    [viewMode, nearRequests],
  );

  const fetchRouteChargers = useCallback(async (
    geojson: string,
    bufferM: number,
    coverageM: number,
  ) => {
    const isCurrent = routeRequests.begin();
    setRouteFetchLoading(true);
    setRouteChargerTotal(0);
    try {
      // 1. Truncate to coverage distance (no-op when coverageM = Infinity).
      const truncated = truncateRouteGeometry(geojson, coverageM);
      // 2. Simplify point count before sending — full Mapbox routes can be 1000+ points,
      //    easily exceeding Vercel's 4 KB query-string limit and causing silent 400s.
      const simplified = simplifyRouteGeoJSON(truncated, 100);
      const params = new URLSearchParams({ route: simplified, buffer: String(bufferM) });
      const res = await fetch(`/api/chargers?${params}`);
      if (!isCurrent()) return;
      if (!res.ok) {
        console.error('[fetchRouteChargers] API error', res.status, await res.text().catch(() => ''));
        if (isCurrent()) updateRouteChargers([]);
        return;
      }
      const json = await res.json() as { chargers?: RouteCharger[]; total?: number; error?: string };
      if (!isCurrent()) return;
      if (json.error) console.error('[fetchRouteChargers] RPC error:', json.error);
      updateRouteChargers(json.chargers ?? []);
      setRouteChargerTotal(json.total ?? 0);
    } catch {
      if (isCurrent()) updateRouteChargers([]);
    } finally {
      if (isCurrent()) setRouteFetchLoading(false);
    }
  }, [routeRequests]);

  return { chargers, fetchLoading, routeChargers, routeFetchLoading, routeChargerTotal, setRouteChargers, fetchChargers, fetchRouteChargers };
}
