# User Flows

How real users actually move through the product, from first install to repeat usage. Reference this when building UI or making UX decisions.

## Lender first-time flow

**Goal:** A homeowner with a parked EV charger lists it on the platform and waits for bookings.

1. **Discovery** — Hears about the platform from friend/WhatsApp/social media. Visits URL on phone.
2. **Landing page** — Sees value prop: "Earn ₹3,000–5,000/month from your idle home charger." Two CTAs: "Find a charger" and "I have a charger to share." Taps the lender one.
3. **Phone OTP signup** — Enters 10-digit phone, receives OTP, enters code, account created.
4. **Role selection** — Picks "I have a charger" or "Both."
5. **Welcome screen** — Brief: "Let's list your charger. Takes 3 minutes."
6. **Multi-step registration form:**
   - Step 1: Charger basics — type (3.3/7/22 kW), connector (Type 2, CCS2, etc.)
   - Step 2: Price per kWh — slider with platform-suggested range, also shows "you'll earn approximately ₹X per session"
   - Step 3: Location — address autocomplete via Google Places, then map pin drop for precision
   - Step 4: Photos — min 1, max 5. Cloudinary unsigned upload from camera or gallery.
   - Step 5: Availability — pick days of week + time range (e.g., Mon–Fri 8am–10pm)
   - Step 6: Access instructions — free text ("Ring bell at green gate")
   - Step 7: Review + submit
7. **Listed state** — Sees their charger on a dashboard. Status: "Active, waiting for bookings."
8. **First booking request** — Push notification: "Akash has requested to book your charger at 7 PM today." 30-minute accept window.
9. **Accept** — Taps Accept. Driver gets notification with confirmation code.
10. **Session day** — Driver arrives, shows confirmation code, plugs in.
11. **Lender confirms session start** — In-app button: "Charging started."
12. **Session ends** — Driver enters kWh delivered. Lender confirms.
13. **Payout** — 24 hours later: "₹128 has been transferred to your account."
14. **Rating** — Both rate each other (1-5 stars).

### What can go wrong (lender side)
- **No bookings ever come.** Need clarity on listing visibility/quality in dashboard.
- **Driver no-show.** Lender marks no-show in app; gets 50% as compensation.
- **Charger broken at session start.** Lender cancels with reason; driver gets full refund.
- **Dispute over kWh.** Driver claims 5 kWh, lender claims 10 kWh. Both can raise dispute, admin reviews.

---

## Driver first-time flow

**Goal:** An EV owner without home charging finds and uses a nearby charger.

