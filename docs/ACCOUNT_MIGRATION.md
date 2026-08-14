# Account Migration Checklist — Personal → Kirin Business Accounts

> **Scope:** This document covers every external service credential and account-specific identifier
> found in this codebase. Use it when migrating from the current personal accounts to new accounts
> created under the Kirin business entity.
>
> **What this doc is not:** It does not rotate credentials, create accounts, or modify `.env` files.
> It is an audit and ordered checklist only.

---

## ⚠️ Part D — Hardcoded Values That Must Be Fixed Before Migration

> These are the highest-priority findings. A migration carried out before fixing these will require
> **code changes in addition to config changes**, meaning the deploy process is not as clean as
> "re-enter credentials in Vercel and redeploy."

### Finding 1 — `SUPABASE_PHONE_PASSWORD_SECRET` has a silent fallback (critical)

**File:** [`src/app/api/auth/verify-otp/route.ts:8`](../src/app/api/auth/verify-otp/route.ts)

```ts
const secret = process.env.SUPABASE_PHONE_PASSWORD_SECRET ?? 'dev-phone-secret-do-not-use-in-production';
```

**Why this matters on migration:** `SUPABASE_PHONE_PASSWORD_SECRET` is the pepper used to derive
every user's Supabase Auth password from their phone number. CLAUDE.md states it must never change
after first sign-up. If the env var is accidentally omitted from the new Vercel project, the app
silently falls back to the known string `dev-phone-secret-do-not-use-in-production` and derives
wrong passwords for every user — auth breaks for the entire user base with no error surfaced at
deploy time.

**Recommended fix (separate PR):** Remove the `??` fallback and throw a hard error on startup if
the env var is unset, matching the pattern already used in `src/lib/razorpay.ts:10–12`. The secret
value itself must be copied verbatim from the old Vercel project into the new one.

### Finding 2 — GitHub repo URL in docs references personal account

**Files:**
- [`docs/SETUP.md:14`](SETUP.md) — `https://github.com/akashK-718/ev-charging-app`
- [`context-package/docs/CURRENT_STATUS.md:57`](../context-package/docs/CURRENT_STATUS.md)

These are documentation links, not runtime code, so they do not break the app. But after the repo
is transferred or forked to the Kirin org, these should be updated in a follow-up docs PR.

---

## Part A & B — Full Credential/Identifier Inventory

### Legend

| Column | Meaning |
|---|---|
| **Source** | `env var` = read from `process.env` (correct) · `hardcoded` = literal in source |
| **Changes on migration** | Whether the value itself changes under the new account |
| **Data risk** | Whether a new account means existing data (photos, IDs, tokens) breaks |

---

### 1. Supabase

| Item | Env var | Source | Changes on migration | Notes |
|---|---|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | env var ✅ | Yes — new project, new URL | Used in middleware, server client, browser client |
| Anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | env var ✅ | Yes | Used in same files |
| Service role key | `SUPABASE_SERVICE_ROLE_KEY` | env var ✅ | Yes | Server-side admin client only |
| Phone password pepper | `SUPABASE_PHONE_PASSWORD_SECRET` | env var ✅ (but see Part D Finding 1) | **No — must be copied unchanged** | Changing breaks all existing auth sessions |
| Image hostname allowlist | `*.supabase.co` in `next.config.js:7` | hardcoded — but it's a wildcard | No change needed | Wildcard covers any project under `.supabase.co` |

**Migration steps:**
- [ ] Create new Supabase project under Kirin organisation.
- [ ] Run all migrations in order: `001` → `035` (and any added after this audit) via Supabase SQL Editor or `supabase db push`.
- [ ] Copy `SUPABASE_PHONE_PASSWORD_SECRET` **exactly** from the old project into the new Vercel project env. Do not generate a new value.
- [ ] Update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel (all environments: Production, Preview, Development).
- [ ] **Manually set `is_admin = true`** for the admin user's row in `public.users` on the new project — this is the one piece of continuity preserved. The admin user must sign in once (which creates their `auth.users` row via the OTP flow) before this flag can be set.
- [ ] Re-seed the `app_settings.lifecycle_sweep` row with the new deployment URL after the Vercel project is live (see Vercel section below).
- [ ] Confirm `pg_cron` / `pg_net` extensions are enabled (migration 026 does this, but Supabase sometimes requires manual activation in the dashboard → Database → Extensions).

