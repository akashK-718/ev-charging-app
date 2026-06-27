'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CONNECTOR_TYPES } from '@/lib/constants';
import { haversineKm } from '@/lib/haversine';
import { cn } from '@/lib/utils';
import { MapListToggle } from '@/components/chargers/MapListToggle';
import { RadiusSlider } from '@/components/chargers/RadiusSlider';
import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import type { ChargerRow } from '@/components/chargers/ChargerCard';
import type { Coords } from '@/lib/maps/types';
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
const MAX_PRICE = 50;

export default function ChargersPage() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [isDefaultLocation, setIsDefaultLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [selectedCharger, setSelectedCharger] = useState<ChargerRow | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Restore preferred view mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chargers:viewMode');
    if (saved === 'map' || saved === 'list') setViewMode(saved);
  }, []);

  // Request geolocation on mount
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

  // Fetch chargers whenever location or radius changes
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
    if (userCoords) fetchChargers(userCoords, radius);
  }, [userCoords, radius, fetchChargers]);

  function handleViewModeChange(mode: 'map' | 'list') {
    setViewMode(mode);
    localStorage.setItem('chargers:viewMode', mode);
    if (selectedCharger) setSelectedCharger(null);
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

  // Client-side filter applied on top of radius-fetched results
  const visibleChargers = chargers.filter(c => {
    if (selectedConnectors.size > 0) {
      if (!(c.connector_types as string[]).some(ct => selectedConnectors.has(ct))) return false;
    }
    if (maxPrice < MAX_PRICE && Number(c.price_per_kwh) > maxPrice) return false;
    return true;
  });

  const mapCenter = userCoords ?? DELHI_NCR;

  const markers: MarkerDef[] = visibleChargers.map(c => ({
    id: c.id,
    coords: { lat: Number(c.latitude), lng: Number(c.longitude) },
    onClick: () => setSelectedCharger(c),
  }));

  const selectedDistanceKm = selectedCharger && userCoords
    ? haversineKm(userCoords, { lat: Number(selectedCharger.latitude), lng: Number(selectedCharger.longitude) })
    : undefined;

  const radiusKm = radius / 1000;
  const counterLabel = fetchLoading
    ? 'Searching…'
    : `${visibleChargers.length} charger${visibleChargers.length === 1 ? '' : 's'} within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`;

  return (
    <div
      className={cn(
        'flex flex-col',
        viewMode === 'map' ? 'h-[calc(100dvh-3.5rem)]' : 'min-h-[calc(100dvh-3.5rem)]',
      )}
    >
      {/* ── Header strip: title + toggle ───────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h1 className="font-display font-extrabold text-lg text-ink leading-tight">
            Find a charger
          </h1>
          {!locationLoading && isDefaultLocation && (
            <p className="text-[11px] text-muted">Delhi NCR</p>
          )}
        </div>
        <MapListToggle mode={viewMode} onChange={handleViewModeChange} />
      </div>

      {/* ── Map view ─────────────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <div className="flex-1 relative overflow-hidden">
          {/* Map */}
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
              onMapClick={() => setSelectedCharger(null)}
            />
          )}

          {/* ── Map overlay: controls ────────────────────────────── */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-3 pointer-events-auto">
                {/* Counter + radius label */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink">{counterLabel}</span>
                </div>

                {/* Radius slider */}
                <RadiusSlider value={radius} onChange={setRadius} />

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

                    {/* Price chip — clear only */}
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

          {/* ── Toast: location fallback ─────────────────────────── */}
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

          {/* ── Empty state overlay ──────────────────────────────── */}
          {!fetchLoading && !locationLoading && visibleChargers.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-24 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                <p className="font-semibold text-ink text-sm">
                  No chargers within {radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km
                </p>
                <p className="text-xs text-muted mt-1">Try increasing the radius.</p>
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

      {/* ── List view ────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="flex-1 px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
          <ChargerListView
            chargers={chargers}
            loading={fetchLoading || locationLoading}
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
