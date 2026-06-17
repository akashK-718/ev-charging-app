# Tech Stack

Every choice here was made deliberately for a 3-person, part-time, pre-revenue Indian marketplace MVP. Each decision includes *why* it was picked and *what was rejected*, so AI assistants don't waste time re-suggesting alternatives.

## Decision principle

> Optimize for a 3-person team shipping an MVP, not for 10,000 concurrent users that don't exist yet. Choose tools that minimize plumbing and let us focus on product. Avoid lock-in where reasonable.

---

## Frontend

### Next.js 14 (App Router) — `^14.2.5`

**Why:** Most popular React framework. Single codebase serves web, admin, mobile (via Capacitor). File-based routing. Server components. Auto-deploys to Vercel. Massive ecosystem.

**App Router specifically** (not Pages Router): Modern API, server components, streaming, better TypeScript inference.

**Rejected alternatives:**
- **Remix** — fine framework, smaller ecosystem, Vercel integration less seamless
- **Astro** — wrong tool for app (better for content sites)
- **Plain React + Vite** — no SSR/SEO, no API routes, would need separate backend project

### TypeScript — `^5.5.3`

**Why:** Team has TS experience (Akash from Playwright). Catches bugs at edit time. Self-documenting. Mandatory for any modern frontend project at scale.

**Strict mode is on.** Don't loosen it. Use `unknown` over `any`.

### Tailwind CSS — `^3.4.6`

**Why:** Utility-first, fast iteration, no context-switching to CSS files, tree-shaken for production, excellent VS Code autocomplete.

**Custom theme in `tailwind.config.ts`** defines brand colors (`ink`, `volt`, `volt-soft`, etc.) and fonts. Use these tokens, not raw hex codes.

**Rejected alternatives:**
- **CSS Modules** — more verbose, more files, slower iteration
- **styled-components / emotion** — runtime cost, harder to optimize
- **Vanilla CSS** — no design system, inconsistency

### React — `^18.3.1`

The UI library Next.js runs on. Use **function components only**. Class components are forbidden.

### shadcn/ui patterns

Components in `src/components/ui/` follow shadcn/ui patterns — accessible, copy-paste friendly, fully customizable. Not installed as a dependency; we own the code.

### Leaflet + react-leaflet (Module 2 onwards)

**Why:** Free, open-source, works with OpenStreetMap (no API key for map tiles), good React integration.

**Rejected:**
- **Google Maps JS API** — costs money at scale, $200/month free credit only covers small MVP
- **Mapbox** — also paid above free tier

**Google Places API** is still used for *address autocomplete only* during lender registration (small fixed cost, ~10 calls per new charger).

### lucide-react

Icon library. Use these icons consistently. Don't introduce other icon libraries.

---

## Backend

### Next.js API Routes

**Why:** Same codebase as frontend, deploys together, TypeScript types shared. For an MVP, this is enough.

**Rejected:**
- **Separate Node/Express backend** — overkill for current scale, doubles deploy complexity
- **Serverless functions on AWS Lambda** — more setup, less integrated

We'll consider splitting out a separate backend service when we have heavy background jobs (probably never for this product).

### Supabase (PostgreSQL + PostGIS + Auth + Storage + Realtime)

**Why:**

1. **PostGIS** for geo queries — non-negotiable for "find chargers near me"
2. **PostgreSQL** is the right database for marketplaces (joins, relations, ACID)
3. **All-in-one** — database, auth, storage, realtime from one service
4. **Generous free tier** — covers entire MVP + beta phase
5. **Data portable** — just PostgreSQL underneath, can leave anytime

**Rejected alternatives:**
- **Firebase** — wrong DB model (NoSQL document store), bad joins, vendor lock-in, expensive at scale
- **MongoDB Atlas** — wrong shape for marketplace data, weaker geo support
- **PlanetScale** — MySQL, no PostGIS
- **Neon / Railway / Render** — just DB, would need separate auth/storage
- **AWS RDS** — too much ops burden for 3-person team

**Region:** Mumbai (`ap-south-1`) — lowest latency for Indian users.

### Razorpay + Razorpay Route

**Why:**
- **India-first:** native UPI, RuPay, Indian banking infrastructure
- **Route product** handles split payouts to lenders natively (driver pays ₹150 → ₹22 to platform, ₹128 to lender, automatically)
- **Fair pricing:** 2% per transaction, no monthly fee
- **Good DX:** clean docs, predictable webhooks, sandbox mode mirrors production

**Rejected:**
- **Stripe** — limited UPI support in India
- **PayU** — older API, worse DX
- **Cashfree** — acceptable backup, slightly weaker on Route equivalent
- **Manual bank transfers** — way too much ops

**Important:** Always store money in **paise** (integers). Never use floats. Razorpay also works in paise.

**Webhook signature verification is mandatory** — never trust client-side payment callbacks.

### MSG91 (Phone OTP + critical SMS)

