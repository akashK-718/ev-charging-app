# Decision: Map provider

**Chosen:** Mapbox

**Considered:** Google Maps Platform, OpenStreetMap + Leaflet, Mappls

**Why Mapbox:**
- 5-10× cheaper than Google at scale
- Better developer experience and visual quality
- Sufficient Indian coverage for Delhi NCR launch
- Per-request pricing is transparent and predictable

**Trade-offs:**
- Indian address autocomplete is slightly weaker than Google
- Routing in dense traffic is less accurate (mitigated by handing off to external nav app)

**Migration plan:**
- Module 1: ships with Google Places integration (Hitesh's work) + manual entry fallback
- Module 2: migrates to Mapbox for the map + discovery flows
- Lender form Step 3 updates to use Mapbox autocomplete in Module 2

---

# Decision: Razorpay Invoice API — retroactive-paid flow not viable

**Date:** 2026-08-16

**Question investigated:** Can Razorpay's Invoice API create a `paid` invoice against an
already-captured Order/Payment, or are invoices only usable as the thing that *initiates*
collection?

**Short answer:** Invoices cannot be retroactively linked to an existing Order or Payment.
The API explicitly rejects both fields.

## What was tested (test mode, rzp_test_*)

**Step 1 — Created a fresh test Order**

```
POST /v1/orders → order_TQMPCE6U3SbJgg
status: "created"  |  amount: 5000 paise (₹50)
```

**Step 2 — Attempted browser-side test-payment simulation via server API**

```
POST /v1/payments/create/ajax  →  HTTP 403 Forbidden
```

The internal ajax endpoint is browser-only (behind Checkout.js); server-side API auth is not
accepted. Test payments require the Razorpay Checkout.js browser flow and cannot be triggered
programmatically from a server.

**Step 3 — Located an existing paid Order and captured Payment in test account**

```
order_TGUbFA4bYg5LbH  |  status: "paid"  |  amount_paid: 157500  |  amount_due: 0
pay_TGUc41X7jZ3Ihx    |  status: "captured"  |  order_id: order_TGUbFA4bYg5LbH
```

**Step 4 — Confirmed Order status**

```json
{
  "id": "order_TGUbFA4bYg5LbH",
  "status": "paid",
  "amount": 157500,
  "amount_paid": 157500,
  "amount_due": 0
}
```

**Step 5 — Attempted Invoice creation (verbatim request payload)**

```json
{ "type": "invoice", "order_id": "order_TGUbFA4bYg5LbH", "payment_id": "pay_TGUc41X7jZ3Ihx" }
```

**Verbatim HTTP response — HTTP 400:**

```json
{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "order_id, payment_id is/are not required and should not be sent",
    "source": null,
    "step": null,
    "reason": null,
    "metadata": {}
  }
}
```

The same `BAD_REQUEST_ERROR` was returned by both the Razorpay Node SDK and a direct
`POST https://api.razorpay.com/v1/invoices` call using basic auth.

**Step 5b — Retry with `type: "link"` (verbatim)**

```json
{ "type": "link", "order_id": "order_TGUbFA4bYg5LbH", "payment_id": "pay_TGUc41X7jZ3Ihx" }
```

```json
{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "amount: cannot be blank; description: cannot be blank.",
    "metadata": [],
    "reason": null,
    "source": null,
    "step": null
  }
}
```

`type=link` requires its own `amount` and `description` — it does not inherit from an existing
Order. The `order_id` field is not accepted here either (the API silently ignored it and surfaced
the missing-amount error first).

**Invoice `status`, `amount_paid`, `amount_due`, `payment_id`, `order_id`, `paid_at`:**
Not present — no invoice was created. The API rejected the request before any invoice object
was created, so there is no invoice to fetch.

## Determination

Razorpay's Invoice API **does not support retroactive-paid state**. It is a *forward-looking
collection instrument only*: create invoice → send to customer → customer pays → invoice
transitions to `paid`. You cannot create an invoice against an Order/Payment that has already
been captured. The API explicitly returns `400 BAD_REQUEST_ERROR` with
`"order_id, payment_id is/are not required and should not be sent"` when either field is
supplied.

This rules out using Razorpay-native invoices as post-payment receipts.

## Decision

**Fall back to Kirin-generated receipts.** After a booking is marked `completed` and the
payment is confirmed captured, Kirin will generate its own receipt/invoice view using:

- Razorpay `order_id` and `payment_id` as reference identifiers (displayed, not linked)
- Booking row data (charger, duration, kWh, amount in paise → rupees) for line items
- Session `ended_at` timestamp as the receipt date

No Razorpay invoice objects will be created. The receipt is a Kirin-rendered page/PDF;
Razorpay's dashboard remains the audit trail for the underlying payment.