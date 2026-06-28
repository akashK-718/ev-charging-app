# Setup Guide — EV Charging App

## Prerequisites

- Node.js 18+
- A Supabase project (cloud or local via `supabase` CLI)
- Mapbox account (for map tiles + geocoding + routing)
- MSG91 account (for OTP SMS) — or skip in dev with the bypass below
- Razorpay account (for payments) — optional for UI-only dev

## 1. Clone & install

```bash
git clone https://github.com/akashK-718/ev-charging-app
cd ev-charging-app
npm install
```

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side admin client) |
| `SUPABASE_PHONE_PASSWORD_SECRET` | Secret used to derive auth passwords from phone numbers — **never change after first user** |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public access token |
| `MSG91_AUTH_KEY` | MSG91 API key for OTP (omit entirely in dev to use bypass OTP `000000`) |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same Razorpay key ID (for client-side checkout) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for photo uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

> **Never commit `.env.local`** — it's in `.gitignore`.

## 3. Database migrations

Run all migrations against your Supabase project. In the Supabase dashboard → SQL Editor, run each file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_postgis.sql
supabase/migrations/003_connector_types_array.sql
supabase/migrations/004_availability_slots_and_charger_fn.sql
supabase/migrations/005_users_rls_policies.sql
supabase/migrations/006_chargers_within_radius.sql
supabase/migrations/007_chargers_along_route.sql
```

**Local Supabase CLI:**
```bash
supabase start
supabase db push   # or: supabase db reset
```

## 4. Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

**Dev OTP bypass:** when `NODE_ENV=development` and `MSG91_AUTH_KEY` is absent, entering `000000` as the OTP succeeds — no SMS sent.

## 5. Seed demo data (optional)

To populate the map with 1,200 realistic fake chargers for local development or demos:

1. Open Supabase SQL Editor
2. Run `supabase/seeds/006_demo_chargers.sql`

This inserts 20 fake lender users and ~1,209 chargers across India. It is idempotent — safe to re-run. See [docs/SEED_DATA.md](SEED_DATA.md) for full details and removal instructions.

> **Do not run the seed in production** — it creates fake accounts with deterministic UUIDs.

## 6. Architecture

See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the map provider abstraction, auth flow, and how to swap Mapbox for another provider.
