'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default icons break in Next.js (webpack can't resolve the image URLs).
// Use CDN URLs to fix this without ejecting webpack config.
const MARKER_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationMapProps {
  lat: number;
  lng: number;
  /** Incremented by parent when user picks a new address (causes map to fly). */
  addressKey: number;
  onMarkerDrag: (lat: number, lng: number) => void;
}

// Inner component that has access to the map instance via hook.
function MapController({
  lat,
  lng,
  addressKey,
}: {
  lat: number;
  lng: number;
  addressKey: number;
}) {
  const map = useMap();
  const prevKey = useRef(addressKey);

  useEffect(() => {
    if (addressKey !== prevKey.current) {
      prevKey.current = addressKey;
      map.flyTo([lat, lng], 16, { duration: 0.4 });
    }
  }, [addressKey, lat, lng, map]);

  return null;
}

function DraggableMarker({
  lat,
  lng,
  onDrag,
}: {
  lat: number;
  lng: number;
  onDrag: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      draggable
      icon={MARKER_ICON}
      eventHandlers={{
        dragend: () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) onDrag(pos.lat, pos.lng);
        },
      }}
    />
  );
}

export default function LocationMap({
  lat,
  lng,
  addressKey,
  onMarkerDrag,
}: LocationMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom
      style={{ height: '260px', width: '100%' }}
      className="rounded-2xl overflow-hidden z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapController lat={lat} lng={lng} addressKey={addressKey} />
      <DraggableMarker lat={lat} lng={lng} onDrag={onMarkerDrag} />
    </MapContainer>
  );
}
