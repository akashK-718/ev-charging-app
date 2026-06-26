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

type MarkerDef = {
  id: string;
  coords: Coords;
  label?: string;
  onClick?: () => void;
};

export type MapViewProps = {
  center: Coords;
  zoom?: number;
  /** Static pins. Use draggablePin for the editable lender-form pin. */
  markers?: MarkerDef[];
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

      {markers.map(m => (
        <Marker
          key={m.id}
          latitude={m.coords.lat}
          longitude={m.coords.lng}
          onClick={m.onClick ? () => m.onClick?.() : undefined}
        >
          <MapPin
            className="w-7 h-7 text-volt-deep drop-shadow-md"
            style={{ color: 'var(--color-volt-deep, #1a7a3c)' }}
            fill="currentColor"
          />
        </Marker>
      ))}

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
