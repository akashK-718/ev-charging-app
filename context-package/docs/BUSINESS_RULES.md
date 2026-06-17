# Business Rules

The non-technical rules that shape the product. Every developer working on the codebase needs to know these.

## Commission

- **Platform takes 15%** of every completed session's gross amount
- Lender receives the remaining 85%
- Razorpay gateway fee (~2%) is absorbed by the platform (not passed through)
- Commission applies only to **completed** sessions, not cancelled ones

### Example
- Driver pays ₹150
- Platform fee = ₹22.50 (15%)
- Lender receives ₹127.50
- Razorpay charges platform ~₹3 (2% of ₹150)
- Platform net: ₹22.50 - ₹3 = ₹19.50 per session

## Pricing

- **Lenders set their own price per kWh** (rupees, decimal allowed e.g., ₹14.50)
- Platform suggests a price range during registration based on charger type:
  - 3.3 kW AC: ₹10-15/kWh
  - 7 kW AC: ₹12-18/kWh
  - 22 kW AC: ₹15-22/kWh
  - DC Fast: ₹18-28/kWh
- Hard minimum: ₹6/kWh (below typical electricity cost — would be loss-making)
- Hard maximum: ₹50/kWh (prevents predatory pricing)

## Booking timing

- **Lender response window:** 30 minutes from booking request to accept/reject
  - After 30 minutes with no response: auto-cancel with full refund
- **Driver "I'm here" window:** 15 minutes from scheduled start
  - After 15 minutes with no arrival, lender can mark no-show
- **Booking lookahead:** Drivers can book up to 7 days in advance
- **Session duration:** Drivers specify estimated time, lender confirms actual end
- **Maximum session length:** 8 hours (sanity check)

## Cancellation policy

| Who cancels | When | Refund | Lender compensation |
|-------------|------|--------|---------------------|
| Driver | More than 60 min before slot | 100% | None |
| Driver | Less than 60 min before slot | 0% | Lender keeps 100% as compensation |
| Driver | No-show (lender marks) | 0% | Lender keeps 50% (50% goes to driver as goodwill) |
| Lender | Any time | 100% to driver | None, plus strike on account |

### Why these policies
- **>60 min driver cancel = full refund:** Encourages plans changes without penalty
- **<60 min driver cancel = no refund:** Lender lost the opportunity to accept another booking
- **Lender cancel = always 100%:** Drivers must be able to trust their bookings will happen
- **Lender strikes:** 3 cancellations in 30 days → temporary pause, manual review

## Payout policy

- Payouts to lenders held for **24 hours** after session completion
- Reason: window for disputes to be raised
- After 24 hours: automatic transfer via Razorpay Route to lender's linked UPI/bank
- Pending payouts visible in lender dashboard

## Dispute policy

- **Either party can raise a dispute** within 24 hours of session completion (or any time during `active` state)
- Booking moves to `disputed` status; payout is held indefinitely until resolved
- Resolution options (admin only):
  - Full refund to driver
  - Release full payout to lender
  - Partial split (specified amounts)
- Resolution must be communicated to both parties via push + email
- Expected response time: **24 hours during weekdays, 48 hours over weekends**

### Common dispute types and default rulings

| Type | Default ruling |
|------|----------------|
| Charger didn't work (lender confirms) | Full refund to driver |
| kWh disagreement (no IoT to verify) | Split the difference (40/60 in driver's favor) |
| Driver arrived but lender absent | Full refund + small goodwill credit |
| Driver damaged charger | Manual investigation, may require photos |
| Safety issue | Take seriously, may suspend lender pending review |

## KYC requirements

### Drivers
- Phone number (verified via OTP) — only requirement
- Email collected but optional

### Lenders
- Phone number (verified via OTP)
- Aadhaar number + photo (for Razorpay payout setup, mandatory)
- Bank account or UPI ID (for receiving payouts)
- Property ownership/permission **not** verified (their responsibility legally)

### Why this difference
- Drivers are paying *us*, low fraud risk
- Lenders are receiving money, must comply with KYC for Razorpay Route

## Rating thresholds

- Rating scale: 1-5 stars, integer only
- Both parties rate each other after each session
- Cached `avg_rating` updated via DB trigger
- **Threshold for auto-pause:**
  - Chargers below 3.5 avg with 10+ reviews → auto-pause + admin alert
  - Lenders below 3.5 avg with 10+ reviews → no auto action, but flagged for review
  - Drivers below 3.0 avg with 5+ reviews → no auto action, lenders see warning before accepting

## Geographic scope

- **Phase 1:** Delhi NCR only
- Definitions of "Delhi NCR" for now: Delhi + Gurgaon + Noida + Ghaziabad + Faridabad
- Charger registrations outside this area are accepted but de-prioritized
- City 2 expansion only after Phase 1 hits **500+ sessions/month consistently**

## Legal framing

### Electricity resale
- India's Electricity Act 2003 has restrictions on reselling electricity without a license
- We frame transactions as **"access fee for use of private property and equipment"** rather than "sale of electricity"
- Terms & Conditions explicitly state this framing
- Lawyer review recommended before public launch
- This is the **single biggest legal risk** of the entire product

### Data residency
- All user data stored on Supabase Mumbai region (Indian servers)
- Aadhaar and PAN details stored encrypted via Supabase Storage
- Data export / deletion available on user request (DPDP Act compliance)

### Liability
- T&Cs to include limitation of liability clauses
- Platform is not responsible for:
  - Vehicle damage during charging
  - Property damage at lender's premises
  - Personal injury
  - Theft
- Lenders responsible for ensuring their charger is in safe working condition
- Drivers responsible for ensuring their vehicle is compatible

### Tax
- Platform charges 18% GST on the platform fee (not the gross amount)
- Lenders responsible for their own tax declarations
- Annual TDS deductions if a lender's earnings exceed thresholds (₹2 lakh+/year via the platform) — handled by Razorpay

## Money handling rules

These are repeated from other docs because they're critical:

1. **Always store money as integers in paise.** Never use floats.
2. **Razorpay works in paise.** Match this convention.
3. `gross_amount = platform_fee + lender_payout` — always, no rounding errors
4. Conversions only at display boundaries via `paiseToRupees` / `formatINR`
5. Lender prices set in rupees (UX), stored in paise internally

## What we don't do (deliberate exclusions)

These come up; we don't do them:

- **Negotiation between drivers and lenders.** Price is fixed by lender.
- **Subscription plans for drivers.** Per-session pricing only.
- **Tipping.** Adds complexity without clear benefit.
- **In-app messaging.** Use phone calls; we don't want to be responsible for messaging content.
- **Reviews of platform itself within app.** Direct to Play Store reviews.
- **Group bookings or shared sessions.** One driver per booking.
- **Recurring/scheduled bookings.** Each booking is individual.

## Privacy commitments

- We don't sell user data
- We don't track location outside the app
- We don't share user info between drivers and lenders beyond first name, rating, and necessary contact info
- Phone numbers are masked when shown to the other party (e.g., "987XXXXX10")
- Users can request data export or account deletion at any time
- We comply with DPDP Act 2023
