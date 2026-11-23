# Kirin — Home EV Charging Marketplace

Kirin connects EV drivers with people who share their home chargers. Drivers can find chargers nearby or along a route, request a time slot, pay, and track a charging session. Hosts can list chargers, set prices and availability, review bookings, and track earnings. The app also includes identity checks, reviews, notifications, and an admin area for operations. It is built as an installable web app for the Indian market.

## Tech stack

| Area | Technology | Used for |
| --- | --- | --- |
| Web app | Next.js 14 App Router, React 18, TypeScript 5 | Pages, server rendering, and API routes |
| UI | Tailwind CSS 3, Motion, Lucide and Phosphor icons | Styling, animation, and icons |
| Data and auth | Supabase Auth, PostgreSQL, PostGIS, `@supabase/ssr` | Phone-linked accounts, bookings, data access, and spatial charger queries |
| Maps | Mapbox GL JS, `react-map-gl`, Mapbox Geocoding and Directions | Map display, address search, and route planning |
| SMS | MSG91 | Phone OTP delivery and verification |
| Payments | Razorpay | Payment orders, verification, and webhooks |
| Media | Cloudinary | Charger and verification image uploads |
| Push | Firebase Cloud Messaging, Firebase Admin | Browser push notifications |
| Operations | Vercel Edge Config, Supabase `pg_cron` and `pg_net` | Feature flags, emergency lockdown, and booking lifecycle jobs |
| Documents and assets | PDFKit, Sharp | PDF receipts/statements and generated app icons |
| Deployment | Vercel | Web app hosting; `vercel.json` selects the Mumbai region |

The active map implementation is Mapbox. Leaflet packages remain in `package.json`, but the current map components use `react-map-gl`. Completed booking payouts are queued for admin processing; automatic Razorpay Route transfers are not implemented in the current code.

## Requirements

- **Git**, **Node.js 20 or newer**, and **npm 10 or newer** for local development. The repository includes `package-lock.json`; use `npm ci` for a reproducible install.
- A **Supabase project** for sign-in and data-backed features. Its database must support PostGIS. The migrations also enable `pg_cron` and `pg_net` for lifecycle jobs.
- A **Mapbox access token** for the interactive map, address search, and routing.
- Service accounts for the features you plan to exercise: **MSG91** for real SMS OTP, **Razorpay** for payments, **Cloudinary** for uploads, and **Firebase** for push notifications.
- **Vercel Edge Config** for remotely managed feature flags and emergency lockdown. The app uses local defaults when Edge Config is unset.

Docker and the Supabase CLI are needed only if you choose to run Supabase locally. A hosted Supabase project does not require either tool. Code checks can run without service credentials; sign-in, discovery, booking, and other integrated flows need their corresponding services configured.

## Run locally

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/akashK-718/ev-charging-app.git
   cd ev-charging-app
   npm ci
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Replace the example values with credentials for the features you need. At minimum, configure the Supabase URL, public key, service role key, and phone password secret for the core authenticated flows. `.env.local` is ignored by Git; never commit real secrets. Variables prefixed `NEXT_PUBLIC_` are exposed to the browser, so do not put private keys in them.

3. Apply **every SQL file** in [`supabase/migrations/`](supabase/migrations/) to the chosen Supabase project in filename order. For an existing database, apply any pending migrations through [043](supabase/migrations/043_defer_username_account_provisioning.sql) before running this version. Use the Supabase SQL Editor or your established migration workflow.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). If `MSG91_AUTH_KEY` is unset in development, the OTP flow accepts `000000` without sending an SMS. Keep `OTP_BYPASS` unset outside development.

### Sign-in methods

Choose phone OTP or username and PIN on `/auth`. PIN signup requires a four-digit PIN and a unique mobile number for booking contact. It saves the number without sending a verification SMS. Username sign-in uses Supabase Auth without MSG91. Apply migrations 045 and 046 before enabling PIN signup and sign-in, and retain the server's existing `SUPABASE_PHONE_PASSWORD_SECRET`.

Migration 042 adds the username column and profile trigger. Migration 043 defers the trigger until Supabase Auth has written its signup metadata. If you used the development bootstrap through 042, apply only the pending migration 043. Backend instances sharing a database must use the updated OTP handler before password accounts are registered. The older handler resets passwords on profiles it finds by phone.

