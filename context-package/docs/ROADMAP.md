# Roadmap — 7 Modules

Total timeline: ~15 weeks (3.5 months) of part-time work for a 3-person team.

## Approach

Each module produces something **a real person could actually use** end-to-end. No "build silently for 3 months then unveil." Beta is PWA-only with friends and family; Play Store launch comes last.

## Three rules (non-negotiable)

1. **Don't move backwards** — if a later module breaks an earlier one, the later one isn't done
2. **Cap each module at +25% time** — if budgeted 2 weeks and you're at 2.5, ship what you have
3. **Demo at end of every module** — all three on a call, share screen, run through it together

## Ownership

| Person | Modules |
|--------|---------|
| Akash | 1, 3, 5 (lead) — booking state machine, auth |
| Hitesh | 1, 2, 6 (polish) — map, discovery, charger detail |
| Rohan | 5, 6 — payments, admin dashboard |
| All three | 7 — launch prep, store assets |

---

## Module 1 — Foundation

**Weeks 1–2**

### Scope
- Next.js + Supabase + Vercel set up ✅ (scaffold done)
- GitHub repo live, auto-deploy from push to `main` ✅
- Phone OTP login via MSG91
- Session management via Supabase Auth
- Role selection on first signup (driver / lender / both)
- Lender registration form (multi-step): charger type, connector, price, address with autocomplete, manual pin drop, photos, availability windows
- Basic list view of all active chargers (no map yet)
- Database migrations: `users`, `chargers`, `availability_slots`, `bookings`, `payments`, `reviews`, `disputes`
- Auth middleware protecting `/lender/*` and `/admin/*`
- Cloudinary unsigned image uploads
- Rate limiting on OTP endpoint (3 per phone per hour)
- Logging via `pino`

### Out of scope (later modules)
- Map view — Module 2
- Booking flow — Module 3
- Real payments — Module 5
- Admin dashboard — Module 6

### Done when
All three team members can sign up via phone OTP, list a fake charger, and see each other's listings in a plain list view.

### Risks
- MSG91 DLT registration paperwork — start early, takes 1-2 days
- Supabase Auth + custom phone OTP flow — may need to use Supabase signInWithOtp with MSG91 webhook integration

---

## Module 2 — Discovery

**Weeks 3–4**

### Scope
- Leaflet + OpenStreetMap map with charger pins
- "Find near me" GPS button → centers map on user
- PostGIS `ST_DWithin` query for chargers within 5km
- Filter bar: connector type, max price, min rating
- Charger detail page (`/chargers/[id]`) — photos, specs, host name, address, instructions
- Bottom sheet on pin tap (summary card)
- List view toggle alongside map
- Google Places API for lender's address autocomplete (1 call per registration)

### Out of scope
- Booking — Module 3
- Reviews on charger detail — Module 5
- Availability calendar display — Module 3

### Done when
A driver can open the app, see chargers on a map centered on their location, tap one, see its details. Feels like a real product even though nothing transacts yet.

### Risks
- Leaflet SSR issues with Next.js — use dynamic import with `ssr: false`
- Mobile GPS permissions UX

---

## Module 3 — Booking (manual UPI-based)

**Weeks 5–6**

### Scope
- Availability slot display on charger detail page
- Booking creation flow: pick slot, enter estimated kWh, review, confirm
- The full state machine: `pending → confirmed → active → completed | cancelled | disputed`
- Lender accepts/rejects within 30 min (auto-cancel via Vercel cron)
- 8-character confirmation code generation
- Driver "I'm here" button → moves to `active`
- Manual kWh entry at session end
- Lender confirmation step
- Cancellation flow with policy (>60 min = refund, <60 min = no refund)
- Booking history page (`/bookings`)
- Single booking detail page (`/bookings/[id]`)
- Double-booking prevention (SELECT FOR UPDATE in transaction)

### Critical shortcut
**Payment happens OUTSIDE the app via UPI.** Driver and lender exchange UPI handles, settle directly. The app tracks who owes what but doesn't move money yet.

This is the most important design choice in the whole roadmap. It lets us validate the entire booking flow end-to-end without the highest-risk integration. Razorpay comes in Module 5.

### Done when
Akash books a slot at Hitesh's charger, pays him directly via UPI, and the app correctly tracks the session end-to-end with proper state transitions.

### Risks
- State machine edge cases (lender doesn't show up, driver doesn't show up, charger broken mid-session)
- Race conditions in concurrent bookings
- Notification reliability for state transitions

---

## Module 4 — Internal testing

**Week 7 (single week, no new features)**

### Scope
**NOTHING NEW.** The whole point is to stop building and start using.

- All three install the PWA on their phones
- Daily real-feeling bookings between themselves
- Shared Google Sheet of bugs
- Fix only **critical** bugs (blocks usage). Defer everything else.
- Pair-debugging sessions over screen share

