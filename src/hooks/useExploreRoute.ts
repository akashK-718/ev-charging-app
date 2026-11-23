'use client';

import { createRequestGuard } from '@/lib/explore/requests';
import type { RouteCharger, SearchMode } from '@/lib/explore/session';
import { DEFAULT_BUFFER } from '@/lib/explore/session';
import { maps } from '@/lib/maps/provider';
import type { Coords, RouteResult } from '@/lib/maps/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { useExploreLocation } from './useExploreLocation';

export function useExploreRoute(searchMode: SearchMode, location: ReturnType<typeof useExploreLocation>, setRouteChargers: (chargers: RouteCharger[]) => void, showToastMsg: (message: string) => void) {
  const { gpsCoords, gpsAvailable, setGpsCoords, setGpsAvailable, setSearchCenter } = location;
  // ── Route mode state ───────────────────────────────────────────────────────
  const [routeFrom, updateRouteFrom] = useState<{ coords: Coords; address: string } | null>(null);
  const [routeFromAddress, setRouteFromAddress] = useState('');
  const [routeTo, updateRouteTo] = useState<{ coords: Coords; address: string } | null>(null);
  const [routeToAddress, setRouteToAddress] = useState('');
  const [routeBuffer, setRouteBuffer] = useState(DEFAULT_BUFFER);
  /** Coverage in metres along the route (Infinity = Entire route). */
  const [routeCoverage, setRouteCoverage] = useState(Infinity);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
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

  const fromRequests = useRef(createRequestGuard()).current;
  const toRequests = useRef(createRequestGuard()).current;
  const swapTimer = useRef<ReturnType<typeof setTimeout>>();
  const setRouteFrom = useCallback((value: { coords: Coords; address: string } | null) => {
    fromRequests.invalidate();
    setGeocodingPin(current => current === 'from' ? null : current);
    updateRouteFrom(value);
    setRouteChargers([]);
  }, [fromRequests, setRouteChargers]);
  const setRouteTo = useCallback((value: { coords: Coords; address: string } | null) => {
    toRequests.invalidate();
    setGeocodingPin(current => current === 'to' ? null : current);
    updateRouteTo(value);
    setRouteChargers([]);
  }, [toRequests, setRouteChargers]);
  useEffect(() => () => {
    fromRequests.invalidate();
    toRequests.invalidate();
    clearTimeout(dragDebounceFromRef.current);
    clearTimeout(dragDebounceToRef.current);
    clearTimeout(swapTimer.current);
  }, [fromRequests, toRequests]);

  // ── Route: get route when From + To are set ───────────────────────────────

  useEffect(() => {
    if (!routeFrom || !routeTo) {
      setRouteLoading(false);
      setRouteResult(null);
      return;
    }
    setRouteResult(null);
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
  }, [routeFrom, routeTo, setRouteChargers]);

  // ── Pre-fill From with GPS when switching to route mode ───────────────────

  useEffect(() => {
    if (searchMode === 'along_route' && gpsCoords && !routeFrom && !userClearedFromRef.current) {
      setRouteFrom({ coords: gpsCoords, address: 'Your location' });
      setRouteFromAddress('Your location');
      setFromIsGps(true);
      setActiveRouteInput('to');
    }
  }, [searchMode, gpsCoords, routeFrom, setRouteFrom]);

  function placePin(pinId: 'from' | 'to', coords: Coords, delay = 0, advance = false) {
    const requests = pinId === 'from' ? fromRequests : toRequests;
    const timer = pinId === 'from' ? dragDebounceFromRef : dragDebounceToRef;
    const isCurrent = requests.begin();
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!isCurrent()) return;
      setGeocodingPin(pinId);
      let address = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      try { address = (await maps.reverseGeocode(coords)).formattedAddress; } catch { /* coordinate fallback */ }
      if (!isCurrent()) return;
      setGeocodingPin(current => current === pinId ? null : current);
      if (pinId === 'from') {
        setFromIsGps(false);
        setRouteFrom({ coords, address });
        setRouteFromAddress(address);
        if (advance) setActiveRouteInput('to');
      } else {
        setRouteTo({ coords, address });
        setRouteToAddress(address);
      }
    }, delay);
  }

  function handlePinDragEnd(pinId: 'from' | 'to', coords: Coords) {
    placePin(pinId, coords, 300);
  }

  function handleGpsRouteRefresh() {
    const isCurrent = fromRequests.begin();
    function applyGps(gps: Coords) {
      if (!isCurrent()) return;
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
    } else if (gpsAvailable === false || !navigator.geolocation) {
      showToastMsg('Location access denied. Enable it in your browser settings.');
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => applyGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          if (!isCurrent()) return;
          setGpsAvailable(false);
          showToastMsg('Could not get your location. Please enable location access.');
        },
        { timeout: 8000 },
      );
    }
  }

  function handleFromAddressChange(v: string) {
    fromRequests.invalidate();
    setGeocodingPin(current => current === 'from' ? null : current);
    setFromIsGps(false);
    userClearedFromRef.current = true; // typing also blocks a late GPS pre-fill
    setRouteFromAddress(v);
    if (v === '') {
      userClearedFromRef.current = true; // suppress GPS re-fill until user re-enters route mode
      setRouteFrom(null);
      setRouteResult(null);
      setRouteChargers([]);
    }
  }

  function handleToAddressChange(v: string) {
    toRequests.invalidate();
    setGeocodingPin(current => current === 'to' ? null : current);
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
    const fromCurrent = fromRequests.begin();
    const toCurrent = toRequests.begin();
    swapTimer.current = setTimeout(() => {
      if (!fromCurrent() || !toCurrent()) { setIsSwapping(false); return; }
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

  return { placePin, routeFrom, setRouteFrom, routeFromAddress, setRouteFromAddress, routeTo, setRouteTo, routeToAddress, setRouteToAddress, routeBuffer, setRouteBuffer, routeCoverage, setRouteCoverage, routeResult, setRouteResult, routeLoading, activeRouteInput, setActiveRouteInput, geocodingPin, setGeocodingPin, fromIsGps, setFromIsGps, userClearedFromRef, routeEditOpen, setRouteEditOpen, isSwapping, handlePinDragEnd, handleGpsRouteRefresh, handleFromAddressChange, handleToAddressChange, handleSwap };
}