**Data notes:**
- All `public.users` data is **not migrated** (fresh project). Users re-onboard via OTP on first sign-in. Historical bookings, payments, chargers, etc. are lost. This is accepted per the migration brief.
- `razorpay_customer_id`, `razorpay_contact_id`, `razorpay_fund_account_id` in `users` and `payouts` tables are tied to the old Razorpay account and are not portable regardless (see Razorpay section).

---

### 2. Vercel

| Item | Env var / setting | Source | Changes on migration |
|---|---|---|---|
| Edge Config connection string | `EDGE_CONFIG` | env var ✅ | Yes — new store, new URL |
| Edge Config store ID | `EDGE_CONFIG_ID` | env var ✅ | Yes |
| Vercel personal access token | `VERCEL_ACCESS_TOKEN` | env var ✅ | Yes — must be from new account |
| Deployment ID / Git SHA | `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA` | auto-populated by Vercel | Yes — auto-set by new project |
| Mumbai region | `vercel.json` → `"regions": ["bom1"]` | hardcoded in `vercel.json` | No change needed — file travels with repo |

**Migration steps:**
- [ ] Create new Vercel project under Kirin team. Connect to the Kirin GitHub org repo.
- [ ] Create a new Edge Config store in the new Vercel project → Storage → Edge Config.
- [ ] Seed the new store with initial flag values (see `docs/SETUP.md` § 7):
  - `emergency_lockdown` → `false`
  - `route_planning_enabled` → `true`
  - `ratings_enabled` → `true`
  - `saved_chargers_enabled` → `false`
  - `vehicles_enabled` → `false`
- [ ] Connect the Edge Config store to the project (auto-populates `EDGE_CONFIG`).
- [ ] Generate a new Vercel personal access token (Full Account scope) and set as `VERCEL_ACCESS_TOKEN`.
- [ ] Set `EDGE_CONFIG_ID` to the new store's ID.
- [ ] Set all other env vars listed throughout this document in the new Vercel project.
- [ ] After the new project has a stable domain (either the Vercel auto-domain or a custom domain), re-seed `app_settings.lifecycle_sweep`:

```sql
INSERT INTO public.app_settings (key, value)
VALUES (
  'lifecycle_sweep',
  jsonb_build_object(
    'url',    'https://YOUR-NEW-APP.vercel.app/api/internal/lifecycle-sweep',
    'secret', 'YOUR_LIFECYCLE_SWEEP_SECRET_HERE'
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

- [ ] Generate a new `LIFECYCLE_SWEEP_SECRET` (`openssl rand -hex 32`) and set it in Vercel env **and** in the `app_settings` row above — both must match.

---

### 3. Cloudinary

| Item | Env var | Source | Changes on migration | Data risk |
|---|---|---|---|---|
| Cloud name | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | env var ✅ | Yes — new account, new cloud name | **HIGH — see below** |
| Upload preset | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | env var ✅ | Yes — must be recreated in new account | None for new uploads |
| API key | `CLOUDINARY_API_KEY` | env var ✅ (in `.env.example`; not yet used in source) | Yes | — |
| API secret | `CLOUDINARY_API_SECRET` | env var ✅ (in `.env.example`; not yet used in source) | Yes | — |
| CDN hostname | `res.cloudinary.com` in `next.config.js:6`, `src/lib/cloudinary-url.ts:12`, `src/app/api/users/me/route.ts:6` | hardcoded | **No change needed** — hostname is constant across all Cloudinary accounts |

> **Note:** `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are declared in `.env.example` and
> `docs/SETUP.md` but are **not read anywhere in the current source code** — all uploads use the
> unsigned preset path. They are likely reserved for future signed-upload or deletion features.
> Still add them to the new account and Vercel for completeness.

**⚠️ Data risk — charger photos will break on cloud-name change:**

Every charger photo URL stored in the `chargers.photos` array looks like:
```
https://res.cloudinary.com/<old-cloud-name>/image/upload/...
```

