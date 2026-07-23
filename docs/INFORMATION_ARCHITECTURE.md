# Information Architecture

This is the locked navigation and screen structure for the app. Every screen-level build should reference this doc, along with `/design` (visual tokens) and `DESIGN_EV.md` (styling and copy guardrails).

## Bottom Navigation

Four tabs, role-agnostic. The nav structure never changes based on whether a user is a driver, a lender, or both. What changes is the *content* inside each tab, never the tabs themselves.

1. Home
2. Explore
3. Activity
4. Profile

There is no separate Notifications tab. Unread notifications surface as a badge count directly on the Activity tab (e.g. "Activity · 3").

There is no separate Hosting tab. Lender operations live in a linked-into Hosting Workspace, reached from Home or Profile, not from the bottom nav.

## Screen Ownership Principle

This is the core rule that prevents duplication across screens. Every screen has things it owns and things it must never own.

| Screen | Owns | Never owns |
|---|---|---|
| Home | Live state, pending actions, contextual shortcuts | Permanent navigation, settings |
| Explore | Discovery | History, profile |
| Activity | History + Updates | Configuration |
| Profile | Identity, configuration, account | Operational workflows |
| Hosting Workspace | Marketplace operations | Personal identity |

## Home

Home is not a dashboard. A dashboard optimizes for awareness (here is what exists). Home is an **operational feed**: it optimizes for decision-making (here is what you should do next). Users open it for 15-30 seconds at a time, so it should surface the single most useful thing first, not a wall of stats.

**The core test for every card:** "Why is this card on my Home today?"

Valid answers: it is time-sensitive or blocking, it is unfinished work, the user is new and needs onboarding, or it is a genuine data-driven suggestion.

Invalid answers: "because this page exists elsewhere," "users might want to go there," "the screen looked empty." If a card's justification is one of these, it does not belong on Home.

### Renderer structure

Home is built from five named zones, evaluated top to bottom. A zone that has nothing to show simply does not render (no headers, no zero-states). Never show a zone with a zero-state (no "Today's Bookings: 0").

```
Greeting        always          time-of-day salutation + avatar
Attention       0..N cards      the only zone that stacks; time-sensitive, session, account-blocking, financial
Snapshot        0..2 cards      read-only glance cards — tap to open, no action buttons
Quick Actions   always          Find Charger, Plan Trip — navigation shortcuts only
Nudge           0..1 card       cascade: unfinished → install-pwa → rule → discovery → evergreen tip
```

**Quick Actions is always visible** regardless of account state. It contains only navigation shortcuts (never information cards, never summaries) and must never compete with Attention or Nudge content.

**Max one card in Snapshot**, except it can hold up to 2 (e.g. one charging card + one hosting card). If more candidates qualify, pick the most valuable. Never let Snapshot become a to-do list.

**Attention is the sole exception** that stacks: multiple cards can appear simultaneously (e.g. "booking starts in 12 minutes" and "charger offline"), because both are genuinely blocking and hiding one risks missing something.

**Attention internal ordering**, when multiple Attention cards exist, sort in this exact order:

1. Time-sensitive (booking starts in X minutes)
2. Session-related (driver waiting at charger)
3. Account-blocking (KYC rejected)
4. Financial (payout failed)
5. Everything else informational

> **Implementation drift (known):** Pending booking requests (host-side Attention — "someone wants to charge") currently render *after* Snapshot in `src/app/home/page.tsx` rather than before it. This is a known ordering deviation; all other Attention items correctly render before Snapshot.

### Card source classes

Used for Nudge (rule and tip variants) specifically. This deliberately avoids building any kind of AI/ML recommendation system for v1.

