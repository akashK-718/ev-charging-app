# User naming model

The platform uses two separate name fields per user:

- **`name` (display name):** User-provided at signup. Editable. Used in all UI
  contexts where users see each other (profile, lender bookings, dashboards,
  reviews). Can be a nickname or first name.

- **`legal_name` (from KYC):** Captured during KYC review, set by admin or
  automated KYC provider. Immutable to user. Must match Aadhaar/PAN. Used
  for payouts, tax records, receipts, audit logs.

## Why two fields

- **Display name** is what users want to be called. Nicknames are common in India.
- **Legal name** is what regulations require. Payouts to bank accounts must match
  the account holder's legal name. Tax filings need legal names.

## Handling mismatch

A user named "Akash" with legal_name "Akash Kumar Singh" is normal. Admin reviews
KYC submissions side-by-side. Significant mismatches (different first names,
different gender, etc.) are flagged for manual review but don't auto-reject.

## Current implementation status

- ✅ `name` (display) field collected at signup, editable in Profile
- ⏳ `legal_name` field — added in a future PR with KYC integration (Module 5)

## Validation rules (both fields)

- 2–50 characters
- Letters and spaces only
- Unicode-safe (supports Indian language characters, e.g. "अकाश")
- Regex: `/^[\p{L}\s]{2,50}$/u`

## Where display name is used

| Location | Usage |
|---|---|
| `/profile` | Shown with edit pencil; editable inline |
| `/lender/dashboard` | "Hi, [FirstName]" greeting |
| `/lender/bookings` | Driver name (initials until accepted, full after) |
| `/lender/bookings/[id]` | Driver name in booking detail |
| `/profile/verify` | Read-only display in Step 5 review with KYC note |

## Backfill for existing users

Users created before name collection was added have `users.name = NULL`.
The middleware detects this via `user.user_metadata.name` and redirects to
`/profile/name?next=<original-path>`. Once submitted, they continue normally.

## Fraud prevention (future, Module 5+)

- Phone uniqueness (already enforced via OTP)
- PAN uniqueness constraint (one PAN = one verified user)
- Aadhaar uniqueness (last 4 + verification ref ID)
- Bank account uniqueness for payouts
- Face match via KYC provider (selfie vs Aadhaar photo)
- Auto-flag significant name mismatches in admin review
