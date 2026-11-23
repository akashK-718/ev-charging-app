'use client';

import { createRequestGuard } from '@/lib/explore/requests';
import { DEFAULT_RADIUS } from '@/lib/explore/session';
import { maps } from '@/lib/maps/provider';
import type { Coords } from '@/lib/maps/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useExploreLocation(showToastMsg: (message: string) => void) {
  // ── Near-me: search centre ────────────────────────────────────────────────
  const [searchCenter, updateSearchCenter] = useState<Coords | null>(null);
  const [centerType, setCenterType] = useState<'gps' | 'manual' | 'default'>('default');
  const [searchAddress, setSearchAddress] = useState('');

  // GPS position — kept fresh independently of searchCenter
  const [gpsCoords, setGpsCoords] = useState<Coords | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState<boolean | null>(null);

  // ── Near-me: data ─────────────────────────────────────────────────────────
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [allIndiaMode, setAllIndiaMode] = useState(false);

  const [locationLoading, setLocationLoading] = useState(true);
  const locationRequests = useRef(createRequestGuard()).current;
  const addressRequests = useRef(createRequestGuard()).current;
  const setSearchCenter = useCallback((coords: Coords | null) => {
    locationRequests.invalidate();
    addressRequests.invalidate();
    updateSearchCenter(coords);
  }, [locationRequests, addressRequests]);
  useEffect(() => () => {
    locationRequests.invalidate();
    addressRequests.invalidate();
  }, [locationRequests, addressRequests]);

  function handleAddressSelect({ coords, address }: { coords: Coords; address: string }) {
    setSearchCenter(coords);
    setCenterType('manual');
    setSearchAddress(address);
  }

  function handleAddressChange(v: string) {
    locationRequests.invalidate();
    addressRequests.invalidate();
    setSearchAddress(v);
    if (v === '' && gpsCoords && gpsAvailable === true) {
      setSearchCenter(gpsCoords);
      setCenterType('gps');
    }
  }

  async function handleUseGpsLocation() {
    const isCurrent = locationRequests.begin();
    async function apply(gps: Coords) {
      if (!isCurrent()) return;
      setGpsCoords(gps);
      setGpsAvailable(true);
      setSearchCenter(gps);
      setCenterType('gps');
      const isAddressCurrent = addressRequests.begin();
      try {
        const result = await maps.reverseGeocode(gps);
        if (isAddressCurrent()) setSearchAddress(result.formattedAddress);
      } catch {
        if (isAddressCurrent()) setSearchAddress('');
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
        if (!isCurrent()) return;
        setGpsAvailable(false);
        showToastMsg('Location access denied. Enable it in your browser settings.');
      },
      { timeout: 8000 },
    );
  }

  function handleRadiusChange(meters: number) {
    if (!isFinite(meters)) {
      setAllIndiaMode(true);
    } else {
      setAllIndiaMode(false);
      setRadius(meters);
    }
  }

  return { locationRequests, addressRequests, searchCenter, setSearchCenter, centerType, setCenterType, searchAddress, setSearchAddress, gpsCoords, setGpsCoords, gpsAvailable, setGpsAvailable, radius, setRadius, allIndiaMode, setAllIndiaMode, locationLoading, setLocationLoading, handleAddressSelect, handleAddressChange, handleUseGpsLocation, handleRadiusChange };
}