- **Class A, State Cards** — generated directly from deterministic database state (booking starts soon, resume draft, KYC rejected, charger offline, payout processed). These primarily populate Attention and Snapshot.
- **Class B, Rule Cards** — simple boolean conditions, no ML. Example: `if charger.photos < 5` → "Listings with 5+ photos receive more bookings." `if vehicle_count == 0` → "Add your first vehicle." `if no_booking_30_days` → "Lowering your price may increase bookings." These populate Nudge (rule variant).
- **Class C, Evergreen Tips** — lowest priority, static rotating content from a simple pool (e.g. a `tips.ts` file), used only when nothing better exists. "Charging during off-peak hours can be cheaper." "You can pause your charger any time." These populate Nudge (tip variant).

### KYC cards

KYC gets its own four-state card type rather than being a generic notification. Lives in Attention when actionable.

- **Not Started** — "Complete verification, required before hosting" → Attention for lenders (blocking)
- **Pending** — "Verification under review, submitted [date], we'll notify you soon." Informational, does not need to be Attention. Lives in Snapshot.
- **Approved** — no card on Home at all. Just a small badge in Profile. Do not spend Home space on a success state.
- **Rejected** — "Verification rejected, [specific reason, e.g. PAN image is blurry]" → Resubmit. This is actionable, so it stays in Attention, not Snapshot.

### Visual stability

Card presence is priority-driven, but Home should not feel like an unpredictable social feed. Each bucket's class of card should always render in the same reserved visual region when present, so a returning user builds spatial memory. In short: priority determines *whether* a card appears; fixed layout regions determine *where* that class of card appears when it does.

### Navigation on Home

Avoid **generic** navigation ("Go to Explore," a bare "My Chargers" link). Contextual navigation that has earned its place through relevance is fine and encouraged ("Your charger is offline, Manage →", "Resume charger draft, Step 5 of 7 →"). The distinction is whether the card is contextually earned, not whether the destination merely exists.

### New-user states

No fake empty dashboard. P2 Snapshot is skipped entirely for brand-new users; go straight from empty P0/P1 to onboarding content.

**New driver:**
```
Greeting
Welcome, you're all set to start charging.
Use Explore to find verified home chargers near you.
[Explore Chargers]
─────────
How it works — 3 simple steps
Learn more →
─────────
Need help? Read FAQs →
```
Do not show a mini-Explore charger list or "top rated chargers near you" on Home. That duplicates Explore's ownership of discovery.

**Nearby charger cards must never appear on Home** — not as a carousel, grid, or any other format. Explore is the single owner of charger discovery. Use a "Find a charger" CTA to link users into Explore; the CTA may carry a `?mode=near_me` deeplink to land them in the right mode.

**New lender:**
```
Greeting
Complete verification
Required before hosting.
Continue →
─────────
Resume your charger listing
Step 3 of 7
Continue →
─────────
Hosting
0 Chargers · Not Live
Manage →
```

### Adding a new card or feature to Home

Ask three questions, in order:

1. Which zone does it belong to: Attention, Snapshot, or Nudge? (Quick Actions is fixed — never add data cards there.)
2. Does it outrank the card(s) already in that zone?
3. Does the zone already have its maximum card count?

If these three questions don't yield a clear place for it, it probably doesn't belong on Home at all.

## Explore

Discovery only. Nothing about history, bookings, or configuration lives here.

- **Near Me** — GPS, address search, radius, map/list toggle
- **Along Route** — from, to, buffer, route map
- **Filters** — connector type, price, future filters
- **Charger Detail** — gallery, specifications, host, pricing, reviews, location, instructions, Book Now
- **Booking Entry** — create booking flow starts here

Lenders can also view their own charger(s) on the map here and check listing visibility. No separate map tab exists outside Explore.

## Activity

History and Updates, as two sub-views within one tab, not two separate tabs.

**History** — Today / Yesterday / Earlier, merging driver sessions, hosting sessions, payments, payouts, cancelled, and completed items together chronologically. Not split into separate driver history and lender history.

**Updates** — booking confirmed, booking cancelled, booking started, booking ended, KYC approved, KYC rejected, payout processed. Future: promotions, announcements, maintenance alerts.

