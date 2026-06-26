import type { MapProvider, PlaceSuggestion, GeocodeResult, RouteResult } from './types';

const BASE = 'https://api.mapbox.com';

function token(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
}

// ── Mapbox API response shapes ─────────────────────────────────────────────

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

interface MapboxDirectionsResponse {
  routes: Array<{
    geometry: { coordinates: [number, number][] };
    distance: number;
    duration: number;
  }>;
}

// ── ID encoding ────────────────────────────────────────────────────────────
//
// Mapbox Geocoding v5 doesn't support retrieve-by-ID. Since the autocomplete
// response already includes coordinates, we encode them into the opaque `id`
// field so geocode() can decode without a network round-trip.

const SEP = '||';

function encodeId(f: MapboxFeature): string {
  return [f.id, `${f.center[0]},${f.center[1]}`, f.place_name].join(SEP);
}

function decodeId(id: string): { lng: number; lat: number; placeName: string } | null {
  const parts = id.split(SEP);
  if (parts.length < 3) return null;
  const [lngStr, latStr] = parts[1].split(',');
  const lng = parseFloat(lngStr);
  const lat = parseFloat(latStr);
  if (isNaN(lng) || isNaN(lat)) return null;
  return { lng, lat, placeName: parts[2] };
}

// ── Provider implementation ────────────────────────────────────────────────

export const mapboxProvider: MapProvider = {
  async autocomplete(query, options = {}) {
    const country = (options.country ?? 'IN').toLowerCase();
    const url = new URL(
      `${BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set('access_token', token());
    url.searchParams.set('country', country);
    url.searchParams.set('language', 'en');
    url.searchParams.set('types', 'address,place,locality,neighborhood');
    url.searchParams.set('limit', '5');
    url.searchParams.set('autocomplete', 'true');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Mapbox geocoding error: ${res.status}`);
    const data = (await res.json()) as MapboxGeocodingResponse;

    return data.features.map((f): PlaceSuggestion => ({
      id: encodeId(f),
      primaryText: f.text,
      secondaryText: f.place_name.startsWith(f.text + ', ')
        ? f.place_name.slice(f.text.length + 2)
        : f.place_name,
      coords: { lat: f.center[1], lng: f.center[0] },
    }));
  },

  async geocode(placeId) {
    // Fast path: coords were embedded by encodeId() during autocomplete
    const decoded = decodeId(placeId);
    if (decoded) {
      return {
        coords: { lat: decoded.lat, lng: decoded.lng },
        formattedAddress: decoded.placeName,
      };
    }
    throw new Error('Unrecognised Mapbox place ID format');
  },

  async reverseGeocode(coords) {
    const url = new URL(
      `${BASE}/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json`,
    );
    url.searchParams.set('access_token', token());
    url.searchParams.set('types', 'address,place');
    url.searchParams.set('language', 'en');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Mapbox reverse geocoding error: ${res.status}`);
    const data = (await res.json()) as MapboxGeocodingResponse;
    const first = data.features[0];
    if (!first) throw new Error('No results for reverse geocoding');
    return {
      coords: { lat: first.center[1], lng: first.center[0] },
      formattedAddress: first.place_name,
    };
  },

  async getRoute(from, to) {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = new URL(`${BASE}/directions/v5/mapbox/driving/${coords}`);
    url.searchParams.set('access_token', token());
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Mapbox directions error: ${res.status}`);
    const data = (await res.json()) as MapboxDirectionsResponse;
    const route = data.routes[0];
    if (!route) throw new Error('No route found');

    return {
      geometry: route.geometry.coordinates.map(([lng, lat]): { lat: number; lng: number } => ({ lat, lng })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    } satisfies RouteResult;
  },
};
