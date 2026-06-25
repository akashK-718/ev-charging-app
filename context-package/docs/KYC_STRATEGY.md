# KYC Strategy

How identity verification works on the platform — who needs it, when, and how.

## Principles

1. **Lenders need KYC.** They receive money. Identity verification is mandatory for Razorpay Route payouts (legally required) and platform trust.
2. **Drivers don't need KYC at signup.** They're paying money. Phone OTP verification is enough trust for the spending side. Adding friction here hurts conversion without proportional benefit.
3. **Phased approach: commercial API first, DigiLocker direct later.** Ship in Module 5 with a commercial KYC provider; migrate to DigiLocker after company incorporation + accreditation (Module 8+).

## What requires KYC

| User type | Phone OTP | Aadhaar KYC | PAN | Bank/UPI |
|-----------|-----------|-------------|-----|----------|
| Driver (sign up) | Required | Not required | Not required | Not required |
| Driver (booking) | Required | Not required | Not required | Not required |
| Lender (sign up) | Required | Not required (yet) | Not required (yet) | Not required (yet) |
| Lender (list first charger) | Required | **Required** | **Required** | **Required** |

The KYC gate happens when a lender goes to list their first charger — not at signup. This way the signup flow stays light, but no charger goes live without verified identity behind it.

## Why this asymmetry

**Lender risk:** A fake/anonymous lender could list a fake charger, take deposits, disappear. Real money flows to them. Identity verification is essential.

**Driver risk:** A fake driver would pay you and the lender. The downside is limited (you'd lose a session's worth of platform fee if disputed). Friction at driver signup costs more than it protects.

If, post-launch, real disputes emerge where drivers are abusing the system without consequences, revisit. Until then, drivers stay phone-only.

## Implementation plan

### Phase 1 — Module 5 (commercial API)

When real payments and payouts come online, integrate a commercial KYC provider:

**Provider candidates (research at Module 5 start):**
- **IDfy** — popular with Indian fintechs, ₹20-30/verification
- **HyperVerge** — strong face match, ₹25-40/verification
- **Signzy** — broad coverage, ₹15-30/verification
- **Bureau ID** — newer, competitive pricing

All offer Aadhaar-based eKYC with OTP verification, plus optional face match and PAN verification.

**Cost at MVP scale:** ~₹2,500-4,000/month for 100 lender onboardings.

**What gets verified:**
1. Aadhaar number + OTP (UIDAI verification)
2. PAN number (for tax purposes)
3. Selfie + face match against Aadhaar photo (liveness check)
4. Bank account or UPI ID (for Razorpay Route payouts)

### Phase 2 — Module 8+ (DigiLocker direct)

After company incorporation:

1. Apply for DigiLocker Requestor accreditation (30-60 day wait)
2. Once approved, integrate DigiLocker API directly
3. Migrate existing lenders gradually (no forced re-verification)

**Benefits over commercial API:**
- Cryptographically signed documents (zero forgery risk)
- Cost drops from ₹25/verification to near-zero
- Government-backed, higher user trust
- Future-proof as India's digital identity infrastructure evolves

## UX flow (lender KYC, Module 5)

```
Phone OTP signup → role selection (lender)
        ↓
Land on lender dashboard
        ↓
Tap "Add your first charger"
        ↓
Modal/page: "Before you can list, we need to verify your identity (5 minutes)"
        ↓
Step 1: Enter Aadhaar number → receive OTP from UIDAI → enter OTP
Step 2: Selfie capture for face match
Step 3: Enter PAN number
Step 4: Add bank account / UPI ID for payouts
        ↓
"Verifying..." (~30 seconds)
        ↓
Verified → proceed to charger registration form
```

## Compliance requirements

### Aadhaar handling

- **Mask in display:** Show only last 4 digits anywhere (`XXXX XXXX 1234`). Never display the full number after verification.
- **Use Virtual ID (VID) where possible:** Avoid storing the actual Aadhaar number long-term if VID flow is available from the KYC provider.
- **Encryption at rest:** All KYC documents encrypted in Supabase Storage.
- **Explicit consent:** Clear consent screen before initiating any verification — "I authorize [BrandName] to verify my identity via [provider] for the purpose of using this platform."

### Data retention

Per current Indian regulations:
- KYC data retained 5 years post-account-closure
- User can request data export anytime (DPDP Act 2023)
- User can request deletion after the regulatory retention period

### Audit trail

Every KYC verification logged with:
- User ID
- Provider used
- Timestamp
- Verification result (success/failure/manual review)
- Provider's reference ID

Stored in `audit_log` table per existing schema convention.

## Open decisions (revisit at Module 5)

- **Which commercial KYC provider?** Decide based on Module 5 research — quality, pricing, support, integration ease.
- **Manual review fallback?** What happens when automatic verification fails? Initially, contact lender via WhatsApp for manual document submission.
- **Re-verification policy?** Currently planned: verify once, valid indefinitely. May change if regulations evolve.
- **Driver KYC trigger?** Currently: never required. If disputes emerge in Module 6 beta, consider triggering KYC for drivers with multiple disputes.

## What's NOT included in this strategy

Things explicitly out of scope:

- **Vehicle verification.** We don't verify a driver actually owns an EV. Self-declared.
- **Property ownership verification.** Lenders self-attest they have rights to share the charger. Not verified.
- **Charger hardware certification.** Lenders self-declare charger specs. Not independently verified (MVP scope).
- **Address verification.** Aadhaar provides address; we don't separately verify residence.

These can be added later if specific abuse patterns emerge.