Unread count shows as a badge on the Activity tab itself. No bell icon anywhere in top nav, desktop or PWA.

### Sessions — role awareness

Each `HistoryItem` carries `roleInSession: 'driver' | 'host'`, derived from whether the logged-in user was the booking's driver (`kind: 'charging'`) or the charger's host (`kind: 'hosting'`). This field drives the card component dispatch — do not use a single generic card with role conditionals inside it.

**Component split:**
- `DriverFeaturedCard` / `DriverCompactRow` — eyebrow "YOU CHARGED", secondary line "Hosted by [name]", money label "Paid ₹X"
- `HostFeaturedCard` / `HostCompactRow` — eyebrow "YOU HOSTED", secondary line "Guest: [name]", money label "Earned ₹X"

Both the featured card and every compact row render the role-specific component.

**Status label mapping (presentation layer only — backend enum is unchanged):**

| Backend status | Driver label | Host label |
|---|---|---|
| `pending` | Awaiting confirmation | Awaiting your approval |
| `confirmed` | Confirmed | Booking confirmed |
| `awaiting_driver_confirmation` | Ready to start | Waiting for driver |
| `in_progress` | Charging in progress | Guest charging |
| `awaiting_end_confirmation` | Ready to end | Waiting to end session |
| `completed` | Completed | Completed |
| `cancelled` | Cancelled | Cancelled |
| `no_show` | No show | Driver didn't arrive |
| `auto_reject` | Not accepted | Auto-rejected |

**CTAs — driver card:** Get directions (pending/confirmed), Start session (awaiting_driver_confirmation), View session (in_progress/awaiting_end_confirmation), Book again + Rate if unrated (completed), View details (cancelled/no_show/auto_reject).

**CTAs — host card:** "View booking →" only, in every status, no exceptions. Activity is a read-only ledger — Accept/Reject and all other operational actions live in Hosting Workspace → Bookings → Booking Detail. Never add Accept/Reject, Start, or End buttons to the host card in Activity.

## Profile

Answers: "What belongs to me?" Nothing here changes minute to minute. Pure identity and configuration, never operational workflows.

- **Account** — avatar, name, phone, role
- **Verification** — not started / pending / approved / rejected
- **Vehicles**
- **Payment Methods**
- **Preferences** — notifications toggle, theme (future), language (future), permissions
- **Hosting** — hosting enabled toggle, live chargers count, "Open Hosting Workspace →" link (a pointer into the workspace, not the operational tools themselves)

**Overflow menu** (⋮ icon, top-right, Profile screen only, Instagram-style, not global): Help, Terms, Admin (conditional on `is_admin`), Sign Out. Contact us is not a separate item, it lives inside the Help page itself.

Sign out always redirects to `/` (the public landing page), never to an authenticated route.

## Hosting Workspace

A unified surface for all lender operations. Reached via "Open Hosting Workspace →" from Home's Hosting Preview or Profile's Hosting section. Explicitly not a bottom nav tab, this avoids giving pure drivers a dead tab and keeps the main nav role-agnostic.

- **Overview** — weekly earnings, active chargers, draft chargers, recent bookings, quick actions
- **Chargers** — all / live / paused / draft / suspended, plus charger detail
- **Bookings** — active / past / cancelled, plus detail
- **Finance**
  - **Overview** — total earned (all time), pending payouts at a glance *(not yet built — flag as separate scope)*
  - **Earnings** — this week/month/lifetime totals, per-session breakdown, trends (`/lender/earnings`)
  - **Payouts** — pending/processing/paid history, bank transfer references, failed payout recovery (`/lender/payouts`)

  Earnings and Payouts are distinct destinations with distinct mental models: Earnings answers "how much did I make?" (revenue tracking); Payouts answers "did the money arrive?" (bank transfer status, UTR refs, failed transfers).
- **Add Charger** — 7-step wizard