## Environment variables

Use [`.env.example`](.env.example) as the full template. The groups below show what each integration needs.

| Feature | Variables | Notes |
| --- | --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHONE_PASSWORD_SECRET` | Core auth and database access. Keep the service role key and phone password secret server-side. Do not change the phone password secret after users sign up. |
| Maps | `NEXT_PUBLIC_MAPBOX_TOKEN` | Public Mapbox token for map tiles, geocoding, and directions. |
| SMS OTP | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID` | Needed for real SMS; omit the auth key for the development OTP bypass. |
| Payments | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Use Razorpay test credentials for local payment work. |
| Image uploads | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Current browser uploads need the first two. The server-side API credentials are present in the template but are not used by the current upload helper. |
| Push notifications | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` | Web client config, VAPID key, and server-side service account. |
| Edge Config | `EDGE_CONFIG`, `EDGE_CONFIG_ID`, `VERCEL_ACCESS_TOKEN` | Reads use `EDGE_CONFIG`; admin writes also need the store ID and Vercel token. |
| App and lifecycle | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `LIFECYCLE_SWEEP_SECRET` | Local URL/name and the secret used by the scheduled lifecycle endpoint. |

Optional development and staging controls are `NOSHOW_WARNING_MINUTES`, `NOSHOW_TIMEOUT_MINUTES`, and `SESSION_END_REVIEW_GRACE_MINUTES`. `OTP_BYPASS=true` also enables the OTP bypass, so use it only in a controlled development environment.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm test` | Run regression tests for payment display, route geometry, Activity selectors, and Explore filters, session validation, and stale-request guards |
| `npm run type-check` | Check TypeScript without emitting files |
| `npm run test:journeys` | Run isolated auth, booking availability, order and session lifecycle tests with success, failure and retry cases |
| `npm run test:browser` | Exercise the driver journey and responsive layouts in Chromium against the local development server |
| `npm run lint` | Run ESLint; the current codebase has warnings |
| `npm run build` | Create a production build and run lint/type checks |
| `npm run start` | Serve an existing production build |

For the browser suite, start the app at `http://localhost:3000` with the local `kirin-dev` configuration and `OTP_BYPASS=true`. Install the test browser once with `npx playwright-core install chromium`. Set `KIRIN_TEST_PHONE` to a dedicated OTP driver’s 10-digit number and run `npm run test:browser`. If the account needs onboarding, the suite saves `KIRIN_TEST_NAME` (default `Journey Driver`). The booking screen uses a synthetic charger and stops at the quote.

The opt-in `npm run test:kyc` suite exercises host onboarding and admin review on local port 3000 with `kirin-dev` and migration 048. It uses two temporary accounts and uploads synthetic PNGs to the configured Cloudinary account. Supply working upload and deletion credentials. The suite removes its fixtures after the run.

Run `npm run test:payouts` with the local app on port 3000, Chromium installed for Playwright, and migration 049 applied to `kirin-dev`. The suite uses temporary driver, host, and admin accounts and a synthetic paid booking. It checks the 24-hour hold, advances the test booking’s timestamps, marks the payout processed in the admin UI, and removes its fixtures. It requires no payment provider credentials.

## Repository layout

```text
src/app/                 Pages and API routes (driver, host, and admin)
src/components/          Shared and feature UI
src/hooks/               Client hooks
src/lib/                 Supabase, maps, payments, notifications, and utilities
src/middleware.ts        Session and route guards
supabase/migrations/     Ordered PostgreSQL schema and policy changes
supabase/seeds/          Optional development data
public/                  Static assets and PWA manifest
docs/                    Architecture and feature setup notes
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the map provider design and [`docs/SETUP.md`](docs/SETUP.md) for Edge Config and lifecycle job configuration. The migration list in `docs/SETUP.md` covers an earlier stage of the project; apply the complete migration directory as described above.

For module boundaries, testing, and the remaining refactoring areas, see [`docs/MAINTAINABILITY.md`](docs/MAINTAINABILITY.md).

Follow the [driver](docs/journeys/driver.md), [host](docs/journeys/host.md), and [admin](docs/journeys/admin.md) journeys for step-by-step workflows. New branches and PRs default to `feature`. The repository owner handles merges to `main`.