### Done when
All three of you can run a complete booking on your phone without confusion. Critical bugs from real usage are fixed.

### Why this exists
Most teams skip this. Most teams regret it. Real usage reveals what testing in isolation can't.

---

## Module 5 — Real payments + ratings

**Weeks 8–9**

### Scope
- Razorpay checkout integration on booking confirmation
- Server-side webhook handler with signature verification
- Razorpay Route for split payouts (driver pays gross, platform keeps fee, lender gets remainder)
- Hold-then-release pattern: payment held until session completes, payout triggered 24h later
- Refund flow per cancellation policy
- Post-session 1-5 star ratings (driver rates lender, lender rates driver)
- Comment field (optional)
- Trigger to recompute `avg_rating` after each review
- Auto-pause chargers below 3.5 avg after 10+ reviews
- Lender earnings dashboard (`/lender/dashboard`)
- Pending payout visibility for lenders
- Lender KYC via commercial API (IDfy, HyperVerge, or Signzy — decided at module start)
  - Aadhaar OTP verification
  - PAN collection
  - Selfie + face match
  - Bank account / UPI ID for payouts
  - See `docs/KYC_STRATEGY.md` for full details
- DB audit trail on bookings and payments
- Circuit breaker around Razorpay and MSG91 calls

### Out of scope
- Push notifications — Module 6
- Formal dispute UI — Module 6 (resolve manually for now)
- Admin dashboard — Module 6 (use Supabase table view directly for now)

### Done when
A booking flows request → payment → session → lender payout entirely through the app. You can run real transactions, even if rough around the edges.

### Risks (highest-risk module)
- Webhook handling correctness — every state transition must be idempotent
- Money invariants — `gross = platform_fee + lender_payout` must hold always
- Edge cases: partial payments, double webhook delivery, race between client callback and webhook

---

## Module 6 — Friends & family beta

**Weeks 10–13 (4 weeks)**

### Scope
- Push notifications via Firebase Cloud Messaging
- Service worker for PWA push
- Notification triggers: new booking request, booking confirmed, driver arrived, session complete, payout sent
- SMS fallback (MSG91) for critical events only
- Basic admin dashboard (`/admin/*`): users, chargers, bookings, payments, KYC queue, disputes
- Manual dispute resolution UI
- PWA install prompt + iOS install instructions modal
- Web app manifest, icons, splash screen
- `next-pwa` package for service worker
- Sentry error tracking
- Feedback form on every page
- Reconciliation cron: compare Razorpay state to DB state, flag mismatches
- Rate limiting on more endpoints

### Beta process
- Onboard 15–25 trusted people manually
- Personal WhatsApp call walkthrough with each lender
- Dedicated beta WhatsApp group for feedback
- Ship critical fixes same day
- Track which features get used, which don't

### Done when
50+ real sessions completed by people other than the three team members. App rating from testers: 4+ stars informally.

---

## Module 7 — Capacitor wrap + Play Store launch

**Weeks 14–15**

### Scope
- Capacitor installed and configured in existing Next.js project
- `npx cap add android` and project generation
- Native push notifications working on Android (FCM)
- App icon, splash screen, store assets
- Privacy policy and Terms & Conditions documents
- Play Store listing: description, screenshots (3-5), feature graphic, content rating
- Submission to Play Store (₹1,750 one-time developer fee)
- Address any Play Store review feedback
- Keep PWA URL live as fallback

### Out of scope
- iOS App Store — deferred to v1.1 (Apple's review adds 2+ weeks)
- Smart charger IoT — deferred indefinitely until product-market fit
- B2B accounts — post-launch

### Done when
App is live on Play Store. First strangers can find it via search and install. ~15 weeks from project start.

---

## Post-launch roadmap

After v1.0:

- **Month 4-5:** Capacitor iOS wrap → App Store submission
- **Month 5-6:** City 2 expansion (only after City 1 hits 500+ sessions/month consistently)
- **Month 6-8:** DigiLocker Requestor accreditation + migration from commercial KYC API
- **Month 6+:** Smart charger IoT integration (OCPP protocol)
- **Month 6+:** B2B / fleet accounts with monthly billing
- **Month 6+:** SaaS subscriptions for high-volume lenders
- **Month 6+:** Hardware partnerships (Tata Power, Exicom, Wallbox)
- **Month 8+:** Referral / loyalty program
- **Month 9+:** Marketing campaigns, paid acquisition

---

## What's intentionally NEVER planned

These come up periodically; explicitly out of scope until they're justified by real product needs:

- Chat between users (use phone/WhatsApp)
- Video calls
- Social features (followers, feed)
- Gamification (badges, leveling)
- Cryptocurrency / Web3
- AI chatbot for support (manual support is fine at MVP scale)
- White-label / multi-tenancy
- International expansion
- Anything else that sounds cool but doesn't help drivers find chargers faster or lenders earn more