## Authentication Flow

```
Landing          /
Login            /login          (phone number)
Verify OTP       /verify-otp
Welcome / Name   /welcome/name
```

There is no role selection step. A `/welcome/role` step (Driver / Lender / Both) was proposed and explicitly dropped. This stays consistent with the driver-first, lender-as-in-app-upgrade signup model: onboarding ends at name capture, role is never asked upfront, and lender access is only ever discovered later through Home's Hosting Preview or Profile's Hosting section.

## Booking Flows

**Driver side:** Create (date, time, duration, estimate, Razorpay) → Booking Detail → Session → Rating

**Lender side:** Booking Detail → Accept/Reject → Session → Complete → Rating

## Booking Lifecycle

### State machine

```
pending → confirmed → awaiting_driver_confirmation → in_progress → awaiting_end_confirmation → completed
       ↘ auto_rejected (30-min timeout)
          confirmed/awaiting_driver_confirmation → no_show
          any active state → cancelled (driver or admin)
```

### Terminal states

`auto_rejected` and `no_show` are irreversible by design. A database trigger (`booking_terminal_state_guard`, migration 027) enforces this at the DB layer and raises an exception on any attempted status transition away from these states.

### No-show lifecycle (awaiting_driver_confirmation)

When the host taps Start and the driver hasn't confirmed, a 30-minute timer begins (tracked via `bookings.started_at`):

- **T+25 min**: Push notification to host — "Driver hasn't arrived. Auto-cancel in 5 minutes." with two action buttons: **Keep Waiting** (extends by 30 min, one-time only) and **Mark No-show** (immediate).
- **T+30 min**: Auto-transition to `no_show` if Keep Waiting was not used.
- **T+55 min** (if Keep Waiting used): Second and final warning to host — no further extension.
- **T+60 min**: Hard cutoff — `no_show` regardless of extension.

Implemented in `src/lib/bookings/no-show-sweep.ts`, called by the pg_cron lifecycle sweep every minute.

### awaiting_end_confirmation — manual review, never auto-complete

MVP Rule: Kirin has no hardware-backed charger telemetry. Session energy and cost are derived from application events rather than physical meter readings. Therefore, any session stuck in awaiting_end_confirmation cannot be safely auto-completed and is placed into a manual review queue for resolution. This rule should be revisited if/when OCPP or smart-meter telemetry is added in a future version.

Sessions stuck in `awaiting_end_confirmation` for more than `SESSION_END_REVIEW_GRACE_MINUTES` (default 30 min) are inserted into `session_review_queue` and flagged for admin resolution at `/admin/review-queue`. The previous auto-complete behaviour (`src/lib/bookings/auto-complete-end.ts`) has been removed.

### Scheduling infrastructure

The `booking-lifecycle-sweep` pg_cron job (migration 026) calls `POST /api/internal/lifecycle-sweep` every minute. This endpoint runs all time-sensitive sweeps:
1. Auto-reject pending requests not accepted within 30 min.
2. No-show warning at T+25 min.
3. No-show auto-transition at T+30/60 min.
4. Flag stuck `awaiting_end_confirmation` sessions for review.

Lazy sweeps in individual API routes remain as a belt-and-suspenders fallback. Setup steps are in `docs/SETUP.md § Lifecycle sweep`.

### Charger slot availability

Slot availability is derived from active booking status. When a booking reaches any terminal state (`auto_rejected`, `no_show`, `cancelled`, `completed`), it is no longer "active" and the slot is immediately available for new bookings. No explicit slot-release step is needed — the status-based filtering in `chargers_within_radius` and `chargers_along_route` handles this automatically.

## Admin

Dashboard → KYC → Payouts → Users → Disputes → Session review queue

## Help

FAQ → Payments → Hosting → Contact (Contact is folded into this page, not a separate top-level destination)

---

## Client-side Storage Scoping

