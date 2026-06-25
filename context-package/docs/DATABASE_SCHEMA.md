# Database Schema

PostgreSQL via Supabase, with PostGIS for geo queries. All migrations live in `supabase/migrations/` as versioned SQL files.

## Conventions

- **Primary keys:** `uuid` with `default uuid_generate_v4()`
- **Timestamps:** `timestamptz` (timezone-aware), `created_at` and `updated_at` on every table
- **Money:** integers in **paise** (₹ × 100), never `numeric` or `float`
- **Enums:** Postgres `text` columns with `CHECK` constraints (more flexible than enum types)
- **Soft delete:** `status` column with `'active' | 'paused' | 'suspended'` pattern, never `deleted_at`
- **FK behavior:** `ON DELETE CASCADE` for hard ownership, `ON DELETE RESTRICT` for shared references
- **Naming:** `snake_case` for SQL, `camelCase` for TypeScript. Mapping happens in the data layer.

---

## Tables

### `users`

Application users — drivers, lenders, or both.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `phone` | varchar(15) unique | E.164 format without `+`, e.g. `919876543210` |
| `name` | varchar(100) | Display name |
| `role` | text CHECK | `'driver' \| 'lender' \| 'both'` |
| `kyc_status` | text CHECK | `'pending' \| 'verified' \| 'rejected'` |
| `kyc_doc_url` | text nullable | Cloudinary URL for ID upload |
| `avg_rating` | numeric(3,2) nullable | Cached from reviews |
| `razorpay_contact_id` | text nullable | For payouts |
| `razorpay_fund_account_id` | text nullable | UPI/bank for payouts |
| `created_at`, `updated_at` | timestamptz | |

**Auth identity:** This row is created/found after MSG91 OTP verification succeeds. `phone` is the unique identifier; password is never stored.

---

### `chargers`

A physical EV charger that a lender has listed for sharing.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `lender_id` | uuid FK → users.id | ON DELETE CASCADE |
| `title` | varchar(120) | User-facing label |
| `charger_type` | text CHECK | `'AC_3.3kW' \| 'AC_7kW' \| 'AC_22kW' \| 'DC_fast'` |
| `connector_types` | text[] CHECK | Array of connector types; min 1 required. Valid values: `'Type2' \| 'BharatAC' \| 'CCS2' \| 'CHAdeMO' \| 'Type1'` |
| `price_per_kwh` | numeric(6,2) | INR (this one is rupees, lender-facing input) |
| `address` | text | Human-readable |
| `latitude`, `longitude` | numeric(10,7) | Raw coords |
| `location` | geography(Point, 4326) | PostGIS point — generated from lat/lng via trigger |
| `photos` | text[] | Array of Cloudinary URLs, min 1 required |
| `instructions` | text nullable | Access instructions for driver |
| `status` | text CHECK | `'active' \| 'paused' \| 'suspended'` |
| `avg_rating` | numeric(3,2) nullable | Cached from reviews |
| `total_sessions` | int default 0 | Cached counter |
| `created_at`, `updated_at` | timestamptz | |

**Critical indexes:**
- `idx_chargers_lender` on `lender_id`
- `idx_chargers_status` on `status`
- `idx_chargers_location` GIST on `location` — powers ST_DWithin queries

---

### `availability_slots`

Recurring weekly availability windows for a charger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `charger_id` | uuid FK → chargers.id | ON DELETE CASCADE |
| `day_of_week` | int[] | 0=Sun, 6=Sat |
| `start_time` | time | e.g. `08:00` |
| `end_time` | time | e.g. `22:00` |
| `is_active` | boolean default true | |

---

### `bookings`

A driver's request to charge at a specific charger at a specific time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `charger_id` | uuid FK → chargers.id | ON DELETE RESTRICT |
| `driver_id` | uuid FK → users.id | ON DELETE RESTRICT |
| `lender_id` | uuid FK → users.id | **Denormalized** for fast payout queries |
| `scheduled_start` | timestamptz | Requested slot start |
| `scheduled_end` | timestamptz | Requested slot end |
| `actual_start` | timestamptz nullable | When lender confirmed session start |
| `actual_end` | timestamptz nullable | When session marked complete |
| `kwh_delivered` | numeric(6,2) nullable | Manual entry for MVP |
| `status` | text CHECK | See state machine below |
| `cancellation_reason` | text nullable | |
| `confirmation_code` | varchar(8) | Short code driver shows lender |
| `created_at`, `updated_at` | timestamptz | |

