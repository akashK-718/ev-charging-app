export type Coords = { lat: number; lng: number };

export type PlaceSuggestion = {
  id: string;            // Provider-specific opaque identifier
  primaryText: string;   // e.g. "Cyber Hub"
  secondaryText: string; // e.g. "Sector 24, Gurugram, Haryana"
  coords?: Coords;       // Available immediately from Mapbox; may require geocode() on other providers
};

export type GeocodeResult = {
  coords: Coords;
  formattedAddress: string;
};

export type RouteResult = {
  geometry: Coords[];      // Decoded polyline points
  distanceMeters: number;
  durationSeconds: number;
};

export interface MapProvider {
  autocomplete(query: string, options?: { country?: string; biasCoords?: Coords }): Promise<PlaceSuggestion[]>;
  geocode(placeId: string): Promise<GeocodeResult>;
  reverseGeocode(coords: Coords): Promise<GeocodeResult>;
  getRoute(from: Coords, to: Coords): Promise<RouteResult>;
}
