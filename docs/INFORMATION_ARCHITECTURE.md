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

Home is built from priority buckets, evaluated top to bottom. These are semantic priorities, not fixed visual sections; a bucket that has nothing to show simply does not render, including its header. Never show a bucket with a zero-state (no "Today's Bookings: 0").

```
Greeting                              always
P0  Attention        0..N cards       the only bucket that stacks
P1  Continue         0..1 card
P2  Snapshot          0..2 cards
P3  Workspace         0..1 card
P4  Suggestions       0..1 card
P5  Learn             0..1 card
```

**Max one card per bucket, except P0.** If multiple candidates qualify for Continue, Snapshot, Workspace, Suggestions, or Learn, pick the single most valuable one. Never let a bucket turn into a to-do list.

**P0 is the sole exception** and can show multiple cards at once (e.g. "booking starts in 12 minutes" and "charger offline" both shown together), because both are genuinely blocking and hiding one to show the other risks the user missing something.

**P0 internal ordering**, when multiple P0 cards exist, sort in this exact order:

1. Time-sensitive (booking starts in X minutes)
2. Session-related (driver waiting at charger)
3. Account-blocking (KYC rejected)
4. Financial (payout failed)
5. Everything else informational

### Card source classes

Used for P4 Suggestions and P5 Learn specifically. This deliberately avoids building any kind of AI/ML recommendation system for v1.

- **Class A, State Cards** — generated directly from deterministic database state (booking starts soon, resume draft, KYC rejected, charger offline, payout processed). These primarily populate P0 and P1.
- **Class B, Rule Cards** — simple boolean conditions, no ML. Example: `if charger.photos < 5` → "Listings with 5+ photos receive more bookings." `if vehicle_count == 0` → "Add your first vehicle." `if no_booking_30_days` → "Lowering your price may increase bookings." These populate P4 Suggestions.
- **Class C, Evergreen Tips** — lowest priority, static rotating content from a simple pool (e.g. a `tips.ts` file), used only when nothing better exists. "Charging during off-peak hours can be cheaper." "You can pause your charger any time." These populate P5 Learn.

### KYC cards

KYC gets its own four-state card type rather than being a generic notification. Lives in P0 Attention when actionable.

- **Not Started** — "Complete verification, required before hosting" → P0 for lenders (blocking), Continue for drivers (not blocking)
- **Pending** — "Verification under review, submitted [date], we'll notify you soon." Informational, does not need to be P0. Lives in P2 Snapshot.
- **Approved** — no card on Home at all. Just a small badge in Profile. Do not spend Home space on a success state.
- **Rejected** — "Verification rejected, [specific reason, e.g. PAN image is blurry]" → Resubmit. This is actionable, so it stays in P0, not P2.

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

1. Which bucket does it belong to: Attention, Continue, Snapshot, Workspace, Suggestion, or Learn?
2. Does it outrank the card(s) already in that bucket?
3. Does the bucket already have its maximum card count?

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
- **Finance** — earnings, payouts
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

## Admin

Dashboard → KYC → Payouts → Users → Disputes

## Help

FAQ → Payments → Hosting → Contact (Contact is folded into this page, not a separate top-level destination)

---

## Notes for implementation

- Every screen must reference the current `/design` foundation for visual tokens (colors, fonts, radius, shadows) and `DESIGN_EV.md` for content/interaction guardrails (no em dashes, no default pill-everything, no decorative animation, varied section header treatments).
- Build mobile/PWA first, but every screen must also work correctly at desktop width.
- This document reflects the current locked architecture. If a build reveals a real conflict with what's written here, flag it rather than silently deviating.