**Why:**
- Phone OTP is the right auth for India (no email friction)
- **₹0.15-0.20 per OTP** (5x cheaper than Twilio's ₹0.80+ in India)
- DLT-compliant (required by TRAI regulations)
- Reliable delivery on Indian carriers

**Rejected:**
- **Twilio** — global standard but expensive for India, billed in USD
- **2Factor.in** — cheaper at extreme volume, slightly weaker docs
- **AWS SNS** — DLT compliance is your problem to solve manually
- **Firebase Phone Auth** — ties to Firebase, expensive (uses Twilio underneath)

**DLT registration** is required by Indian SMS regulations. MSG91 walks you through it during signup. Plan for 1-2 days of paperwork.

### Session management — Supabase Auth (not custom cookies)

**How it works:**
1. MSG91 sends the OTP; MSG91 verifies the OTP (keeping the cost advantage)
2. On successful OTP verification, the API route calls `supabase.auth.admin.createUser({ phone: '+91...', phone_confirm: true, password: derivedPassword })` to upsert the user in `auth.users`
3. A deterministic password is derived per-phone: `HMAC-SHA256(phone, SUPABASE_PHONE_PASSWORD_SECRET)` — 64-char hex, never exposed to the user
4. `supabase.auth.signInWithPassword({ phone, password })` is called to get real Supabase Auth tokens (access + refresh)
5. Supabase SSR cookies are set on the response — middleware auto-refreshes them on every request

**Why Supabase Auth (not custom HMAC cookies):**
- RLS (`auth.uid()`) only works with real Supabase Auth sessions — custom cookies break Row Level Security entirely
- Supabase handles refresh tokens automatically — no custom expiry logic
- Standard pattern means future contributors don't have to learn a bespoke system
- `useAuth` reads from `supabase.auth.getUser()` (verified server-side), not `/api/auth/me` (extra network hop)

**Role caching in `user_metadata`:** when `POST /api/auth/role` sets the role in our `users` table, it also calls `auth.admin.updateUserById` to sync `user_metadata.role`. This lets middleware and `useAuth` read the role from the JWT without a DB call.

**Required Supabase setup:**
- Enable Phone auth in the dashboard: Authentication → Providers → Phone (no SMS provider needed — we use MSG91 directly)
- Set `SUPABASE_PHONE_PASSWORD_SECRET` in `.env.local` (generate: `openssl rand -hex 32`) — **never rotate this after launch**

**What was rejected:**
- **Custom HMAC cookie sessions** (`src/lib/session.ts` was built and deleted) — breaks RLS, no refresh, maintenance burden
- **Supabase custom SMS hook** — requires Pro plan ($25/mo) to configure a custom HTTP SMS provider

### Cloudinary

**Why:** Free 25GB. Auto-resize, CDN delivery, easy unsigned uploads from browser.

Used for: charger photos, KYC documents (later).

### Firebase Cloud Messaging — Module 6 onwards

**Why:** Free up to 1M notifications/month. Standard for cross-platform push.

Used for: booking state changes (confirmed, started, completed), payout notifications.

### Resend — Module 6 onwards

**Why:** Free 3000 emails/month. Clean React Email integration.

Used for: receipts, KYC status emails, payout confirmations.

---

## Hosting + DevOps

### Vercel

**Why:** Built by the Next.js team. Auto-deploys from GitHub. Preview URLs per PR. Edge network globally. Built-in cron jobs. Free tier covers MVP.

**Rejected:**
- **Netlify** — comparable but less Next.js-optimized
- **AWS / DigitalOcean** — too much ops burden
- **Self-hosted VPS** — wrong stage of company

### Capacitor — Module 7 only

**Why:** Wraps the existing Next.js app into an Android APK without rewriting code. iOS too if/when we want it.

**Rejected:**
- **React Native** — requires separate codebase, doubles maintenance for 3-person team, no SEO/admin/web support, 2-3 months extra learning curve
- **Flutter** — same problems plus a new language (Dart)
- **Native Kotlin/Swift** — completely out of scope

The Capacitor decision is the single most important architectural choice. Reconsidering it requires the whole team agreeing.

### GitHub

Code hosting, PR reviews, issues, project tracking. Don't switch to GitLab without strong reason.

---

## Money handling

**ALL money values stored in paise** (integer rupees × 100).

| Display | Storage |
|---------|---------|
| ₹150 | `15000` (paise) |
| ₹14.50 | `1450` (paise) |
| ₹0.50 (50 paise) | `50` (paise) |

Helpers in `src/lib/utils.ts`:
- `rupeesToPaise(rupees: number): number`
- `paiseToRupees(paise: number): number`
- `formatINR(rupees: number): string` — for display only

Razorpay's API takes amounts in paise. This convention matches their API exactly, avoiding conversion bugs.

**Never use floats for money.** `0.1 + 0.2 !== 0.3` in JavaScript. Integers in paise is the only correct way.

---

## What's deliberately NOT in the stack

These come up periodically. Each has been considered and rejected for now.

| Tool | Why not |
|------|---------|
| **Redux / Zustand / Jotai** | `useState` + `useContext` covers MVP needs. Reach for these only if specific pain emerges. |
| **React Query / SWR** | Useful eventually, premature optimization for MVP. Use server components and API routes. |
| **GraphQL** | REST + Supabase auto-API is enough. GraphQL adds tooling overhead. |
| **Docker** | Vercel + Supabase don't need containers. Maybe for a future heavy backend. |
| **Kubernetes** | Not needed at any conceivable scale for this product. |
| **Microservices** | One codebase is correct for this team size. |
| **WebSockets (custom)** | Supabase Realtime handles all our needs. |
| **Redis** | Upstash Redis for rate limiting in Module 1, but no general caching layer yet. |
| **Elasticsearch / Algolia** | Charger search is geo + simple filters. PostGIS is enough. |
| **Stripe / PayPal** | Razorpay covers India. |
| **Storybook** | Useful at scale, overhead for MVP. |
| **Module federation / monorepo tools (Nx, Turborepo)** | Single project, no need. |

---

## Versioning policy

- **Major framework versions** (Next.js, React, Tailwind) — update on a scheduled basis, not reactively
- **Patch updates** — `npm install` weekly, watch for security advisories
- **Lock file (`package-lock.json`) is committed** — ensures everyone has identical dependencies

When suggesting library additions, **default to "no" unless there's a clear, specific need.** Every new dependency is a future maintenance cost.