If the new Cloudinary cloud name differs from the old one, **every existing charger photo URL in
the database will 404**. Since the migration brief accepts data loss, this is acknowledged — but it
means all lender-uploaded charger photos effectively disappear on migration. If photo preservation
matters before launch, the Cloudinary migration tool (or a bulk re-upload script) must be run
before cutting over.

**Migration steps:**
- [ ] Create new Cloudinary account under Kirin business.
- [ ] Create an **unsigned upload preset** in the new account (Settings → Upload → Upload Presets) and note its name.
- [ ] Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` to the new cloud name in Vercel.
- [ ] Set `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` to the new preset name in Vercel.
- [ ] Set `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in Vercel (for future use).
- [ ] **Accept** that existing charger photo URLs in the database become broken, or plan a migration script to re-upload and update URLs before launch.

---

### 4. Firebase (FCM push notifications)

| Item | Env var | Source | Changes on migration |
|---|---|---|---|
| Web API key | `NEXT_PUBLIC_FIREBASE_API_KEY` | env var ✅ | Yes |
| Auth domain | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | env var ✅ | Yes |
| Project ID | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | env var ✅ | Yes |
| Storage bucket | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | env var ✅ | Yes |
| Messaging sender ID | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | env var ✅ | Yes |
| App ID | `NEXT_PUBLIC_FIREBASE_APP_ID` | env var ✅ | Yes |
| VAPID key (push subscriptions) | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | env var ✅ | Yes |
| Service account JSON (server-side FCM send) | `FIREBASE_SERVICE_ACCOUNT_JSON` | env var ✅ | Yes — full JSON blob |

The Firebase config object is also inlined into a `<script>` tag in `src/app/layout.tsx:96–103` and
forwarded to the service worker via `postMessage`. Both paths read from `process.env.NEXT_PUBLIC_*`
— no hardcoded values.

**⚠️ FCM token invalidation:**

FCM device tokens stored for users (in `push_tokens` or equivalent table) are tied to the Firebase
project. Changing the project ID invalidates all existing tokens. Users will not receive push
notifications until they next open the app and the browser re-registers — this happens automatically
via `src/hooks/usePushNotifications.ts` on first load after the new config is live.

**Migration steps:**
- [ ] Create new Firebase project under Kirin Google account.
- [ ] Register the web app in the new project (Project Settings → General → Add app → Web).
- [ ] Enable Cloud Messaging in the new project and generate a VAPID key pair (Project Settings → Cloud Messaging → Web Push Certificates).
- [ ] Generate a service account private key (Project Settings → Service Accounts → Generate new private key) — this is the JSON blob for `FIREBASE_SERVICE_ACCOUNT_JSON`.
- [ ] Set all six `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel from the new app's config object.
- [ ] Set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in Vercel.
- [ ] Set `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel (paste the full JSON, ensure newlines in the private key are represented as `\n` if the platform requires it).
- [ ] Accept that existing FCM tokens are invalid; users re-subscribe on next app load.

---

### 5. Mapbox

| Item | Env var | Source | Changes on migration |
|---|---|---|---|
| Public access token | `NEXT_PUBLIC_MAPBOX_TOKEN` | env var ✅ | Yes — new account, new token |
| API base URL | `https://api.mapbox.com` in `src/lib/maps/mapbox.ts:26` | hardcoded | No change needed — platform URL |
| Map style URL | `mapbox://styles/mapbox/streets-v12` in `src/components/maps/MapView.tsx:445` | hardcoded | No change needed — public Mapbox style |
| Static map style | `https://api.mapbox.com/styles/v1/mapbox/light-v11/...` in `src/app/activity/ActivityView.tsx:135` | hardcoded | No change needed — public Mapbox style |

**Domain restriction note:** `docs/SETUP.md` notes the token should be restricted to allowed URLs
in the Mapbox dashboard. After migration, the new token must be configured to allow the new Vercel
deployment domain and any custom domain.

**Migration steps:**
- [ ] Create new Mapbox account under Kirin.
- [ ] Generate a new public access token. Restrict it to allowed URLs:
  - New Vercel deployment domain (`https://your-new-app.vercel.app`)
  - Any custom domain (e.g. `https://app.kirin.in`)
  - `http://localhost:3000` for local development
