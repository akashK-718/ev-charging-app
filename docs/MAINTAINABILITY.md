# Maintaining Kirin

## How the application fits together

Kirin is one Next.js application. `src/app` contains URL entry points and API handlers. Shared UI lives in `src/components`, client lifecycle logic in `src/hooks`, and integrations and domain utilities in `src/lib`. Supabase supplies authentication, PostgreSQL, and spatial queries; Razorpay, Mapbox, Cloudinary, Firebase, and Edge Config supply individual capabilities.

Session validation and redirects begin in `src/middleware.ts`. API handlers also validate the authenticated user before performing work. Server code uses either the session-aware Supabase client or the service role client; authorization must happen before service role operations because that client bypasses row-level security.

## Module boundaries

- Keep pages responsible for loading data and composing UI. Extract a domain calculation or repeated integration workflow when it has a clear input and output.
- Keep API handlers responsible for authentication, request validation, and HTTP responses. Shared services should return domain results rather than `NextResponse` objects.
- Put shared data contracts in `src/types`. UI components must not import contracts from API route files. ESLint rejects imports through `@/app/api/**` to enforce this boundary.
- Keep credential-bearing integrations in server modules. The `.server.ts` suffix identifies server services; import them only from server pages and API handlers.
- Put pure calculations beside their domain under `src/lib`. They should not depend on React, cookies, environment variables, or network access.
- Update database types alongside schema changes. The current `src/lib/supabase/types.ts` is maintained by hand and is incomplete; check the migrations before adding casts to work around missing fields.

## Refactoring completed in this branch

### Saved payment methods

`src/lib/payments/saved-methods.server.ts` owns customer creation, customer ID persistence, token loading, and the existing empty-result fallback when Razorpay is unavailable. Both the payment methods API and the profile page call it.

`src/lib/payments/tokens.ts` converts provider tokens into the shared `SavedMethod` contract in `src/types/payment.ts`. Card display, UPI display, and unsupported method handling have regression coverage. The Supabase user type now includes the two columns introduced by migration 033, removing the related `any` casts from saved-payment routes and the profile page.

Authentication checks, API response shapes, and the existing payment fallback remain in place. This extraction does not change payment ownership validation or make customer creation and database persistence atomic.

### Explore route geometry

`src/lib/maps/geometry.ts` owns route sampling, coverage truncation, and map bounds. These functions were extracted from the Explore page without changing their algorithms. Tests cover endpoints, distance interpolation, whole-route coverage, invalid JSON fallback, and coordinate bounds.

### Activity composition and Explore modules

Activity's page composes dedicated filter controls, featured cards, compact rows, map thumbnails, and empty states under `src/components/activity`. Shared contracts live in `src/types/activity.ts`; date grouping, sorting, and filter selection live in `src/lib/activity/selectors.ts`. The filter sheet uses the same selectors as the list so counts and results stay aligned. Formatting and notification labels live in `src/lib/activity/presentation.ts`.

Explore's desktop results panel lives in `src/components/explore`. The `useExploreSearch` hook composes location, route, session, and charger hooks. `useExploreLocation` owns GPS and manual centers; `useExploreRoute` owns endpoints, route calculation, pin geocoding, and swap timers; `useExploreSession` owns URL precedence and validated session restoration; `useExploreChargers` owns result loading. The page composes controls, filters, and map/list presentation. `src/lib/explore/filters.ts` applies the same rules to near-me and route results; `session.ts` owns storage helpers and defaults. Filter contracts live in `src/types/explore.ts`, with a compatibility re-export from FilterSheet. Map and list layouts share the route input/summary element.

Tests cover Activity's current upcoming/completed/cancelled semantics, immutable sorting, local date boundaries, Explore's filter combinations and price sentinel, and storage failures. Additional tests cover request generation guards, URL-versus-session mode precedence, invalid saved coordinates/radii, and cleared route endpoints. Late GPS, geocoding, and charger responses are ignored after a newer selection, and pin/swap timers are cleaned up on unmount. In-flight network requests are not aborted. Map camera effects wait for Mapbox readiness, so a route restored before map initialization still fits its bounds. Existing availability semantics remain: `now` and `next_2h` both currently select active chargers.

## Validation

```bash
npm test
npm run type-check
npm run lint
npm run build
```

Tests use Node's built-in test runner and the existing TypeScript compiler. `tsconfig.test.json` compiles the tests and their pure dependencies into the ignored `.test-build` directory. They do not require service credentials or call external providers. Add tests for domain boundaries and failure cases when moving behavior, rather than testing component internals.

Browser checks on 23 November 2026 covered test-account login/profile setup, denied-GPS fallback, Delhi–Jaipur routing, endpoint swap/clear, route reload, coverage and radius changes, filters, Home shortcut precedence, mobile map/list switching, charger details, and empty Activity/Updates screens. These checks exposed and fixed map readiness and initial-mode persistence bugs. The test account had no vehicles or sessions; granted GPS, populated Activity actions, bookings, and payments remain unverified.

A production build verifies compilation and route generation; it does not prove that authenticated booking, payment, or push flows work. Exercise those flows separately against a dedicated test environment when their behavior changes.

## Remaining areas to tackle

1. **Lifecycle integration coverage:** add mounted-hook tests with controlled GPS and provider promises to complement the pure guard tests and browser checks. Consider aborting superseded network requests. Activity server loading can be extracted separately when its query behavior has integration coverage.
2. **Database type coverage:** reconcile the handwritten types with all migrations or generate types from the intended development schema, then remove remaining broad casts incrementally.
3. **Payment failure handling:** customer ID persistence errors and default-token ownership validation deserve explicit behavior changes with integration tests. Keep these changes distinct from code movement.
4. **Shared profile and booking UI:** review large components for repeated sections before introducing more abstraction.
5. **Lint debt:** resolve hook dependency warnings with lifecycle tests; clean up JSX text and image warnings without disabling rules globally.
6. **Dependency cleanup and upgrades:** confirm unused Leaflet packages, review the pinned Next.js version, and handle dependency upgrades independently so their compatibility effects are visible.

Keep each change focused on a feature boundary. Preserve request/response contracts during structural refactors, and describe any intentional behavior change and its validation in the pull request.