**Critical indexes:**
- `idx_bookings_charger_slot` on `(charger_id, scheduled_start)` — composite, prevents double-booking
- `idx_bookings_driver` on `driver_id`
- `idx_bookings_lender_status` on `(lender_id, status)` — for lender dashboard queries

---

### `payments`

Tracks the money flow for each booking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `booking_id` | uuid FK unique → bookings.id | ON DELETE CASCADE |
| `razorpay_order_id` | text nullable | From order creation |
| `razorpay_payment_id` | text nullable | After successful capture |
| `razorpay_transfer_id` | text nullable | Route transfer to lender |
| `gross_amount` | int | **In paise.** Total driver paid. |
| `platform_fee` | int | **In paise.** Our commission. |
| `lender_payout` | int | **In paise.** What lender receives. |
| `gateway_fee` | int default 0 | **In paise.** Razorpay's cut. |
| `status` | text CHECK | `'created' \| 'paid' \| 'transferred' \| 'refunded' \| 'failed'` |
| `payout_released_at` | timestamptz nullable | When transfer triggered (T+24h after session) |
| `created_at`, `updated_at` | timestamptz | |

**Invariant:** `gross_amount = platform_fee + lender_payout` (always, no rounding).

**Critical indexes:**
- `idx_payments_razorpay_order` on `razorpay_order_id` — webhook lookup
- `idx_payments_payout` on `(status, payout_released_at)` — payout cron job

---

### `reviews`

Post-session ratings. Driver rates lender, lender rates driver.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `booking_id` | uuid FK → bookings.id | |
| `reviewer_id` | uuid FK → users.id | |
| `reviewee_id` | uuid FK → users.id | |
| `charger_id` | uuid FK → chargers.id | Denormalized for charger rating queries |
| `rating` | smallint CHECK between 1-5 | |
| `comment` | text nullable | |
| `created_at` | timestamptz | |

**Trigger:** After insert, recalculate `avg_rating` on the `users` and `chargers` tables.

---

### `disputes`

Issues raised after a session — wrong kWh, charger broken, no-show, etc.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `booking_id` | uuid FK → bookings.id | |
| `raised_by` | uuid FK → users.id | Driver or lender |
| `reason` | text | Free text + structured category |
| `status` | text CHECK | `'open' \| 'resolved_driver' \| 'resolved_lender' \| 'refunded'` |
| `admin_note` | text nullable | Internal resolution notes |
| `resolved_at` | timestamptz nullable | |

When a dispute is opened, the booking moves to `disputed` status and the payout is automatically held until resolution.

---

### `audit_log` (Module 5+)

Append-only log of changes to bookings and payments. Critical for dispute resolution.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `table_name` | text | `'bookings' \| 'payments'` |
| `record_id` | uuid | |
| `action` | text | `'insert' \| 'update' \| 'delete'` |
| `actor_id` | uuid FK → users.id nullable | Who made the change |
| `old_data` | jsonb | |
| `new_data` | jsonb | |
| `created_at` | timestamptz | |

Populated automatically via Postgres triggers on `bookings` and `payments`.

---

## The booking state machine

This is the most important part of the system. Every other feature is glue around this.

```
             ┌──────────────┐
   create ──▶│   pending    │── lender accepts ──┐
             └──────┬───────┘                    │
                    │                            ▼
       30 min timeout                    ┌──────────────┐
                    │                    │  confirmed   │
                    ▼                    └──────┬───────┘
             ┌──────────────┐                   │
             │  cancelled   │◀── driver/lender cancels
             └──────────────┘                   │
                    ▲                           ▼
                    │                    ┌──────────────┐
             refund ─┤             ┌────▶│    active    │
                    │              │     └──────┬───────┘
                    │       driver "I'm here"   │
                    │                           │ end session
                    │                           ▼
                    │                    ┌──────────────┐
                    │                    │  completed   │
                    │                    └──────┬───────┘
                    │                           │
                    │              issue raised │
                    │                           ▼
                    │                    ┌──────────────┐
                    └────────────────────│   disputed   │
                                         └──────────────┘
```

