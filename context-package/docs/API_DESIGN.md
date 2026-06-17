# API Design

All backend endpoints live in `src/app/api/`. Following Next.js App Router conventions.

## Conventions

### URL structure

REST-ish. Resource-oriented:

```
GET    /api/chargers              # list chargers (with filters)
POST   /api/chargers              # create a charger (lender only)
GET    /api/chargers/:id          # get one charger
PATCH  /api/chargers/:id          # update (lender of this charger only)
DELETE /api/chargers/:id          # delete (lender only, soft delete to 'suspended')

GET    /api/bookings              # current user's bookings
POST   /api/bookings              # create a booking
GET    /api/bookings/:id          # get one booking
POST   /api/bookings/:id/confirm  # lender accepts (state: pending → confirmed)
POST   /api/bookings/:id/cancel   # cancel (state: pending|confirmed → cancelled)
POST   /api/bookings/:id/arrive   # driver arrives (state: confirmed → active)
POST   /api/bookings/:id/complete # session complete (state: active → completed)

POST   /api/payments/create-order  # create Razorpay order
POST   /api/payments/verify        # verify payment from client callback (also confirmed via webhook)

POST   /api/webhooks/razorpay      # Razorpay sends events here

POST   /api/auth/send-otp          # MSG91 trigger
POST   /api/auth/verify-otp        # MSG91 verify + create session
POST   /api/auth/logout            # destroy session
```

State transitions on resources happen as **sub-resource POST actions** (`/bookings/:id/confirm`) rather than `PATCH /bookings/:id { status: 'confirmed' }`. This is more explicit about the action and easier to authorize.

### HTTP status codes

| Code | Use |
|------|-----|
| 200 | OK — successful GET, idempotent POST |
| 201 | Created — non-idempotent POST that created a resource |
| 204 | No Content — successful action with no response body (rare) |
| 400 | Bad Request — input validation failed |
| 401 | Unauthorized — not logged in |
| 403 | Forbidden — logged in but not allowed |
| 404 | Not Found — resource doesn't exist |
| 409 | Conflict — state conflict (double-booking, slot taken) |
| 422 | Unprocessable Entity — request shape OK but semantically invalid |
| 429 | Too Many Requests — rate limited |
| 500 | Internal Server Error — bug or external service failure |
| 503 | Service Unavailable — Razorpay/MSG91 down (with circuit breaker) |

Don't return 200 for errors. Don't return 500 for user mistakes (use 400).

### Response shapes

Success:

```json
{
  "data": { ... }
}
```

For lists:

```json
{
  "data": [...],
  "meta": {
    "total": 42,
    "page": 1,
    "perPage": 20
  }
}
```

Error:

```json
{
  "error": "Slot is already booked",
  "code": "SLOT_CONFLICT",
  "details": null
}
```

The `code` is machine-readable for clients that want to react specifically (e.g., show a different UI for `SLOT_CONFLICT` vs generic 409).

### Authentication

All authenticated routes start with:

```typescript
const supabase = createClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
```

Public endpoints (e.g., `POST /api/auth/send-otp`) skip this.

### Authorization

After authentication, check that the user is *allowed* to perform the action:

```typescript
// Only the lender of this charger can update it
const { data: charger } = await supabase
  .from('chargers')
  .select('lender_id')
  .eq('id', chargerId)
  .single();

if (!charger || charger.lender_id !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

For admin routes, check role:

```typescript
const { data: profile } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Input validation

Use `zod` for non-trivial bodies:

```typescript
import { z } from 'zod';

const createBookingSchema = z.object({
  chargerId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  estimatedKwh: z.number().int().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createBookingSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid input',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    }, { status: 400 });
  }
  
  // parsed.data is now fully typed
}
```

For trivial inputs (a single phone number), inline validation is fine.

### Rate limiting

Use `@upstash/ratelimit` for endpoints that need it:

```typescript
import { otpRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const { phone } = await request.json();
  
  const { success, remaining } = await otpRateLimit.limit(phone);
  if (!success) {
    return NextResponse.json({
      error: 'Too many OTP requests. Try again in an hour.',
      code: 'RATE_LIMITED',
    }, { status: 429 });
  }
  
  // ... send OTP
}
```

**Required on:**
- All OTP / SMS endpoints (3/hour per phone)
- All payment-initiating endpoints (10/minute per user)
- All public read endpoints (100/minute per IP)

### Idempotency

POST endpoints that change state should be idempotent where possible. Especially webhooks.

Razorpay sometimes sends the same webhook twice. The handler must not double-credit:

