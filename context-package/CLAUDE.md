# CLAUDE.md

> **This file is the entry point for AI coding assistants working on this project.**
> Read this first, then load supporting docs from `docs/` as needed.

## Project: EV Charging Marketplace (P2P)

**Tagline:** "Airbnb for home EV chargers"
**Market:** India — Delhi NCR for initial launch
**Brand name:** Kirin. Assets live in `public/brand/` (icon light, icon dark, wordmark).

## What this app does

A peer-to-peer marketplace where:

1. **Lenders** — home EV charger owners — list their idle chargers on the platform with location, connector type, price per kWh, and availability windows
2. **Drivers** — EV owners without home charging — discover nearby chargers on a map, book a slot, pay through the app, charge their car, and rate the experience
3. **Platform** — takes 10-18% commission on every completed session, holds payment until session completes, then auto-pays the lender via Razorpay Route split payouts

The product is a marketplace. The hard problems are trust (between strangers transacting), the booking state machine (preventing double-bookings, handling cancellations, refunds), and payment correctness (money must reconcile exactly between driver/platform/lender).

## Stage

Pre-launch. Foundation scaffold is built and pushed to GitHub. Team is onboarding. About to begin **Milestone 1 (Foundation)**.

## Read this first if you're an AI assistant

When you join this codebase to help with anything:

1. **Read this file completely** — gives you the whole project at a glance
2. **Load `docs/TECH_STACK.md`** — tools, services, conventions, and *why* each was chosen (and what was rejected)
3. **Load `docs/DATABASE_SCHEMA.md`** — full schema, business rules, the booking state machine
4. **Load `docs/ROADMAP.md`** — the 7 modules, what's in/out of each, and which milestone you're currently working on
5. **Load `docs/CODING_CONVENTIONS.md`** — patterns to follow, anti-patterns to avoid
6. **Load `docs/API_DESIGN.md`** — endpoint conventions, auth, error handling
7. **Load `docs/USER_FLOWS.md`** — what the user actually does, end-to-end
8. **Load `docs/BUSINESS_RULES.md`** — commission, refund policy, KYC, legal framing
9. **Load `docs/CURRENT_STATUS.md`** — what's done, what's in progress, what's blocked
10. **Load `docs/TEAM_AND_PROCESS.md`** — who owns what, how PRs work, communication rhythm

If you're modifying code, also look at the actual file you're editing and surrounding files for established patterns. **The code is the ground truth — these docs describe intent, the code describes reality.**

## Tech stack at a glance

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + React 18
- **Backend:** Next.js API routes + Supabase (PostgreSQL with PostGIS)
- **Auth:** Phone OTP via MSG91
- **Payments:** Razorpay + Razorpay Route (split payouts to lenders)
- **Storage:** Cloudinary (images), Supabase Storage (KYC docs)
- **Maps:** Leaflet.js + OpenStreetMap (free); Google Places API for address autocomplete only
- **Notifications:** Firebase Cloud Messaging (push), MSG91 (critical SMS), Resend (email)
- **Hosting:** Vercel (web), Capacitor wrap for Android Play Store (deferred to Module 7)
- **Money:** All amounts stored in **paise** (₹ × 100). Never use floats for money.

## Hard constraints

These are non-negotiable and should not be reconsidered without explicit team approval:

1. **No React Native or Flutter.** Decided after extensive discussion. Reason: 3-person team can't maintain 2-3 codebases. Next.js + Capacitor gives one codebase for web, admin, and mobile.
2. **No Firebase (the database).** Wrong shape for marketplace data with joins.
3. **No Stripe.** Poor India support. Razorpay handles UPI, RuPay, Indian banks natively.
4. **No Twilio for OTP.** ~5x more expensive than MSG91 for Indian market.
5. **Money in paise, not rupees.** Floats break money. Razorpay also works in paise.
6. **PWA-first, native-wrap-later.** No App Store / Play Store until Module 7.
7. **No iOS App Store in v1.** Deferred to v1.1 (Apple's review adds 2 weeks).
8. **Manual kWh entry for MVP.** No IoT/smart charger integration until proven product-market fit.
9. **One city at a time.** Delhi NCR first. No expansion to City 2 until City 1 hits 500+ sessions/month.
10. **Lender KYC is mandatory before listing chargers.** No charger can be created without verified lender identity (Aadhaar + PAN + bank/UPI). Implementation in Module 5 via commercial KYC API; migration to DigiLocker direct in Module 8+. Drivers do NOT need KYC. See `docs/KYC_STRATEGY.md`.

## Forbidden patterns

If you find yourself about to write any of these, stop and reconsider:

- **Storing money as floats** — always integers in paise
- **Trusting the frontend for payment confirmation** — always verify via Razorpay webhook server-side
- **Using `any` in TypeScript** without a comment explaining why
- **Committing `.env.local` or any file with secrets**
- **Pushing directly to `main`** — everything goes through a Pull Request
- **Hardcoding API keys** anywhere in the codebase
- **Inline styles** when Tailwind classes work — keep consistency
- **Class components** — function components and hooks only
- **`useEffect` for derived state** — compute values, don't store them
- **Polling for booking status** — use Supabase realtime instead
- **N+1 queries** — fetch related data in single queries, not loops
- **Building features for "10,000 concurrent users"** when you have 0 users — scale when measured, not predicted

## Team

| Person | Owns | GitHub |
|--------|------|--------|
| Akash | Booking state machine, auth, Milestone 1/3/5 lead | akashK-718 |
| Hitesh | Map, discovery, charger detail (Modules 1, 2, 6 polish) | TBD |
| Rohan | Payments, admin dashboard (Modules 5, 6) | TBD |

Three-person team, part-time alongside day jobs. Akash has Playwright/TypeScript background. Hitesh and Rohan are learning React/Next.js while building. **Pace yourself accordingly when suggesting work** — keep tasks scoped to what a part-time team can ship.

## Current module

**Module 1: Foundation** (Weeks 1-2)

In scope:
- Next.js + Supabase + Vercel set up ✅ (scaffold done)
- Phone OTP login via MSG91
- Role selection (driver / lender / both)
- Lender registration form (charger type, connector, price, address, photos)
- Basic charger list view (no map yet)
- Database migrations
- Auth middleware

Out of scope (later modules):
- Map view → Module 2
- Booking flow → Module 3
- Real payments → Module 5
- Admin dashboard → Module 6
- Capacitor + Play Store → Module 7

See `docs/ROADMAP.md` for the full module breakdown.

## How AI assistants should approach work in this codebase

When asked to add a feature or fix a bug:

1. **Check which module the feature belongs to.** If it's a Module 4 feature and we're in Module 1, push back. Don't build ahead.
2. **Read the relevant existing files first.** Don't suggest patterns that conflict with established ones.
3. **Prefer small, focused PRs.** One logical change per PR. Don't bundle unrelated changes.
4. **Keep TypeScript strict.** Don't reach for `any`. If a type is genuinely unknown, use `unknown` and narrow it.
5. **Use server components by default.** Only reach for `'use client'` when you need interactivity (state, event handlers, browser APIs).
6. **Database changes go in migration files.** Never modify the schema directly in Supabase dashboard for shared changes.
7. **Money goes through `paiseToRupees` / `rupeesToPaise` helpers.** Don't divide by 100 inline.
8. **Errors should be user-facing strings.** Don't expose raw error messages from libraries to users.
9. **Test on mobile viewport.** The product is mobile-first. If it doesn't look right at 390px wide, it's not done.
10. **When in doubt, ask before assuming.** Better to clarify than to write 200 lines of wrong code.

## File structure

```
src/
├── app/                  # Next.js pages (file-based routing) + API routes
│   ├── api/              # Backend endpoints
│   ├── login/            # /login
│   ├── chargers/         # /chargers, /chargers/[id]
│   ├── bookings/         # /bookings, /bookings/new, /bookings/[id]
│   ├── lender/           # /lender/* (lender-side pages)
│   └── admin/            # /admin/* (admin dashboard)
├── components/           # Reusable React components
│   ├── ui/               # Generic primitives (Button, Input, Card)
│   ├── layout/           # Layout components (Header, BottomNav)
│   ├── chargers/         # Feature-specific
│   ├── bookings/
│   └── payments/
├── lib/                  # Shared utilities and SDK clients
│   ├── supabase/         # client.ts, server.ts, types.ts
│   ├── razorpay.ts       # Razorpay SDK + webhook verification
│   ├── msg91.ts          # OTP helpers
│   ├── cloudinary.ts     # Image upload helpers
│   ├── utils.ts          # Generic (formatINR, cn, generateConfirmationCode)
│   └── constants.ts      # Commission %, timeouts, enums
├── hooks/                # Custom React hooks
├── types/                # Shared TypeScript types
└── middleware.ts         # Auth middleware

supabase/migrations/      # DB schema as SQL files (versioned)
```

When creating a new feature, place files according to this structure. Don't invent new top-level folders without team discussion.