- [ ] Set `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel.

---

### 6. MSG91

| Item | Env var | Source | Changes on migration |
|---|---|---|---|
| Auth key | `MSG91_AUTH_KEY` | env var ✅ | Yes |
| OTP template ID | `MSG91_TEMPLATE_ID` | env var ✅ | Yes — new template under new account |
| Sender ID | `MSG91_SENDER_ID` | env var ✅ (in `.env.example`; embedded in template, not passed in code) | Yes |
| Dev bypass flag | `OTP_BYPASS` | env var ✅ | No — behaviour flag, same shape |

**⚠️ DLT re-registration required:**

Indian SMS regulations require DLT (Distributed Ledger Technology) registration for SMS. The OTP
template and sender ID registered under the personal MSG91 account cannot be directly transferred
to a new business account — they must be re-registered. DLT approval typically takes 1–2 business
days. Plan accordingly; OTP login will be non-functional until this completes.

**Migration steps:**
- [ ] Create new MSG91 account under Kirin entity.
- [ ] Complete DLT registration for the new entity (plan for 1–2 business day wait).
- [ ] Register OTP sender ID and template under the new account.
- [ ] Set `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID` in Vercel.

---

### 7. Razorpay / RazorpayX

| Item | Env var | Source | Changes on migration |
|---|---|---|---|
| Key ID (client-side) | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | env var ✅ | Yes |
| Key secret | `RAZORPAY_KEY_SECRET` | env var ✅ | Yes |
| Webhook secret | `RAZORPAY_WEBHOOK_SECRET` | env var ✅ | Yes — new webhook, new secret |
| Checkout SDK URL | `https://checkout.razorpay.com/v1/checkout.js` in `src/app/bookings/new/page.tsx:60` | hardcoded | No change needed — platform URL |

> **Note:** `.env.example` lists `RAZORPAY_KEY_ID` (without `NEXT_PUBLIC_` prefix) but it is not
> read anywhere in source code. Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is used (both client-side and
> in `src/lib/razorpay.ts:22`). The bare `RAZORPAY_KEY_ID` entry in `.env.example` is stale and
> can be removed.

**⚠️ Razorpay entity IDs stored in the database are not portable:**

The `public.users` table stores `razorpay_customer_id`, `razorpay_contact_id`, and
`razorpay_fund_account_id` per user. The `payouts` table stores `razorpay_payout_id`. These IDs
(format: `cust_…`, `cont_…`, `fa_…`, `pout_…`) are tied to the old Razorpay account and cannot be
used with a new one. Since data loss is accepted on migration, this is noted but not blocking.
Existing users will have a new Razorpay customer record created lazily on their first visit to the
payment screen on the new account.

**Migration steps:**
- [ ] Create new Razorpay account under Kirin (KYC takes 1–3 business days).
- [ ] Generate new API keys (test mode first; switch to live after launch).
- [ ] Register a new webhook in Razorpay Dashboard → Webhooks → Add New Webhook:
  - URL: `https://your-new-app.vercel.app/api/webhooks/razorpay`
  - Events: payment.captured, payment.failed, refund.created (at minimum)
  - Copy the new webhook secret.
- [ ] Set `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in Vercel.

---

### 8. GitHub

| Item | Location | Type | Changes on migration |
|---|---|---|---|
| Repo URL | `docs/SETUP.md:14`, `context-package/docs/CURRENT_STATUS.md:57` | docs only | Yes — update to Kirin org URL |
| No CI config (GitHub Actions) | — | — | No `.github/` directory exists; nothing to migrate |

**Migration steps:**
- [ ] Transfer or fork the repo to the Kirin GitHub organisation.
- [ ] Update `docs/SETUP.md:14` and `context-package/docs/CURRENT_STATUS.md:57` with the new clone URL.
- [ ] Update the Vercel project's Git integration to point to the new repo location.

---

## Part C — Ordered Migration Checklist

Run steps in this order. Dependencies between services mean some steps cannot be parallelised.

```
[ ] 0. Fix Part D — Finding 1 (SUPABASE_PHONE_PASSWORD_SECRET hard-throw)
        in a separate PR before starting migration. Deploy to old project first.

