'use client';

import type { HistoryItem } from '@/types/activity';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

// Deterministic fuzz based on booking ID — stable per booking, ~350 m offset
function fuzzCoords(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  }
  const dLat = (((h & 0xff) - 127) / 127) * 0.003;
  const dLng = ((((h >> 8) & 0xff) - 127) / 127) * 0.003;
  return { lat: lat + dLat, lng: lng + dLng };
}

function staticMapUrl(lat: number, lng: number, seed: string): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return '';
  const { lat: fLat, lng: fLng } = fuzzCoords(lat, lng, seed);
  // GreenPath route green pin (#159a4c); privacy fuzz preserved
  const marker = `pin-s+159a4c(${fLng.toFixed(5)},${fLat.toFixed(5)})`;
  const center = `${fLng.toFixed(5)},${fLat.toFixed(5)},12`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${marker}/${center}/480x200@2x?access_token=${token}`;
}

// CSS filter that shifts Mapbox light-v11's warm-beige palette toward
// GreenPath's green-tinted palette (land #eef3ea, water #cfe4f4)
const MAP_FILTER = 'hue-rotate(55deg) saturate(0.75) brightness(1.01)';

export function SessionMapThumbnail({
  item, href, onError,
}: {
  item: HistoryItem;
  href: string;
  onError: () => void;
}) {
  const mapSrc = item.chargerLat !== null && item.chargerLng !== null
    ? staticMapUrl(item.chargerLat, item.chargerLng, item.bookingId)
    : null;

  return (
    <Link href={href} className="block h-36 bg-surface-page overflow-hidden">
      {mapSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapSrc}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: MAP_FILTER }}
          onError={onError}
        />
      ) : item.chargerPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.chargerPhoto} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <MapPin className="w-8 h-8 text-muted/40" aria-hidden />
        </div>
      )}
    </Link>
  );
}
