# Admin journey

## Review a host

1. Sign in with a designated admin account and open **Admin → KYC**.
2. Open the pending submission. Review the Aadhaar image and last four digits, PAN image and number, selfie, and payout details.
3. Select **Reject** or **Request resubmission** to return the application to the host. Enter a reason of at least 10 characters and confirm. The host sees the reason on Profile and can submit a corrected application. Each attempt has its own entry in the review queue.
4. Open the new pending submission and select **Approve KYC**. The host’s profile shows **Verified** and eligible draft chargers become active.

## Reconcile a completed session and record a payout

1. Open **Admin → Payouts**. Locate the host and match the amount, booking count, and payout destination to the session under review.
2. Allow 24 hours from session completion. Selecting **Mark processed** during the hold leaves the payout pending and displays the waiting period.
3. After the hold, select **Mark processed**. The app checks the linked bookings, their host, and the unreleased payment amounts. A mismatch keeps the payout in the queue for investigation.
4. On success the payout leaves the queue. The payment release, processing timestamp, audit entry, and host notification are recorded together. A repeated request leaves the original record intact.

On kirin-dev this journey uses a synthetic payment. Marking the payout processed records the admin decision. Actual bank or UPI transfers are separate.