[ ] 1. GITHUB
        Transfer/fork repo to Kirin org.
        Update Vercel Git integration to point to new repo.

[ ] 2. SUPABASE — Create project
        New Supabase project under Kirin org.
        Note: project URL and keys are not available until this exists.

[ ] 3. SUPABASE — Run migrations
        SQL Editor: run 001 → 035 in order (or supabase db push).
        Confirm pg_cron and pg_net extensions are active.

[ ] 4. CLOUDINARY
        New account + unsigned upload preset.
        (Can be done in parallel with Supabase steps.)

[ ] 5. FIREBASE
        New project + web app registration + VAPID key + service account JSON.
        (Can be done in parallel.)

[ ] 6. MAPBOX
        New token with allowed URLs.
        (Can be done in parallel — but final URL allowlist requires knowing the
        new Vercel domain, which is available after step 9.)

[ ] 7. MSG91
        New account + DLT registration. Start early — 1–2 day wait.
        (Can be started in parallel with everything above.)

[ ] 8. RAZORPAY
        New account + KYC. Start early — 1–3 day wait.
        Register webhook after Vercel domain is known (step 9).

[ ] 9. VERCEL — Create project
        New Vercel project under Kirin team, connected to Kirin GitHub repo.
        Create Edge Config store. Connect it to the project.
        Set ALL env vars from steps 2–8 plus:
          SUPABASE_PHONE_PASSWORD_SECRET  ← copy verbatim from old project
          LIFECYCLE_SWEEP_SECRET           ← generate new with openssl rand -hex 32
          NEXT_PUBLIC_APP_URL              ← set to new deployment URL
          NEXT_PUBLIC_APP_NAME             ← "Kirin" (or whatever the product name is)
        Deploy once to confirm build passes.

[10. MAPBOX — finalise token URL restrictions
        Now that the Vercel domain is known, add it to the Mapbox token's allowed URLs.]

[11. VERCEL + SUPABASE — Seed lifecycle_sweep app_settings row
        INSERT INTO public.app_settings ... with new Vercel URL and new LIFECYCLE_SWEEP_SECRET.
        Confirm the pg_cron job is active: check cron.job in Supabase SQL Editor.]

[12. RAZORPAY — Register webhook
        Webhook URL: https://<new-vercel-domain>/api/webhooks/razorpay
        Update RAZORPAY_WEBHOOK_SECRET in Vercel to match.]

[13. SUPABASE — Reinstate admin user
        Admin user signs in via OTP on the new deployment (creates auth.users row).
        Run: UPDATE public.users SET is_admin = true WHERE phone = '91XXXXXXXXXX';
        This is the only piece of continuity manually preserved.]

[14. SMOKE TEST
        OTP login works (MSG91 live key).
        Map loads (Mapbox token).
        Photo upload works (Cloudinary preset).
        Payment flow works in test mode (Razorpay test keys).
        Push notification received (Firebase).
        Lifecycle sweep fires (check Supabase → Database → Cron Jobs).]
```

---

## Summary of What Needs New Values vs. What Carries Over

| Service | New value on new account | Carried over unchanged |
|---|---|---|
| Supabase | URL, anon key, service role key | `SUPABASE_PHONE_PASSWORD_SECRET` — must be identical |
| Vercel | Access token, Edge Config ID/string, lifecycle sweep secret | `vercel.json` region setting (travels with code) |
| Cloudinary | Cloud name, upload preset, API key/secret | CDN hostname (`res.cloudinary.com`) — unchanged |
| Firebase | All 6 client config vars, VAPID key, service account JSON | Nothing portable |
| Mapbox | Public token (with new URL restrictions) | API base URL and public map style URLs |
| MSG91 | Auth key, template ID, sender ID | OTP bypass behaviour (`OTP_BYPASS` flag shape) |
| Razorpay | Key ID, key secret, webhook secret | Nothing portable — customer/contact IDs are lost |
| GitHub | Repo URL (org transfer) | Code, history, `vercel.json` |

---

*Generated: 2026-08-14. Branch: `chore/account-migration-audit`.*
