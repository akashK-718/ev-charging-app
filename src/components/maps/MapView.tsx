'use client';

// mapbox-gl styles — imported here so the CSS travels with the component.
// This file must be dynamically imported with { ssr: false } by its consumers.
import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent, MapTouchEvent, MarkerDragEvent, LayerProps } from 'react-map-gl/mapbox';
import { MapPin, Crosshair } from 'lucide-react';
import type { Coords } from '@/lib/maps/types';
import { makeCircleGeoJSON } from '@/lib/maps/mapbox';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Brand colours in hex — CSS vars don't work inside Mapbox layer paint specs.
const VOLT = '#10d96a';
const INK = '#0c1611';

// ── Public types ─────────────────────────────────────────────────────────────

export type MarkerDef = {
  id: string;
  coords: Coords;
  label?: string;
  /** 'green' = active charger (volt), 'gray' = paused. Default: 'green'. */
  color?: 'green' | 'gray';
  onClick?: () => void;
};

export type ChargerMarkerData = {
  id: string;
  coords: Coords;
  status?: 'active' | 'paused';
};

export type MapViewProps = {
  center: Coords;
  zoom?: number;
  /** When true, animates the camera to fit all of India. */
  fitIndia?: boolean;

  // ── Driver map: GeoJSON clustered charger markers ────────────────────────
  chargerMarkers?: ChargerMarkerData[];
  /** Draws a translucent radius circle around `center` (metres). */
  searchRadius?: number;
  /** Blue pulsing dot — real GPS position. */
  userLocation?: Coords;
  /** Crosshair pin — user's manually selected search centre. */
  manualCenter?: Coords;

  // ── Route mode ────────────────────────────────────────────────────────────
  /** Decoded polyline to render as a route overlay. */
  routeGeometry?: Coords[];
  /** Route buffer radius in meters — controls width of the buffer visualisation. */
  routeBuffer?: number;
  /** Green A-marker at the route start. */
  fromCoords?: Coords;
  /** Red B-marker at the route end. */
  toCoords?: Coords;
  /**
   * When this value changes the map camera fits these bounds.
   * Format: [[minLng, minLat], [maxLng, maxLat]]
   */
  fitBoundsTarget?: [[number, number], [number, number]];

  // ── Events ───────────────────────────────────────────────────────────────
  onChargerClick?: (id: string) => void;
  /** Fires after a 500 ms hold with no significant finger/pointer movement. */
  onLongPress?: (coords: Coords) => void;
  /** Fires on empty-map tap (no charger, no cluster was hit). */
  onMapClick?: (coords: Coords) => void;

  // ── Legacy — lender form ─────────────────────────────────────────────────
  markers?: MarkerDef[];
  draggablePin?: { coords: Coords; onDragEnd: (newCoords: Coords) => void };
};

// ── Mapbox layer specs ────────────────────────────────────────────────────────

const clusterLayer: LayerProps = {
  id: 'chargers-clusters',
  type: 'circle',
  source: 'chargers',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': VOLT,
    'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};

const clusterCountLayer: LayerProps = {
  id: 'chargers-cluster-count',
  type: 'symbol',
  source: 'chargers',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 12,
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
  },
  paint: { 'text-color': INK },
};

const unclusteredLayer: LayerProps = {
  id: 'chargers-point',
  type: 'circle',
  source: 'chargers',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': VOLT,
    'circle-radius': 8,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
    'circle-opacity': ['case', ['==', ['get', 'status'], 'paused'], 0.45, 1],
  },
};

const radiusFillLayer: LayerProps = {
  id: 'radius-fill',
  type: 'fill',
  source: 'radius-circle',
  paint: { 'fill-color': VOLT, 'fill-opacity': 0.08 },
};

const radiusOutlineLayer: LayerProps = {
  id: 'radius-outline',
  type: 'line',
  source: 'radius-circle',
  paint: { 'line-color': VOLT, 'line-opacity': 0.6, 'line-width': 1.5 },
};

const routeLineLayer: LayerProps = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': VOLT, 'line-width': 4, 'line-opacity': 0.9 },
};

