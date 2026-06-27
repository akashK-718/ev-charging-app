'use client';

// mapbox-gl styles — imported here so the CSS travels with the component.
// This file must be dynamically imported with { ssr: false } by its consumers.
import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback, useEffect, useRef } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent, MarkerDragEvent, LayerProps } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import type { Coords } from '@/lib/maps/types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export type MarkerDef = {
  id: string;
  coords: Coords;
  label?: string;
  /** 'green' = active charger (volt), 'gray' = paused charger. Default: 'green'. */
  color?: 'green' | 'gray';
  onClick?: () => void;
};

export type MapViewProps = {
  center: Coords;
  zoom?: number;
  /** Static pins. Use draggablePin for the editable lender-form pin. */
  markers?: MarkerDef[];
  /** Blue dot at the user's current location. */
  userLocation?: Coords;
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
  /** Renders a single draggable pin; fires onDragEnd with new coordinates. */
  draggablePin?: { coords: Coords; onDragEnd: (newCoords: Coords) => void };
  onMapClick?: (coords: Coords) => void;
};

// Route buffer layer — wide, blurred, volt-soft colour
function makeRouteBufferLayer(bufferM: number): LayerProps {
  const km = bufferM / 1000;
  // Approximate pixel width per zoom level (India latitude, ~22°N)
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
    paint: {
      'line-color': '#e4faee',
      'line-width': widthExpr,
      'line-opacity': 0.55,
      'line-blur': 6,
    },
  };
}

const routeLineLayer: LayerProps = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#10d96a',
    'line-width': 4,
    'line-opacity': 0.9,
  },
};

export function MapView({
  center,
  zoom = 14,
  markers = [],
  userLocation,
  routeGeometry,
  routeBuffer = 2500,
  fromCoords,
  toCoords,
  fitBoundsTarget,
  draggablePin,
  onMapClick,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const prevFitKey = useRef<string | null>(null);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
    [onMapClick],
  );

  const handleDragEnd = useCallback(
    (e: MarkerDragEvent) =>
      draggablePin?.onDragEnd({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
    [draggablePin],
  );

  // Fit camera when fitBoundsTarget changes
  useEffect(() => {
    if (!fitBoundsTarget) return;
    const key = JSON.stringify(fitBoundsTarget);
    if (key === prevFitKey.current) return;
    prevFitKey.current = key;
    mapRef.current?.fitBounds(fitBoundsTarget, { padding: 60, duration: 800 });
  }, [fitBoundsTarget]);

  // Build GeoJSON for route Source
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

  const bufferLayer = makeRouteBufferLayer(routeBuffer);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: '100%', height: '100%' }}
      onClick={onMapClick ? handleMapClick : undefined}
    >
      <NavigationControl position="top-right" showCompass={false} />

      {/* Route: buffer halo + centre line */}
      {routeGeoJSON && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer {...bufferLayer} />
          <Layer {...routeLineLayer} />
        </Source>
      )}

      {/* From (A) endpoint */}
      {fromCoords && (
        <Marker latitude={fromCoords.lat} longitude={fromCoords.lng} anchor="bottom">
          <div className="w-7 h-7 rounded-full bg-volt border-2 border-white shadow-md flex items-center justify-center">
            <span className="text-ink text-xs font-bold leading-none">A</span>
          </div>
        </Marker>
      )}

      {/* To (B) endpoint */}
      {toCoords && (
        <Marker latitude={toCoords.lat} longitude={toCoords.lng} anchor="bottom">
          <div className="w-7 h-7 rounded-full bg-red-500 border-2 border-white shadow-md flex items-center justify-center">
            <span className="text-white text-xs font-bold leading-none">B</span>
          </div>
        </Marker>
      )}

      {/* Charger markers */}
      {markers.map(m => {
        const isGray = m.color === 'gray';
        return (
          <Marker
            key={m.id}
            latitude={m.coords.lat}
            longitude={m.coords.lng}
            onClick={m.onClick ? () => m.onClick?.() : undefined}
          >
            <MapPin
              className="w-7 h-7 drop-shadow-md"
              style={{
                color: isGray
                  ? 'var(--color-muted, #6b7280)'
                  : 'var(--color-volt-deep, #1a7a3c)',
                cursor: m.onClick ? 'pointer' : 'default',
              }}
              fill="currentColor"
            />
          </Marker>
        );
      })}

      {/* User location — blue pulsing dot */}
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-md" />
          </span>
        </Marker>
      )}

      {/* Draggable lender-form pin */}
      {draggablePin && (
        <Marker
          latitude={draggablePin.coords.lat}
          longitude={draggablePin.coords.lng}
          draggable
          onDragEnd={handleDragEnd}
        >
          <MapPin
            className="w-8 h-8 text-volt-deep drop-shadow-lg cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--color-volt-deep, #1a7a3c)' }}
            fill="currentColor"
          />
        </Marker>
      )}
    </Map>
  );
}
