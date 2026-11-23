import type { Coords } from './types';
import { haversineKm } from '../haversine';

// ── Route geometry simplification ────────────────────────────────────────────
// Mapbox overview=full returns 1000+ points for long routes. URL-encoding that
// as a query param can exceed Vercel's 4 KB limit, causing silent 400 errors.
// We keep at most maxPoints coords — sufficient for ST_DWithin proximity checks.
export function simplifyRouteGeoJSON(geojson: string, maxPoints: number): string {
  try {
    const route = JSON.parse(geojson) as { type: string; coordinates: number[][] };
    const coords = route.coordinates;
    if (coords.length <= maxPoints) return geojson;
    const step = Math.ceil(coords.length / maxPoints);
    const simplified: number[][] = [];
    for (let i = 0; i < coords.length; i++) {
      if (i % step === 0 || i === coords.length - 1) simplified.push(coords[i]);
    }
    return JSON.stringify({ type: 'LineString', coordinates: simplified });
  } catch {
    return geojson;
  }
}

// ── Route geometry truncation ─────────────────────────────────────────────────
// Trims a GeoJSON LineString to the first maxMeters along the route.
// Returns the original string unchanged when maxMeters is Infinity (Entire route)
// or when the route is shorter than maxMeters.
export function truncateRouteGeometry(geojson: string, maxMeters: number): string {
  if (!isFinite(maxMeters)) return geojson;
  try {
    const route = JSON.parse(geojson) as { type: string; coordinates: number[][] };
    const coords = route.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return geojson;

    let accumulated = 0;
    const result: number[][] = [coords[0]];

    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      const segmentM = haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) * 1000;

      if (accumulated + segmentM >= maxMeters) {
        const fraction = segmentM > 0 ? (maxMeters - accumulated) / segmentM : 0;
        result.push([
          lng1 + fraction * (lng2 - lng1),
          lat1 + fraction * (lat2 - lat1),
        ]);
        break;
      }
      accumulated += segmentM;
      result.push(coords[i]);
    }

    if (result.length < 2) return geojson;
    return JSON.stringify({ type: 'LineString', coordinates: result });
  } catch {
    return geojson;
  }
}

export function computeRouteBounds(
  geometry: Coords[],
): [[number, number], [number, number]] | undefined {
  if (geometry.length < 2) return undefined;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of geometry) {
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}