```typescript
// In webhook handler
const existingPayment = await supabase
  .from('payments')
  .select('razorpay_payment_id')
  .eq('razorpay_order_id', event.payload.order_id)
  .single();

if (existingPayment?.razorpay_payment_id === event.payload.payment_id) {
  // Already processed, return 200 OK
  return NextResponse.json({ received: true });
}

// ... process new event
```

### Webhooks

All webhook endpoints **must** verify signatures before trusting any data.

```typescript
// src/app/api/webhooks/razorpay/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature');
  const rawBody = await request.text();
  
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ signature }, 'Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Safe to parse and act on it
  const event = JSON.parse(rawBody);
  // ...
}
```

Webhook responses should be **fast** (under 5 seconds). If processing is expensive, acknowledge immediately and queue the work.

### Server actions (Next.js)

For form submissions from server components, prefer server actions over API routes when possible. They're more type-safe and avoid the API boundary.

```typescript
// src/app/lender/chargers/new/actions.ts
'use server';

export async function createCharger(formData: FormData) {
  // Same auth/validation pattern as API routes
  // Returns directly, redirects, or revalidates pages
}
```

Use API routes for:
- Webhooks
- Public endpoints called from external systems
- Mobile app endpoints (Capacitor wrapped)
- Any endpoint called by client components

Use server actions for:
- Form submissions from server components
- Internal mutations from the UI

---

## Specific endpoint specifications

### `POST /api/auth/send-otp`

**Body:** `{ phone: string }` — 10-digit Indian number (no country code)

**Rate limit:** 3 per phone per hour

**Response 200:** `{ data: { requestId: string } }`

**Errors:**
- 400 `INVALID_PHONE` — not a 10-digit number
- 429 `RATE_LIMITED` — too many attempts
- 503 `SMS_UNAVAILABLE` — MSG91 down (circuit breaker open)

### `POST /api/auth/verify-otp`

**Body:** `{ phone: string, otp: string }` — 4 or 6 digit OTP

**Response 200:** Sets httpOnly session cookie. Returns `{ data: { userId: string, role: 'driver' | 'lender' | 'both' | null } }`. `null` role = new user, needs role selection.

**Errors:**
- 400 `INVALID_OTP` — wrong code
- 410 `OTP_EXPIRED` — older than 10 minutes
- 429 `RATE_LIMITED`

### `POST /api/chargers`

**Auth required.** User must be a lender.

**Body:**
```typescript
{
  title: string;            // max 120 chars
  chargerType: 'AC_3.3kW' | 'AC_7kW' | 'AC_22kW' | 'DC_fast';
  connectorType: 'Type2' | 'BharatAC' | 'CCS2' | 'CHAdeMO' | 'Type1';
  pricePerKwh: number;      // rupees, server converts to internal storage
  address: string;
  latitude: number;
  longitude: number;
  photos: string[];         // Cloudinary URLs, min 1, max 5
  instructions: string;
  availability: Array<{
    daysOfWeek: number[];   // 0-6
    startTime: string;      // "08:00"
    endTime: string;        // "22:00"
  }>;
}
```

**Response 201:** `{ data: { chargerId: string } }`

### `POST /api/bookings`

**Auth required.**

**Body:**
```typescript
{
  chargerId: string;
  scheduledStart: string;   // ISO timestamp
  scheduledEnd: string;     // ISO timestamp
  estimatedKwh: number;     // integer
}
```

**Server side:**
1. Verify charger exists and is active
2. Verify slot is within an availability_slot window
3. **Transaction:** SELECT FOR UPDATE on charger, check conflicts, INSERT booking
4. Generate confirmation_code
5. Create Razorpay order (Module 5+)
6. Trigger notification to lender (Module 6+)

**Response 201:**
```typescript
{
  data: {
    bookingId: string;
    confirmationCode: string;
    razorpayOrderId: string;  // Module 5+
    estimatedTotal: number;   // rupees, for display
  }
}
```

**Errors:**
- 409 `SLOT_CONFLICT` — overlapping booking exists
- 422 `OUTSIDE_AVAILABILITY` — slot not in lender's availability window
- 422 `CHARGER_PAUSED` — charger is not active

### `POST /api/webhooks/razorpay`

**No auth.** Verified via signature header.

**Events handled:**
- `payment.captured` → update payment.status = 'paid'
- `payment.failed` → update payment.status = 'failed', cancel booking
- `transfer.processed` → update payment.status = 'transferred'
- `refund.processed` → update payment.status = 'refunded'

Must be idempotent. Always returns 200 if signature is valid (even for unknown events — Razorpay might add new ones).
