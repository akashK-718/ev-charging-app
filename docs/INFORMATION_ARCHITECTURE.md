# Information Architecture

This is the locked navigation and screen structure for the app. Every screen-level build should reference this doc, along with `/design` (visual tokens) and `DESIGN_EV.md` (styling and copy guardrails).

## Capability Model

**Charging is universal.** Every account can always book and use a charger regardless of hosting status. **Hosting is the only optional capability**, turned on from inside the app — not chosen at signup.

**`role` is exactly two values: `driver` and `lender`.** There is no `both` value and none should ever be introduced — `lender` already implies full driver capability. Internally the DB stores a role enum (`driver` / `lender`) for routing and feature-gating convenience; the user never sees it. Any code gating driver-route access by role is a bug: only hosting-specific routes (`/lender/*` and lender API endpoints) should ever check `role === 'lender'`. The `canAccessDriver` pattern must never exist.

## Bottom Navigation

Four tabs, role-agnostic. The nav structure never changes based on whether a user is a driver or a lender. What changes is the *content* inside each tab, never the tabs themselves.

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
PWA Install     0..1 card       independent; shown only when install is eligible and not dismissed
Nudge           0..1 card       cascade: unfinished → rule → discovery → evergreen tip
```

**PWA Install card** sits between Quick Actions and Nudge. It is fully independent of the Nudge cascade — both the PWA card and the Nudge card can be visible simultaneously. The card renders client-side after checking: (a) not already in standalone/PWA mode, (b) user has not previously dismissed it as "never" or "later" (stored in `localStorage` via `readPwaDismissal`), (c) either a `beforeinstallprompt` event is available (Chromium) or the browser is iOS Safari (manual Add to Home Screen instructions). Implemented in `src/components/home/PwaInstallCard.tsx`.

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
- **Class B, Rule Cards** — simple boolean conditions, no ML. Example: `if charger.photos < 3` → "Listings with 3+ photos receive more bookings." `if vehicle_count == 0` → "Add your first vehicle." `if no_booking_30_days` → "Lowering your price may increase bookings." These populate Nudge (rule variant). Note: the nudge threshold (3 photos) is distinct from the upload cap (5 photos max per charger) — do not conflate them.
- **Class C, Evergreen Tips** — lowest priority, static rotating content from `src/lib/home/tips.ts`, shown only when no Class A or Class B card exists. Rendered by `src/components/home/TipNudge.tsx` (client component). **Class A and Class B are purely state-driven and have no time component — they re-evaluate on every Home load.** Only Class C has time-based behavior.

  **Tip pool (12 tips):**

  | ID | Eligibility | Body |
  |---|---|---|
  | `check-availability` | always | Check charger availability before starting your trip. |
  | `plan-longer-journeys` | always | Plan your charging stop before longer journeys. |
  | `vehicle-details` | always | Keep your vehicle details updated for smoother bookings. |
  | `session-start` | always | Only start a session when the vehicle is at the charger. |
  | `plan-trip` | always | Plan a trip to find charging stops along your route. |
  | `check-activity` | always | Check Activity for your charging and hosting history. |
  | `save-chargers` | `saved_chargers` flag | Save chargers you use often for quicker access. |
  | `pause-charger` | hosting | You can pause your charger whenever it isn't available. |
  | `update-availability` | hosting | Keeping your availability updated helps avoid cancellations. |
  | `clear-photos` | hosting | Clear charger photos help drivers know what to expect. |
  | `connector-details` | hosting | Keep your charger details and connector information up to date. |
  | `review-listing` | hosting | Review your listing after changing your charging setup. |

  **Eligibility gating:** Tips tagged `hosting` are only shown to users with hosting enabled (`isHosting === true`). The `save-chargers` tip is gated behind the `saved_chargers_enabled` Vercel Edge Config flag (currently `false` — feature not yet built). Users who have never had hosting enabled will never see a hosting-tagged tip. The server computes the eligible subset and passes it to `TipNudge` as `eligibleTips: Tip[]`.

  **6-hour rolling window rotation:** `TipNudge` reads `kirin:home:tip:{userId}` from localStorage (`{base}:{userId}` User-level scoped pattern via `userKey()`). If the stored tip is still in the eligible pool and fewer than 6 hours have elapsed since `firstShown`, the same tip continues to show — across multiple Home loads, app closes, and reopens within that window. After 6 hours, a new tip is selected (excluding the just-shown tip if the pool has more than one option) and `firstShown` is reset to now. Selection is deterministic by 6-hour window index (`Math.floor(Date.now() / WINDOW_MS)`), not random per load. If the stored tip becomes ineligible mid-window (e.g. hosting is disabled), re-selection happens immediately on the next load without waiting for the window to expire.

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

### Hosting-enable entry points (two, intentional, distinct)

There are two places in the app that can lead a user into enabling hosting. They serve different populations and must not be conflated.

| Entry point | Location | Who sees it | Behaviour |
|---|---|---|---|
| **"Learn about hosting"** | Home — Nudge zone, `new-user` empty-state fallback | Brand-new users only, when Attention has nothing to show | Routes to `/hosting/learn` (Hosting Introduction screen) before enabling hosting |
| **"Have a home charger? Turn on hosting"** | Profile — hosting section, `not_enabled` state | Any non-hosting user, at any time | Calls `POST /api/profile/enable-hosting` directly on tap; no education step |

The Home entry is in the Attention-zone `new-user` empty-state fallback — a fixed affordance that renders only when Attention has nothing else to show for a brand-new user. It is not part of the Nudge cascade. The Profile entry is a persistent gradient card always visible to non-hosting users; it is the shortcut for users who have already decided. Both are intentional: do not merge them into a single path, and do not change the Profile card to route through `/hosting/learn`.

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

**Authorship rule**: Content a user has authored (e.g. reviews they wrote) belongs on Profile. Reputation others have assigned them as a host (received reviews, star ratings) belongs on Hosting Workspace / Host Dashboard as a performance metric, alongside earnings and bookings.

Profile is organised into labeled subsections, in this order:

1. **Hosting** — hosting promo card / setup card / Host Dashboard card + Pause/Resume listing row (shown only when hosting is enabled; see hosting states below)
2. **Identity Verification** — not started / pending / approved / rejected (shown only when hosting is started)
3. **Account** — Name (editable inline), Phone (read-only with contact support link), My vehicle (coming soon), Payment methods (`/profile/payment-methods`)
4. **Preferences** — Notifications (`/profile/notifications`)
5. **Your Activity** — Reviews (`/profile/reviews`) — written reviews only; see authorship rule above
6. **Support** — Help & support
7. **Danger Zone** — Stop Hosting row (shown only when `hostingState === 'active'`)

**Hosting** — the Host Dashboard card and any other entry point into the Hosting Workspace **must always navigate to Hosting Workspace → Overview (`/lender/dashboard`), never directly to Chargers, Bookings, or any other sub-section**. My Chargers is one branch of hosting and does not fulfil what the Host Dashboard card promises.

### Notification Preferences (`/profile/notifications`)

Push notification opt-out by category. This is **preferences only** — it controls which FCM pushes are delivered. It is not a notification inbox; that lives in Activity → Updates.

| Category | Default | Notes |
|---|---|---|
| Booking updates | On | Confirmations, rejections, cancellations, session completions (driver-side) |
| Charging reminders | On | Session start/end confirmation prompts (driver-side) |
| Hosting activity | On | New requests, session events, no-show warnings (lender-side) |
| KYC updates | On | Verification approved/rejected/resubmission required |
| Payments & payouts | On | Payout processed notifications |
| Security alerts | Always on | Non-toggleable — required for account security |
| Product announcements | On | New features and platform updates |
| Promotions & offers | Off | Discounts and limited-time offers — defaults off per product convention |

Preferences are stored server-side in `notification_preferences` (one row per user, lazily created on first toggle). Every `sendPushNotification` call passes a `category` and checks the user's stored preference before sending — toggling a category off immediately suppresses that category's pushes across all devices.

### Payment Methods (`/profile/payment-methods`)

A reflection layer over Razorpay's saved-methods data — not a custom payment vault. It is not the source of truth for payment data; Razorpay is.

**What it shows:**
- **UPI** — saved UPI VPAs, in order of recency
- **Cards** — saved cards, showing masked card number, network, expiry, and issuer
- **Receiving Payouts** (lenders only) — payout account (bank or UPI) collected during KYC onboarding, read from `kyc_submissions`; links to `/profile/verify` to manage

**How methods are saved:** Razorpay Standard Checkout has no standalone "add method without payment" flow. Methods are associated with the user's Razorpay customer record during an actual checkout when the user taps "Save for later." The screen shows an informational callout explaining this.

**Mark default:** Users can designate one method as their preferred default. The preference is stored on `users.default_payment_token_id` and respected at checkout time. Razorpay has no server-side default concept for tokens.

**Remove:** Calls `DELETE /customers/{id}/tokens/{tokenId}` via the Razorpay API. Clears `default_payment_token_id` if the removed method was the default.

**Razorpay customer lifecycle:** A Razorpay customer (`cust_…`) is created lazily on first visit to this screen and stored on `users.razorpay_customer_id`. `fail_existing: 0` is passed to `customers.create` so re-creation on the same phone number is idempotent.

**Payout detail editing:** "Manage payout details" links to `/profile/verify`, the KYC wizard where Step 4 (StepBankUpi) collects bank account / UPI for payouts. Updating payout details requires a full KYC resubmission — there is no lightweight edit flow.

### Reviews (`/profile/reviews`)

Archive of reviews the user has **written** — no received reviews appear here (see authorship rule above).

One card per completed booking:
- Driver users: Charger rating + Host rating (submitted together) and optional review text
- Lender users: Driver rating per booking

Tapping a card links to the booking detail (`/bookings/{id}`).

### About Kirin (`/profile/about`)

Static app information screen: app version and build, contact link (→ /help), terms of service (→ /terms), privacy policy (placeholder until /privacy is built), copyright line. Release notes are future scope — the item is visible but disabled. No auth required.

Accessible via the three-dot overflow menu on Profile.

**Overflow menu** (⋮ icon, top-right, Profile screen only, not global): About Kirin, Restore install prompt (conditional — shown only if the PWA install prompt was permanently dismissed), Terms and privacy, Sign out. Admin panel appears above About Kirin only for admin accounts. Contact us is not a separate overflow item — it lives inside Help & support and About Kirin.

Sign out always redirects to `/` (the public landing page), never to an authenticated route.

## Hosting Introduction (`/hosting/learn`)

A standalone pre-decision educational screen. It does not fit the Hosting Workspace ownership table (the Workspace only exists post-first-publish) and does not belong in Profile (which owns configuration, not pre-decision education). It is its own screen with its own route.

**Reached from:** Home's `new-user` empty-state fallback ("Learn about hosting" CTA). Not linked from the bottom nav, not linked from Profile, not reachable from the Hosting Workspace, and not part of any wizard flow.

**Purpose:** Give undecided users a brief, factual look at what hosting involves before they commit. Sections: what hosting is, how it works (5 steps), what you will need, what is required before going live (KYC + bank/UPI), and the benefits. These sections reflect only what is already established in the app — no new claims or promises are introduced here.

**CTA ("Start hosting"):** Calls `POST /api/profile/enable-hosting` on the client, then navigates to `/profile`. After the call succeeds, Profile renders the `setup_in_progress` hosting state, and its existing `setupContinueHref` logic routes the user to KYC (if not yet approved) or Add Charger (if already approved).

**Not a wizard step.** This screen has no Back step within a flow; it is read-then-decide. The user can leave via the back link (Home) or the bottom nav at any time.

**Profile's "Turn on hosting" card is unaffected.** Profile calls `enable-hosting` directly on tap and has always done so. This screen is a new front door for undecided users, not a replacement for the shortcut on Profile. See the "Hosting-enable entry points" table in the Home section above.

## Hosting Workspace

A unified surface for all lender operations. Reached via "Open Hosting Workspace →" from Home's Hosting Preview or Profile's Hosting section. Explicitly not a bottom nav tab, this avoids giving pure drivers a dead tab and keeps the main nav role-agnostic.

- **Overview** — today's earnings, upcoming bookings, live chargers, draft chargers, quick actions, recent activity, and a **host rating summary** (average star rating from driver reviews, total review count, "View all →" link to Host Reviews). The rating summary is always present for lenders — shows empty state if no reviews yet.
- **Host Reviews** (`/lender/reviews`) — overall star average, star-distribution breakdown (5★ through 1★ with proportional bars), and a chronological list of reviews received from drivers. Each row links to the corresponding booking detail. Non-lenders who visit this route are redirected to `/profile`.
- **Chargers** — all / live / paused / draft / suspended, plus charger detail
- **Bookings** — active / past / cancelled, plus detail

  > **Known IA cleanup (not yet scheduled):** The current filter taxonomy (`active / past / cancelled`) is a loose paraphrase of the actual booking state machine, not a 1:1 mapping. Backend states and user-facing filters are intentionally two separate layers — the filter model does not need to expose every lifecycle enum value. Proposed future grouping:
  >
  > | Filter | Backend states |
  > |---|---|
  > | Pending | `pending` |
  > | Upcoming | `confirmed` |
  > | In progress | `awaiting_driver_confirmation`, `in_progress`, `awaiting_end_confirmation` |
  > | Completed | `completed` |
  > | Cancelled | `cancelled`, `auto_reject` |
  > | No-show | `no_show` |
  >
  > Do not implement this as part of any unrelated PR — this is a standalone reconciliation task to be scheduled separately.
- **Finance**
  - **Overview** — total earned (all time), pending payouts at a glance *(not yet built — flag as separate scope)*
  - **Earnings** — this week/month/lifetime totals, per-session breakdown, trends (`/lender/earnings`)
  - **Payouts** — pending/processing/paid history, bank transfer references, failed payout recovery (`/lender/payouts`)

  Earnings and Payouts are distinct destinations with distinct mental models: Earnings answers "how much did I make?" (revenue tracking); Payouts answers "did the money arrive?" (bank transfer status, UTR refs, failed transfers).
- **Add Charger** — 7-step wizard

## Authentication Flow

```
Landing   /
Auth      /auth          single route — internal AuthStep state: null | 'phone' | 'otp' | 'profile'
Role      /welcome/role  only reached for new accounts after name capture
```

### Session states

Two distinct states are tracked in `user_metadata`:

- **`authenticated`** — a Supabase Auth session exists (OTP verified). `onboarded: false` in `user_metadata`.
- **`onboarding_complete`** — name has been saved, `onboarded: true` in `user_metadata`. BottomNav, desktop nav links, and authenticated-app routes are only accessible once this is true.

`onboarded` is set to `false` on new-user creation (`verify-otp` route) and flipped to `true` when name (or role) is saved (`/api/profile`). Existing accounts without the flag fall back to `!!name`.

### Route resolution order (middleware)

1. **No session** → redirect to `/auth`
2. **Session + `!isOnboarded`** → redirect to `/auth` (profile step shown; no re-OTP required)
3. **Session + `isOnboarded`** → allow through to the requested route (or redirect `/` to role home)

### Auth steps

All auth lives at `/auth` with no full-page reload between steps. The page starts in `null` (loading) state to check auth before showing the phone step, preventing a flash for users resuming mid-onboarding.

1. **phone** — 10-digit Indian mobile input (+91 prefix). Validates format (`/^[6-9]\d{9}$/`) before sending. Success message is always "Verification code sent" regardless of whether the number is new or existing (account-enumeration safe).
2. **otp** — 6-box OTP entry. Phone number is held in component state and displayed as "Sent to +91 XXXXXXXXXX · Edit"; "Edit" returns to the phone step with the number pre-filled. Error messages: incorrect code → "The code you entered is incorrect. Try again."; expired code → "This code has expired. Request a new code."; rate-limited resend → explicit message, never silent.
3. **profile** — name capture for new accounts only. Validates Unicode letters + spaces, 2–50 chars. On save, calls `refreshSession()` to update the browser JWT with `onboarded: true`, then navigates to `/home`.

**Existing-user auto-redirect:** after OTP verification, the API checks whether the phone belongs to an existing account. If it does, the session is created (single-session policy invalidates any prior session), a brief "✓ Verified — Welcome back, [name]" state is shown, then the user is redirected to Home. No "account already exists" interstitial — successful OTP verification is the login, regardless of which CTA was tapped on the landing page.

**New-account path:** Phone → OTP → profile (name) → Home.

**Resuming mid-onboarding:** if a user closes the app after OTP but before saving their name, returning to `/auth` skips the phone and OTP steps and lands directly on the profile step (session is still valid; middleware allows `/auth` when `!isOnboarded`).

**Landing page CTAs:** both "Log in" and "Get Started" in the nav and hero route to `/auth`. Neither pre-determines login vs. registration — that is decided after OTP verification based solely on whether the phone matches an existing account.

**Old routes:** `/login` and `/verify-otp` are server-side redirects to `/auth` (backward compatibility). `/welcome/name` is also a redirect to `/auth`; name capture now happens inside the `profile` step.

**Role selection (`/welcome/role`)** remains a separate route reached only after name capture for genuinely new accounts. It is not part of the `/auth` route.

## Booking Flows

**Driver side:** Create (date, time, duration, estimate, Razorpay) → Booking Detail → Session → Rating

**Lender side:** Booking Detail → Accept/Reject → Session → Complete → Rating

### Duration picker

Four fixed presets (30 min, 1 h, 1.5 h, 2 h) plus a **Custom** option that reveals separate end-date and end-time pickers. Custom is the only mode that supports overnight bookings (end date ≠ start date); the presets always end on the same calendar day as they start. Minimum duration for any selection is 30 minutes.

All duration options — presets and Custom — are constrained by the same availability window computed for the selected start time (see *Slot conflict rules* below). Presets that would exceed the window are disabled in the picker; Custom's end-time picker is hard-capped at the window boundary.

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

### Slot conflict rules and booking duration constraints

When a driver requests a booking `[start, end)`:

**Platform maximum:** `end` may not exceed `start + PLATFORM_MAX_BOOKING_DURATION_HOURS` (currently 12 h). This is a Phase-2 placeholder constant — when business-rule tuning is promoted to the admin panel, only the getter in `src/lib/bookings/availability.ts` changes.

**Conflict buffer:** Every active booking occupies `[scheduled_start, scheduled_end + BOOKING_BUFFER_MINUTES)` as its *effective blocking window*. `BOOKING_BUFFER_MINUTES = 15` — same Phase-2 promotion path. `pending` counts as blocking to prevent two drivers racing for the same slot before the host has responded.

**Maximum end time formula** (implemented in `src/lib/bookings/availability.ts → computeMaxEndTime()`):

```
maxEnd = min(
  start + PLATFORM_MAX_BOOKING_DURATION_HOURS,
  next_active_booking.scheduled_start − BOOKING_BUFFER_MINUTES
)
```

**Charger operating hours (`availability_slots`):** The `availability_slots` table (`day_of_week`, `start_time`, `end_time`) represents the lender's declared operating hours but is **currently not enforced during booking creation** — the API accepts bookings at any hour. This table is not included in `computeMaxEndTime` and is treated as "no per-day window constraint." Enforcing it is deferred to a future PR.

**Server-side revalidation:** `POST /api/payments/create-order` re-runs the conflict check independently before opening a Razorpay order. The `create_booking_with_payment` DB function (migration 029) re-runs it atomically with a `SELECT … FOR UPDATE` lock, so races that slip through the API layer are caught and rejected with a `SLOT_CONFLICT` exception before any booking row is written.

## Admin

### Full architecture (reference ceiling — not a build target)

The eventual shape of the admin panel covers 12 sections:

1. **Overview** — platform-wide metrics, health indicators
2. **Users** — user listing, search, manual role changes
3. **KYC & Verification** — KYC review queue, approve/reject/request-resubmission
4. **Chargers** — admin view of all listings, force-pause, force-suspend
5. **Bookings & Sessions** — stuck session resolution, manual status overrides
6. **Finance** — payout processing, manual payouts, revenue overview
7. **Disputes & Reports** — driver/lender dispute resolution
8. **Notifications** — platform announcement broadcasting
9. **Configuration** — business-rule knobs (timeouts, commission %, pricing limits, payout delay, search radius)
10. **Analytics** — user growth, booking funnel, revenue trends
11. **Audit Log** — immutable log of all admin actions, filterable by type/admin/date
12. **Administration** — admin role management, RBAC (Super Admin / Ops / KYC Reviewer / Finance / Support Admin)

> **This describes the eventual shape of the admin panel. It is not a sprint plan — build only the slice that satisfies a current, real need, and leave the rest of this structure as documented-but-unbuilt scope.**

### Currently built (Phase 1)

**`/admin/settings`** — single settings page, `is_admin` boolean is the only admin distinction (no role tiers).

- **Operational kill switches** (`app_settings` table): `allow_bookings`, `allow_payments`, `allow_payouts`, `allow_registrations`, `allow_charger_creation` — each defaults true; flipping false returns 503 from the relevant API route.
- **Maintenance mode** (`app_settings` key `platform_mode: 'normal' | 'maintenance'`): middleware redirects all non-admin traffic to `/maintenance`; admins see the app normally.
- **Emergency lockdown** (Vercel Edge Config key `emergency_lockdown: boolean`): middleware checks this first, before Supabase — blocks all non-admin page and API mutation traffic, shows `/emergency` page. Activation requires typing "LOCKDOWN" as confirmation. Each activation/deactivation writes an `audit_log` row.
- **Feature flags** (Vercel Edge Config): `route_planning_enabled`, `ratings_enabled`, `saved_chargers_enabled` (false — not built), `vehicles_enabled` (false — not built). Changes are logged to `audit_log`.

Also built (predates Phase 1): `/admin/kyc`, `/admin/payouts`, `/admin/users`, `/admin/review-queue`.

### Parked, not scheduled (Phase 2)

Business-rule configuration — these stay hardcoded in code, not admin-configurable, until a concrete need arises:

- Booking request timeout (currently 30 min)
- Session grace period (`SESSION_END_REVIEW_GRACE_MINUTES`, currently 30 min)
- No-show warning time (`NOSHOW_WARNING_MINUTES`, currently 25 min)
- No-show cutoff (`NOSHOW_TIMEOUT_MINUTES`, currently 30 min)
- Platform commission % (`PLATFORM_COMMISSION_PERCENT`)
- Min/max charger pricing limits (currently ₹6–₹50/kWh)
- Payout delay / minimum payout threshold
- Default search radius (`DEFAULT_SEARCH_RADIUS_METERS`)

### Parked, not scheduled (Phase 3)

Everything else in the 12-section structure:

- Users admin view, KYC queue UI improvements
- Chargers admin view (force-pause, force-suspend)
- Bookings/Sessions admin view beyond the current review-queue
- Finance admin (manual payout initiation, revenue overview)
- Disputes & Reports
- Notifications admin (platform broadcasting)
- Analytics
- Dedicated Audit Log viewer UI (the `audit_log` table exists and is written to; no browse UI yet)
- Multi-role RBAC (Super Admin / Ops / KYC Reviewer / Finance / Support Admin)

## Help

FAQ → Payments → Hosting → Contact (Contact is folded into this page, not a separate top-level destination)

---

## Client-side Storage Scoping

Any feature that persists state in the browser MUST classify its storage key into one of three buckets before writing. Adding a new key without picking a bucket is a bug.

| Bucket | Scope | Rule | Examples |
|---|---|---|---|
| **Device-level** | Device | Fine as a flat key — not tied to any user | `pwa_install_nudge_v1`, `kirin_intro_done` (sessionStorage) |
| **User-level** | Authenticated user ID | Key MUST use `{base}:{userId}` pattern via `userKey()` in `src/lib/user-storage.ts`. NOT cleared on logout — persists for that user on next login. Legacy flat key MUST be purged on init via `purgeLegacyKey()`. | `kirin:milestones:{userId}`, `lender:new-charger:draft:{userId}` |
| **Session-level** | Auth token lifetime | Must be fully cleared when `supabase.signOut()` is called. Supabase handles its own tokens; OTP and in-progress booking/payment state fall here. App code uses `clearExploreSession()` from `src/lib/user-storage.ts`. | Supabase access/refresh tokens, OTP flow state, `kirin:explore:mode`, `kirin:explore:near_me`, `kirin:explore:along_route` |

**Why this matters:** a flat User-level key written by User A remains visible to User B who logs in on the same device after User A logs out. Route searches include real coordinates and are personal data — this is a privacy bug, not just a UX issue. The `{base}:{userId}` pattern ensures each user reads and writes only their own state.

**On logout:** Supabase `signOut()` clears Session-level tokens. App code must call `clearExploreSession()` (already wired into all four signOut handlers) to clear Explore's sessionStorage keys — sessionStorage survives same-origin navigation. User-level scoped keys are intentionally *not* cleared — the point is that User A's saved state is still there if User A logs back in later. Device-level keys are never touched by login/logout.

**Explore storage scoping note (2026-07):** `chargers_map_state_v2:{userId}` was previously classified as User-level (localStorage, 24h expiry, user-scoped). It has been replaced by the three `kirin:explore:*` sessionStorage keys above. The earlier decision correctly fixed a cross-user privacy bug (unscoped key visible to any user on shared device). This change is a separate product decision: searches represent ephemeral intent, not durable user data, so they should not persist across sessions even for the same user. The scoping mechanism (`{key}:{userId}`) is retired in favour of sessionStorage's natural per-tab isolation, plus explicit `clearExploreSession()` on signOut.

## PWA Update Paths

There are two distinct kinds of PWA update. They use different mechanisms and have different limitations. Conflating them produces "bug reports" that can't be fixed.

### Path 1 — App code and features (service worker lifecycle)

**What updates:** JavaScript bundles, API routes, page content, this service worker (`/sw.js`).

**How it works:**
1. The browser detects a byte change in `/sw.js` on the next navigation (or after ~24 h if the app is left open). `/sw.js` is served by `src/app/api/sw/route.ts` (via a `beforeFiles` rewrite in `next.config.js`) and injects `VERCEL_DEPLOYMENT_ID` as a top-line comment, guaranteeing a byte change on every deploy.
2. The new service worker downloads and enters the `waiting` state.
3. `UpdateBanner` (`src/components/ui/UpdateBanner.tsx`) surfaces as a **global floating card at the root layout** (`src/app/layout.tsx`) — it is a sibling of `<BottomNav />`, not scoped to any individual screen. It appears on Home, Explore, Activity, Profile, and all other authenticated screens equally.
4. **"Update"** → sends `SKIP_WAITING` to the waiting SW → SW activates → page reloads to pick up new JS bundles.
5. **"Later"** → banner is dismissed for the current session only (React state, no localStorage). The banner reappears on the next fresh app open if the update is still pending.

**Positioning:** above BottomNav on mobile/PWA (`z-50`, `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`). On desktop (lg+) the bottom nav is hidden, so the banner sits bottom-right at `bottom-4 right-4 max-w-sm`.

**What never happens:** an automatic reload without the user tapping "Update." A surprise reload mid-booking, mid-payment, or mid-charging-session-confirmation is explicitly prevented by never calling `skipWaiting()` automatically in `sw.js`.

**Independence from other PWA systems:** `UpdateBanner`, `PwaInstallCard`, and the Home nudge cascade are three completely independent systems with no shared code paths, no shared conditions, and no shared rendering logic. `UpdateBanner` only cares about `reg.waiting` (a new SW version exists). `PwaInstallCard` only cares about `beforeinstallprompt` / iOS Safari (the app is not yet installed). The Home nudge cascade (`src/app/home/page.tsx`) manages the install-card display timing within that screen. None of these three systems know about each other.

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