function makeRouteBufferLayer(bufferM: number): LayerProps {
  const km = bufferM / 1000;
  const widthExpr = [
    'interpolate', ['exponential', 2], ['zoom'],
    6,  km * 0.9,
    8,  km * 3.5,
    10, km * 14,
    12, km * 56,
    14, km * 225,
  ] as unknown as number;
  return {
    id: 'route-buffer',
    type: 'line',
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#e4faee', 'line-width': widthExpr, 'line-opacity': 0.55, 'line-blur': 6 },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapView({
  center,
  zoom = 12,
  fitIndia = false,
  chargerMarkers = [],
  searchRadius,
  userLocation,
  manualCenter,
  routeGeometry,
  routeBuffer = 2500,
  fromCoords,
  toCoords,
  fitBoundsTarget,
  onChargerClick,
  onLongPress,
  onMapClick,
  markers = [],
  draggablePin,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const prevCenter = useRef<Coords | null>(null);
  const prevFitIndia = useRef(false);
  const prevFitBoundsKey = useRef<string | null>(null);

  // Long-press state
  const lpTimer = useRef<ReturnType<typeof setTimeout>>();
  const lpData = useRef<{ coords: Coords; startX: number; startY: number } | null>(null);
  const justLongPressed = useRef(false);

  const [cursor, setCursor] = useState('');

  // ── GeoJSON data ──────────────────────────────────────────────────────────

  const chargerGeoJSON = {
    type: 'FeatureCollection' as const,
    features: chargerMarkers.map(c => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.coords.lng, c.coords.lat] },
      properties: { id: c.id, status: c.status ?? 'active' },
    })),
  };

  const circleGeoJSON =
    searchRadius && isFinite(searchRadius) && searchRadius > 0
      ? makeCircleGeoJSON(center, searchRadius)
      : null;

  const routeGeoJSON = routeGeometry
    ? {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: routeGeometry.map(c => [c.lng, c.lat]),
        },
        properties: {},
      }
    : null;

  // ── Camera: fly to center when the prop changes ───────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;
    if (prevCenter.current === null) {
      prevCenter.current = center;
      return;
    }
    if (prevCenter.current.lat !== center.lat || prevCenter.current.lng !== center.lng) {
      prevCenter.current = center;
      mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: zoom ?? 12, duration: 800 });
    }
  }, [center, zoom]);

  // ── Camera: All India / back to centre ───────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;
    if (fitIndia && !prevFitIndia.current) {
      mapRef.current.fitBounds([[68, 8], [97, 37]], { padding: 30, duration: 800 });
    } else if (!fitIndia && prevFitIndia.current) {
      mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: zoom ?? 12, duration: 800 });
    }
    prevFitIndia.current = fitIndia;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitIndia]);

  // ── Camera: fit route bounds ──────────────────────────────────────────────

  useEffect(() => {
    if (!fitBoundsTarget) return;
    const key = JSON.stringify(fitBoundsTarget);
    if (key === prevFitBoundsKey.current) return;
    prevFitBoundsKey.current = key;
    mapRef.current?.fitBounds(fitBoundsTarget, { padding: 60, duration: 800 });
  }, [fitBoundsTarget]);

  // ── Long-press helpers ────────────────────────────────────────────────────

  const startLongPress = useCallback(
    (coords: Coords, x: number, y: number) => {
      clearTimeout(lpTimer.current);
      lpData.current = { coords, startX: x, startY: y };
      lpTimer.current = setTimeout(() => {
        if (lpData.current && onLongPress) {
          justLongPressed.current = true;
          onLongPress(lpData.current.coords);
          lpData.current = null;
          setTimeout(() => { justLongPressed.current = false; }, 400);
        }
      }, 500);
    },
    [onLongPress],
  );

  const cancelLongPress = useCallback((x?: number, y?: number) => {
    if (x !== undefined && y !== undefined && lpData.current) {
      const dx = x - lpData.current.startX;
      const dy = y - lpData.current.startY;
      if (dx * dx + dy * dy < 25) return; // moved < 5 px — keep timer
    }
    clearTimeout(lpTimer.current);
    lpData.current = null;
  }, []);

  // ── Map event handlers ────────────────────────────────────────────────────

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      if (justLongPressed.current) return;

      const map = mapRef.current?.getMap();
      if (!map) return;

      // Cluster tap → zoom in to expand
      const clusterFeats = map.queryRenderedFeatures(e.point, { layers: ['chargers-clusters'] });
      if (clusterFeats.length > 0) {
        const f = clusterFeats[0];
        const clusterId = (f.properties as { cluster_id: number }).cluster_id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [lng, lat] = (f.geometry as any).coordinates as [number, number];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = map.getSource('chargers') as any;
        src?.getClusterExpansionZoom(
          clusterId,
          (err: Error | null, expansionZoom: number | null) => {
            if (err || expansionZoom == null) return;
            mapRef.current?.easeTo({ center: [lng, lat], zoom: expansionZoom, duration: 400 });
          },
        );
        return;
      }

      // Individual charger tap
      const pointFeats = map.queryRenderedFeatures(e.point, { layers: ['chargers-point'] });
      if (pointFeats.length > 0) {
        onChargerClick?.((pointFeats[0].properties as { id: string }).id);
        return;
      }

      // Empty map area tap
      onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    },
    [onChargerClick, onMapClick],
  );

  const handleMouseDown = useCallback(
    (e: MapMouseEvent) => {
      if (e.originalEvent.button !== 0 || !onLongPress) return;
      startLongPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }, e.point.x, e.point.y);
    },
    [onLongPress, startLongPress],
  );

  const handleMouseMove = useCallback(
    (e: MapMouseEvent) => {
      cancelLongPress(e.point.x, e.point.y);
      const map = mapRef.current?.getMap();
      if (!map) return;
      const feats = map.queryRenderedFeatures(e.point, {
        layers: ['chargers-clusters', 'chargers-point'],
      });
      setCursor(feats.length > 0 ? 'pointer' : '');
    },
    [cancelLongPress],
  );

  const handleMouseUp = useCallback(() => {
    clearTimeout(lpTimer.current);
    lpData.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: MapTouchEvent) => {
      if (!onLongPress || e.points.length !== 1) return;
      const [pt] = e.points;
      startLongPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }, pt.x, pt.y);
    },
    [onLongPress, startLongPress],
  );

  const handleTouchMove = useCallback(() => cancelLongPress(), [cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(lpTimer.current);
    lpData.current = null;
  }, []);

  const handleDragEnd = useCallback(
    (e: MarkerDragEvent) => draggablePin?.onDragEnd({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
    [draggablePin],
  );

  const bufferLayer = makeRouteBufferLayer(routeBuffer);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: '100%', height: '100%' }}
      cursor={cursor}
      onClick={handleClick}
      onMouseDown={onLongPress ? handleMouseDown : undefined}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={onLongPress ? handleTouchStart : undefined}
      onTouchMove={onLongPress ? handleTouchMove : undefined}
      onTouchEnd={onLongPress ? handleTouchEnd : undefined}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Route: buffer halo + centre line (rendered below charger markers) */}
      {routeGeoJSON && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer {...bufferLayer} />
          <Layer {...routeLineLayer} />
        </Source>
      )}

      {/* Search radius circle */}
      {circleGeoJSON && (
        <Source id="radius-circle" type="geojson" data={circleGeoJSON}>
          <Layer {...radiusFillLayer} />
          <Layer {...radiusOutlineLayer} />
        </Source>
      )}

      {/* Clustered charger markers */}
      <Source
        id="chargers"
        type="geojson"
        data={chargerGeoJSON}
        cluster={true}
        clusterMaxZoom={13}
        clusterRadius={50}
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredLayer} />
      </Source>

      {/* Route From (A) endpoint */}
      {fromCoords && (
        <Marker latitude={fromCoords.lat} longitude={fromCoords.lng} anchor="bottom">
          <div className="w-7 h-7 rounded-full bg-volt border-2 border-white shadow-md flex items-center justify-center">
            <span className="text-ink text-xs font-bold leading-none">A</span>
          </div>
        </Marker>
      )}

      {/* Route To (B) endpoint */}
      {toCoords && (
        <Marker latitude={toCoords.lat} longitude={toCoords.lng} anchor="bottom">
          <div className="w-7 h-7 rounded-full bg-red-500 border-2 border-white shadow-md flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">B</span>
          </div>
        </Marker>
      )}

      {/* User location — blue pulsing dot */}
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-md" />
          </span>
        </Marker>
      )}

      {/* Manual search centre — crosshair icon */}
      {manualCenter && (
        <Marker latitude={manualCenter.lat} longitude={manualCenter.lng}>
          <Crosshair className="w-7 h-7 text-ink drop-shadow-md" strokeWidth={1.5} />
        </Marker>
      )}

      {/* Legacy DOM markers — lender form */}
      {markers.map(m => {
        const isGray = m.color === 'gray';
        return (
          <Marker
            key={m.id}
            latitude={m.coords.lat}
            longitude={m.coords.lng}
            onClick={
              m.onClick
                ? e => {
                    e.originalEvent.stopPropagation();
                    m.onClick?.();
                  }
                : undefined
            }
          >
            <MapPin
              className="w-7 h-7 drop-shadow-md"
              style={{
                color: isGray ? '#6d7a72' : '#0a9e4c',
                cursor: m.onClick ? 'pointer' : 'default',
              }}
              fill="currentColor"
            />
          </Marker>
        );
      })}

      {/* Draggable lender-form pin */}
      {draggablePin && (
        <Marker
          latitude={draggablePin.coords.lat}
          longitude={draggablePin.coords.lng}
          draggable
          onDragEnd={handleDragEnd}
        >
          <MapPin
            className="w-8 h-8 drop-shadow-lg cursor-grab active:cursor-grabbing"
            style={{ color: '#0a9e4c' }}
            fill="currentColor"
          />
        </Marker>
      )}
    </Map>
  );
}
