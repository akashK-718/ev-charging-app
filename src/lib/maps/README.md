# Maps abstraction layer

All map-provider functionality in this app goes through `src/lib/maps/`. Components must not import Mapbox APIs (or any other map SDK) directly.

## Usage

```ts
import { maps } from '@/lib/maps/provider';
import type { Coords } from '@/lib/maps/types';

// Autocomplete (India only by default)
const suggestions = await maps.autocomplete('Cyber Hub');

// Geocode a place from a suggestion ID
const { coords, formattedAddress } = await maps.geocode(suggestions[0].id);

// Reverse geocode
const result = await maps.reverseGeocode({ lat: 28.46, lng: 77.03 });

// Driving route
const route = await maps.getRoute(from, to);
```

For UI, use the shared components instead of calling `maps` directly:
- **`<AddressAutocomplete />`** — `src/components/maps/AddressAutocomplete.tsx`
- **`<MapView />`** — `src/components/maps/MapView.tsx` (dynamically import with `ssr: false`)

## Swapping providers

All provider logic lives in a single file. To switch (e.g., back to Google or to a hybrid):

1. Create `src/lib/maps/google.ts` implementing `MapProvider` from `provider.ts`.
2. In `provider.ts`, change the import + export:
   ```diff
   - import { mapboxProvider } from './mapbox';
   - export const maps: MapProvider = mapboxProvider;
   + import { googleProvider } from './google';
   + export const maps: MapProvider = googleProvider;
   ```
3. Update `NEXT_PUBLIC_MAPBOX_TOKEN` → your new provider's env var.
4. Update `MapView.tsx` if the map rendering library changes (Mapbox ↔ Leaflet ↔ Google Maps embed).

Estimated effort to swap providers: 3–5 days (new `provider.ts` impl + `MapView.tsx` update + testing).

## What is NOT in this abstraction

- **PostGIS spatial queries** — stay in API routes and Supabase RPC functions.
- **Browser Geolocation API** — `navigator.geolocation` is a Web standard, use it directly.
- **Marker styling** — handled by `MapView.tsx` using brand tokens (lucide-react icons + Tailwind).
- **Map tile styles** — configured in `MapView.tsx`; changing visual style doesn't require touching the abstraction.