1. **Discovery** — Sees app via friend / WhatsApp / search.
2. **Landing page** — Same as above. Taps "Find a charger near me."
3. **Phone OTP signup** — Same.
4. **Role selection** — Picks "Driver" or "Both."
5. **Vehicle setup** — Picks EV model from a dropdown (or skips). System uses this to pre-select connector type for filters.
6. **Permission to share location** — App asks for GPS access. If denied, user enters location manually.
7. **Map view** — Sees pins of nearby chargers. Color-coded: green = available, grey = busy. Each pin shows price.
8. **Filter** — Picks "Type 2 only" to match their car. Map updates.
9. **Tap a pin** — Bottom sheet appears with photo, price, distance, rating.
10. **Tap "View details"** — Full charger page. Photos carousel, specs, host name + rating, reviews, availability calendar.
11. **Tap "Book a slot"** — Slot picker. Shows available time windows (within lender's availability, not conflicting with other bookings). Picks 7 PM today, 1 hour duration.
12. **Estimated cost** — Driver enters approximate kWh (10). App shows ₹140 (10 × ₹14).
13. **Confirm booking** — Booking goes to `pending`. Lender notified.
14. **Wait for confirmation** — Driver sees "Waiting for host to accept. Hosts usually respond within 10 min."
15. **Booking confirmed** — Push notification + confirmation code (e.g., `X-7K2Q`). Driver sees the code prominently in the booking page.
16. **Travel to charger** — Charger detail visible with directions link (opens Google Maps).
17. **Arrival** — Driver taps "I'm here" in app. Lender notified.
18. **Lender confirms start** — Driver sees session counter start.
19. **Active session** — Live UI showing kWh delivered (estimated), running cost, time elapsed.
20. **Session ends** — Driver taps "End session." Enters actual kWh delivered.
21. **Lender confirms** — Final cost calculated.
22. **Payment processed** — Already held via Razorpay; now released to lender on T+24h.
23. **Rate experience** — 1-5 stars + optional comment.

### What can go wrong (driver side)
- **Booking not accepted in 30 min** — Auto-cancelled with full refund. Push notification: "Booking expired. Try another charger."
- **Charger doesn't work** — Driver reports issue via in-app button. Refund triggered.
- **Driver runs late** — Can extend booking if no one else has the next slot. Otherwise, partial usage.
- **Lender doesn't show up to confirm session start** — After 15 min, driver can mark "Host unreachable." Booking cancelled, full refund.

---

## Lender returning flow

**Goal:** A lender who's been on the platform for a month manages multiple chargers and tracks earnings.

1. **Open app** — Sees lender dashboard.
2. **Earnings hero** — "₹8,420 earned this month" with comparison to last month.
3. **Charger list** — All their chargers with status (active / paused / in use).
4. **Recent activity** — Last 10 sessions with driver name (anonymized), kWh, amount.
5. **Pending payouts** — Sessions completed but not yet released (within 24h hold).
6. **Pause a charger** — One-tap toggle. Pauses bookings temporarily (e.g., they're on vacation).
7. **Edit a charger** — Update price, photos, availability, instructions.
8. **Add another charger** — Same flow as initial registration.

### Key UX insight
Returning lenders care about: **earnings clarity** and **operational simplicity** (pause, edit, add). The dashboard should privilege these.

---

## Driver returning flow

**Goal:** A driver who's used the app 5 times finds chargers faster.

1. **Open app** — Map opens immediately at current location.
2. **Favorite chargers** — Quick chips: "Recently used" → 3 chargers they've used before.
3. **Quick rebook** — Tap a favorite → directly to booking flow with smart defaults (last-used time, last-used kWh).
4. **Booking history** — `/bookings` tab shows past + upcoming. Tap any past booking to rebook the same slot.

### Key UX insight
Returning drivers should be able to book in 3 taps from app open. Reduce friction aggressively here.

---

## Admin flow (Module 6+)

**Goal:** Akash (or whoever is on admin duty) resolves a dispute.

1. **Login as admin** — Same phone OTP, but role check redirects to `/admin`.
2. **Admin dashboard** — Metrics: sessions today, GMV, active users, pending disputes.
3. **Disputes queue** — List of open disputes, sorted by age.
4. **Open dispute detail** — See full booking history, both parties' submissions, payment status, communication log (if any).
5. **Resolve** — Three options: refund driver fully, release to lender, partial refund (specify amount).
6. **Notify both parties** — Push + email automatically generated explaining outcome.

### Key UX insight
Admin tools optimize for **scanning many items fast**. Information density matters more than visual polish.

---

## Cross-cutting flows

### Onboarding new user via referral (post-launch)

- Existing user shares referral link
- New user signs up via link
- Both get ₹100 credit toward their first session (when implemented)

### Reporting an issue mid-session

Both driver and lender have a "Report issue" button visible during `active` sessions:

1. Select category: Safety / Charger broken / Wrong kWh / Other
2. Optional photo upload
3. Optional text description
4. Submit → booking status: `disputed`, payout held
5. In-app message: "Issue reported. Our team will review within 24 hours."

### Cancellation by driver

From a `pending` or `confirmed` booking, "Cancel booking" button:

1. Confirmation dialog explaining the policy:
   - "Cancel >60 min before slot: full refund"
   - "Cancel <60 min before slot: no refund"
2. If still in window for full refund: refund triggered immediately
3. Booking status: `cancelled`. Lender notified.

### Cancellation by lender

From any non-terminal booking, "Cancel" button for the lender:

1. Confirmation dialog explaining: "Cancelling will give the driver a full refund and may affect your account standing if done frequently."
2. Required reason field
3. Booking status: `cancelled`. Driver notified + refunded. Lender's cancellation rate updated (visible internally).

---

## Empty states (designed deliberately, not afterthoughts)

| Screen | Empty state |
|--------|-------------|
| Map with no chargers nearby | "No chargers within 5 km. Try widening your search or being the first to list one!" |
| Driver bookings list (new user) | "You haven't booked any charging sessions yet. Find a charger near you →" |
| Lender dashboard (no chargers listed) | "You haven't listed any chargers yet. Add your first one in 3 minutes →" |
| Lender dashboard (listed but no bookings) | "Your charger is live and waiting for its first booking. Most chargers get their first booking within 7 days." |
| Reviews on a new charger | "No reviews yet — be the first!" |

Empty states are conversion moments. Treat them seriously.
