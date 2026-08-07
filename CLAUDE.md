# Claude Code guidelines — EV Charging App

## Hard constraints

- **Never push directly to `main`** — all changes go through a Pull Request.
- **Never commit `.env.local`** or any file containing real secrets.
- **Never add `Co-Authored-By: Claude` trailers** to git commits.
- **Money in paise, not floats** — except `price_per_kwh` which is stored as rupees (lender-facing).
- **`SUPABASE_PHONE_PASSWORD_SECRET` must never change** after the first user signs up — changing it breaks all existing sessions.

## Maps abstraction

All map provider calls go through `src/lib/maps/`. Components must **not** import Mapbox APIs (or any other map SDK) directly.

- Types: `src/lib/maps/types.ts`
- Active provider + interface: `src/lib/maps/provider.ts`
- Mapbox implementation: `src/lib/maps/mapbox.ts`
- UI components: `src/components/maps/MapView.tsx`, `src/components/maps/AddressAutocomplete.tsx`

See `docs/ARCHITECTURE.md` for the full rationale and swap guide.

## Auth

- Supabase Auth sessions via derived email+password (phone → `${fullPhone}@auth.local`).
- MSG91 sends OTP. Dev bypass: `000000` accepted only when `NODE_ENV === 'development'` AND `MSG91_AUTH_KEY` is absent.

## Design system

**`/design` is the canonical, single source of truth** for all visual tokens, component variants, and interaction patterns. Do not duplicate token values in this file — reference `/design` directly.

**Before implementing any new component or screen:** reference `/design` for the correct color tokens, radius values, button variants, tap-feedback tier, and haptic tier.

**When introducing a new pattern** (a new button variant, a new motion timing, a new interaction state) in any PR: add it to `/design` in that same PR. Do not leave it undocumented for a future cleanup pass — that is how the scattering happened in the first place.

## Stack

Next.js 14 App Router · Supabase (PostgreSQL + Auth) · Razorpay · MSG91 · Cloudinary · Mapbox
