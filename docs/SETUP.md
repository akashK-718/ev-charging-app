# Setup Guide — EV Charging App

## Prerequisites

- Node.js 18+
- A Supabase project (cloud or local via `supabase` CLI)
- Mapbox account (for map tiles + geocoding + routing)
- MSG91 account (for OTP SMS) — or skip in dev with the bypass below
- Razorpay account (for payments) — optional for UI-only dev

## 1. Clone & install

```bash
# TODO(migration): update URL to Kirin org after repo transfer — see docs/ACCOUNT_MIGRATION.md § GitHub
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

## 6. Lifecycle sweep (pg_cron)

The booking lifecycle sweep runs every minute via pg_cron and calls `POST /api/internal/lifecycle-sweep`. Migration 026 enables pg_cron/pg_net and schedules the job, but the job is a no-op until you complete these one-time setup steps.

### Step 1: Add env var

Add to your Vercel environment (and `.env.local` for local testing):

| Variable | Purpose |
|---|---|
| `LIFECYCLE_SWEEP_SECRET` | A randomly generated secret (use `openssl rand -hex 32`) |

### Step 2: Seed app_settings

Run this in your Supabase SQL Editor once per environment (replace the placeholders):

```sql
INSERT INTO public.app_settings (key, value)
VALUES (
  'lifecycle_sweep',
  jsonb_build_object(
    'url',    'https://YOUR-APP.vercel.app/api/internal/lifecycle-sweep',
    'secret', 'YOUR_LIFECYCLE_SWEEP_SECRET_HERE'
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

The secret must match `LIFECYCLE_SWEEP_SECRET`. The pg_cron job reads this row at runtime, so the job is safely dormant until the row is populated.

### Test/staging fast timers

Override the no-show windows via env vars (values in minutes) for testing:

```bash
NOSHOW_WARNING_MINUTES=1
NOSHOW_TIMEOUT_MINUTES=2
SESSION_END_REVIEW_GRACE_MINUTES=2
```

## 7. Vercel Edge Config (emergency lockdown + feature flags)

Emergency lockdown and feature flags are stored in Vercel Edge Config — a CDN-edge key-value store that is read independently of Supabase. This means the lockdown can be activated and enforced even if the database is unreachable.

### Step 1: Create an Edge Config store

1. Go to your Vercel project → **Storage** → **Edge Config** → **Create store**.
2. Note the store **ID** (format: `ecfg_xxxxxxxx`).
3. In the store, click **Items** and seed the initial values:

| Key | Value |
|---|---|
| `emergency_lockdown` | `false` |
| `route_planning_enabled` | `true` |
| `ratings_enabled` | `true` |
| `saved_chargers_enabled` | `false` |
| `vehicles_enabled` | `false` |

### Step 2: Add environment variables

Add these to your Vercel project environment and to `.env.local`:

| Variable | Purpose |
|---|---|
| `EDGE_CONFIG` | Edge Config connection string — copy from the store's **Tokens** tab (format: `https://edge-config.vercel.com/ecfg_xxx?token=yyy`) |
| `EDGE_CONFIG_ID` | Store ID only (format: `ecfg_xxxxxxxx`) — used by the write API |
| `VERCEL_ACCESS_TOKEN` | A Vercel personal access token with **Full Account** scope — used to update Edge Config items via the Vercel REST API. Create at vercel.com → Account Settings → Tokens. |

### Step 3: Connect the store to your project

In Vercel project settings → **Storage**, connect the Edge Config store you created. This auto-populates `EDGE_CONFIG` in all environments.

### Local development without Edge Config

If `EDGE_CONFIG` is not set, all flags return safe defaults:
- `emergency_lockdown` → `false`
- `route_planning_enabled`, `ratings_enabled` → `true`
- `saved_chargers_enabled`, `vehicles_enabled` → `false`

Admin-initiated lockdown and feature flag changes from `/admin/settings` will fail locally unless `EDGE_CONFIG_ID` and `VERCEL_ACCESS_TOKEN` are also set.

## 8. Architecture

See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the map provider abstraction, auth flow, and how to swap Mapbox for another provider.
