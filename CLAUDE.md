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

**Mandatory shared components — using a one-off implementation of either is a bug:**

- **New screen with a back-navigable header** → must use `<PageHeader>` from `src/components/ui/PageHeader.tsx`. Never roll a bespoke `BackButton + h1` layout.
- **New screen with a primary action button** → must use `<PrimaryButton>` from `src/components/ui/PrimaryButton.tsx`. Never use `<Button variant="secondary">` for a primary CTA.
- **New screen whose content scrolls near the bottom nav** → must use the canonical bottom-safe-padding class on `<main>`: `pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-10`. Never hardcode `pb-10`, `pb-16`, or an inline `paddingBottom` style. This has buried CTAs on Booking, Hosting Introduction, Payout Details, and multiple profile screens before being caught.

## Stack

Next.js 14 App Router · Supabase (PostgreSQL + Auth) · Razorpay · MSG91 · Cloudinary · Mapbox
