# Decision: Migrate map provider to Mapbox

**Date:** 2026-06-27  
**Branch:** `refactor/maps-abstraction-mapbox`  
**Status:** Accepted

## Context

The lender registration form (Step 3) originally used Google Maps Platform for address autocomplete and Leaflet + OpenStreetMap for the map display. The Google Places integration had a runtime-failure fallback (manual lat/lng entry) that was necessary because the API key might not be configured in all environments.

## Decision

Migrate to Mapbox for both address autocomplete and map display, and introduce a `MapProvider` abstraction layer at `src/lib/maps/` so providers can be swapped in the future without rewriting components.

## Reasons

1. **Cost** — Mapbox is significantly cheaper at scale than Google Maps Platform. At the expected volume for the Delhi NCR launch, Mapbox's free tier (50k loads/month) covers the MVP entirely.
2. **Developer experience** — Mapbox Geocoding API v5 returns coordinates in the same call as autocomplete suggestions, eliminating the two-step session-token flow required by Google Places.
3. **Indian coverage** — Mapbox's geocoding coverage for Delhi NCR is sufficient for the MVP. Major landmarks, sectors, and street-level addresses in Gurugram, Noida, and Delhi are well covered.
4. **Simpler code** — No API key detection, no runtime fallback mode, no script-tag injection. `NEXT_PUBLIC_MAPBOX_TOKEN` present → map works.
5. **Abstraction layer** — Makes the provider choice reversible without a large rewrite.

## Trade-offs acknowledged

- Mapbox coverage in tier-2/3 Indian cities is weaker than Google Maps. This is acceptable for the Delhi NCR launch but will need to be revisited before expanding.
- `react-map-gl@8` + `mapbox-gl@3` is a newer dependency pairing than the previous Leaflet stack. It adds ~200 KB to the client bundle.
- Mapbox tokens are public (exposed in client JS) and should be URL-restricted in the Mapbox dashboard.

## Abstraction layer as exit ramp

The `MapProvider` interface in `src/lib/maps/provider.ts` is the documented exit ramp. Switching back to Google (or to a hybrid mode where different features use different providers) is a 3–5 day effort: write a new `google.ts` implementation, change one import, update `MapView.tsx`.