Any feature that persists state in the browser MUST classify its storage key into one of three buckets before writing. Adding a new key without picking a bucket is a bug.

| Bucket | Scope | Rule | Examples |
|---|---|---|---|
| **Device-level** | Device | Fine as a flat key — not tied to any user | `pwa_install_nudge_v1`, `kirin_intro_done` (sessionStorage) |
| **User-level** | Authenticated user ID | Key MUST use `{base}:{userId}` pattern via `userKey()` in `src/lib/user-storage.ts`. NOT cleared on logout — persists for that user on next login. Legacy flat key MUST be purged on init via `purgeLegacyKey()`. | `chargers_map_state_v2:{userId}`, `kirin:milestones:{userId}`, `lender:new-charger:draft:{userId}` |
| **Session-level** | Auth token lifetime | Must be fully cleared when `supabase.signOut()` is called. Supabase handles its own tokens; OTP and in-progress booking/payment state fall here. | Supabase access/refresh tokens, OTP flow state |

**Why this matters:** a flat User-level key written by User A remains visible to User B who logs in on the same device after User A logs out. Route searches include real coordinates and are personal data — this is a privacy bug, not just a UX issue. The `{base}:{userId}` pattern ensures each user reads and writes only their own state.

**On logout:** Supabase `signOut()` clears Session-level tokens. User-level scoped keys are intentionally *not* cleared — the point is that User A's saved state is still there if User A logs back in later. Device-level keys are never touched by login/logout.

## PWA Update Paths

There are two distinct kinds of PWA update. They use different mechanisms and have different limitations. Conflating them produces "bug reports" that can't be fixed.

### Path 1 — App code and features (service worker lifecycle)

**What updates:** JavaScript bundles, API routes, page content, this service worker (`/sw.js`).

**How it works:**
1. The browser detects a byte change in `/sw.js` on the next navigation (or after ~24 h if the app is left open).
2. The new service worker downloads and enters the `waiting` state.
3. `UpdateBanner` (`src/components/ui/UpdateBanner.tsx`) surfaces: *"Update available — A new version of Kirin is ready."*
4. **"Update now"** → sends `SKIP_WAITING` to the waiting SW → SW activates → page reloads to pick up new JS bundles.
5. **"Later"** → banner is dismissed for the current session only (React state, no localStorage). The banner reappears on the next fresh app open if the update is still pending.

**What never happens:** an automatic reload without the user tapping "Update now." A surprise reload mid-booking, mid-payment, or mid-charging-session-confirmation is explicitly prevented by never calling `skipWaiting()` automatically in `sw.js`.

### Path 2 — Installed app metadata (OS-cached at install time)

**What updates:** home-screen icon, app name, splash screen, theme colour — everything in `manifest.json`.

**How it works (and doesn't):**
- Changing `manifest.json` and deploying immediately updates the in-browser experience (browser chrome, address bar theme).
- However, the OS caches the icon, name, and splash **at the moment the user taps "Add to Home Screen."** These assets are stored by the platform, not by the service worker.
- Changing `manifest.json` after install does **not** reliably update the home-screen icon or splash on Android or iOS without the user uninstalling and reinstalling the PWA.
- This is a platform limitation. It cannot be fixed from the web app. If an icon update is critical, instruct users to remove and re-add the app.

**Common misread:** a user who installed the app before an icon change and reports "the icon didn't update" is experiencing Path 2, not a broken deployment. The service-worker banner (Path 1) cannot help them — they need to reinstall.

## Notes for implementation

- Every screen must reference the current `/design` foundation for visual tokens (colors, fonts, radius, shadows) and `DESIGN_EV.md` for content/interaction guardrails (no em dashes, no default pill-everything, no decorative animation, varied section header treatments).
- Build mobile/PWA first, but every screen must also work correctly at desktop width.
- This document reflects the current locked architecture. If a build reveals a real conflict with what's written here, flag it rather than silently deviating.
