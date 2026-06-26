# Architecture — EV Charging App

## Map provider abstraction

### Why it exists

All map functionality (address autocomplete, geocoding, routing, map display) goes through a single interface at `src/lib/maps/`. Components never import Mapbox, Google Maps, or any other SDK directly. This keeps the provider swappable without touching UI code.

### Where all map code lives

```
src/lib/maps/
├── types.ts      ← Coords, PlaceSuggestion, GeocodeResult, RouteResult
├── provider.ts   ← MapProvider interface + exports the active provider as `maps`
├── mapbox.ts     ← Mapbox Geocoding v5 + Directions v5 implementation
└── README.md     ← Usage guide + how to add a new provider

src/components/maps/
├── MapView.tsx              ← Mapbox-GL map with markers and draggable pin
└── AddressAutocomplete.tsx  ← Input + dropdown calling maps.autocomplete()
```

`MapView.tsx` must be dynamically imported with `{ ssr: false }` because `mapbox-gl` uses browser DOM APIs.

### How to swap providers

To switch from Mapbox to another provider (e.g. Google Maps, HERE, TomTom):

1. Create `src/lib/maps/google.ts` (or equivalent) implementing the `MapProvider` interface from `provider.ts`.
2. Change the one import+export in `provider.ts`:
   ```diff
   - import { mapboxProvider } from './mapbox';
   - export const maps: MapProvider = mapboxProvider;
   + import { googleProvider } from './google';
   + export const maps: MapProvider = googleProvider;
   ```
3. Update `MapView.tsx` if the map rendering library changes (e.g. swap `react-map-gl` for Leaflet or Google Maps Embed).
4. Update env vars in `.env.example` and Vercel.

Estimated effort: 3–5 days.

### What is deliberately outside the abstraction

- **PostGIS spatial queries** — live in API routes and Supabase RPC functions. They are a database concern, not a provider concern.
- **Browser Geolocation API** — `navigator.geolocation` is a W3C standard; use it directly.
- **Marker and map styling** — configured in `MapView.tsx` using brand tokens (Tailwind + lucide-react). Changing visual style doesn't require touching the abstraction.
- **Map tile styles** — Mapbox style URL is in `MapView.tsx`. Swap it there directly.