### Transition rules

| From | To | Trigger | Side effect |
|------|----|---------| ------------|
| (new) | `pending` | Driver creates booking | Razorpay order created, payment held in escrow |
| `pending` | `confirmed` | Lender accepts within 30 min | Push notification to driver with confirmation code |
| `pending` | `cancelled` | Lender doesn't accept (30 min timeout, cron) | Full refund |
| `pending` | `cancelled` | Driver cancels >60 min before slot | Full refund |
| `confirmed` | `active` | Driver taps "I'm here" + lender confirms presence | Session start time logged |
| `active` | `completed` | Driver enters kWh + lender confirms | Schedule payout 24h later |
| `confirmed` | `cancelled` | Lender cancels | Full refund + strike on lender account |
| `confirmed` | `cancelled` | Driver cancels <60 min before | No refund (lender keeps 50% as compensation) |
| `confirmed` | `cancelled` | Driver no-show (lender marks) | No refund, lender keeps 50% |
| `active` / `completed` | `disputed` | Either party reports issue | Payout held, admin alerted |
| `disputed` | resolved (manual) | Admin reviews + decides | Refund / partial / release as appropriate |

### Invariants (always true)

- A `pending` booking that's >30 min old must be auto-cancelled (cron job)
- A booking can never go from a "terminal" state (`completed`, `cancelled`) back to a non-terminal state
- Payout never released while booking is `disputed`
- Sum of all `gross_amount` for a user's completed bookings = total Razorpay charges visible to them
- `platform_fee + lender_payout = gross_amount` for every payment row

---

## Critical SQL queries

### Find chargers near me (the core read query)

```sql
SELECT 
  c.*, 
  ST_Distance(c.location, ST_MakePoint($lng, $lat)::geography) AS dist_meters
FROM chargers c
WHERE 
  c.status = 'active'
  AND c.connector_types && $connectors::text[]  -- optional filter (overlap: charger supports at least one requested type)
  AND ST_DWithin(
    c.location,
    ST_MakePoint($lng, $lat)::geography,
    $radius_meters  -- e.g. 5000 for 5km
  )
ORDER BY dist_meters ASC
LIMIT 20;
```

The GIST index makes this fast even with millions of rows.

### Prevent double-booking (the critical write)

```sql
BEGIN;

-- Lock the charger row to serialize concurrent bookings
SELECT id FROM chargers WHERE id = $charger_id FOR UPDATE;

-- Check for overlapping bookings
SELECT COUNT(*) FROM bookings
WHERE charger_id = $charger_id
  AND status IN ('pending', 'confirmed', 'active')
  AND scheduled_start < $end
  AND scheduled_end > $start;

-- If count = 0, INSERT the booking
-- If count > 0, abort with conflict error

COMMIT;
```

`SELECT ... FOR UPDATE` is essential. Without it, two drivers booking the same slot at the same millisecond can both succeed.

---

## Row Level Security (RLS)

Supabase recommends RLS on every public-facing table. Plan to enable after auth is wired up. Pseudocode:

- `users` — users can read/update their own row; cannot read others except `name` and `avg_rating`
- `chargers` — anyone authenticated can read `status = 'active'` rows; only `lender_id = auth.uid()` can update
- `bookings` — readable by `driver_id = auth.uid() OR lender_id = auth.uid()`; insert by drivers only
- `payments` — readable by `driver_id OR lender_id` only via joined query; modifiable only by service role (server-side)
- `reviews` — readable by anyone authenticated; insert when authenticated user is a participant in the booking
- `disputes` — readable by participants; admin role sees all

**Set up RLS before Module 6 (beta launch).** It's tempting to skip; don't.
