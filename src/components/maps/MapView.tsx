'use client';

// mapbox-gl styles — imported here so the CSS travels with the component.
// This file must be dynamically imported with { ssr: false } by its consumers.
import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapMouseEvent, MarkerDragEvent } from 'react-map-gl/mapbox';
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
  /** Renders a single draggable pin; fires onDragEnd with new coordinates. */
  draggablePin?: { coords: Coords; onDragEnd: (newCoords: Coords) => void };
  onMapClick?: (coords: Coords) => void;
};

export function MapView({
  center,
  zoom = 14,
  markers = [],
  userLocation,
  draggablePin,
  onMapClick,
}: MapViewProps) {
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
    [onMapClick],
  );

  const handleDragEnd = useCallback(
    (e: MarkerDragEvent) =>
      draggablePin?.onDragEnd({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
    [draggablePin],
  );

  return (
    <Map
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom }}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: '100%', height: '100%' }}
      onClick={onMapClick ? handleMapClick : undefined}
    >
      <NavigationControl position="top-right" showCompass={false} />

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
