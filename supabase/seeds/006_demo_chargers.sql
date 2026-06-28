-- =============================================================================
-- Seed: 006_demo_chargers
-- 20 fake lender users + 1,200 realistic chargers across India
-- Idempotent: DELETE + INSERT pattern; safe to re-run.
-- Run in Supabase SQL Editor or via `supabase db reset` (local).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------
-- hashtext() returns int4 (-2147483648..2147483647).
-- We use ABS(hashtext(...)) % N to pick from N options deterministically.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Fake lender users (public.users only — not auth.users)
-- ---------------------------------------------------------------------------
DELETE FROM public.chargers
WHERE lender_id IN (
  SELECT id FROM public.users WHERE phone LIKE '+910000000%'
);

DELETE FROM public.users WHERE phone LIKE '+910000000%';

INSERT INTO public.users (id, phone, name, role, kyc_status, avg_rating, created_at, updated_at)
SELECT
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb00' || lpad(n::text, 2, '0'))::uuid,
  '+9100000000' || lpad(n::text, 2, '0'),
  (ARRAY[
    'Aarav Sharma','Vivaan Patel','Aditya Mehta','Vihaan Gupta','Arjun Singh',
    'Sai Reddy','Reyansh Nair','Ayaan Joshi','Krishna Iyer','Ishaan Verma',
    'Priya Kapoor','Ananya Das','Diya Bose','Kavya Rao','Riya Malhotra',
    'Pooja Mishra','Sneha Kulkarni','Aditi Shah','Meera Pillai','Tanvi Bhatt'
  ])[n] AS name,
  'lender',
  CASE WHEN n <= 15 THEN 'approved' ELSE 'pending' END,
  ROUND((3.5 + (ABS(hashtext('rating' || n::text)) % 15) * 0.1)::numeric, 2),
  NOW() - ((ABS(hashtext('age' || n::text)) % 365 + 30) || ' days')::interval,
  NOW()
FROM generate_series(1, 20) AS n;

-- ---------------------------------------------------------------------------
-- 2. Charger seed — 1,200 rows across 12 regions
-- ---------------------------------------------------------------------------
-- Region config: (name, lat_base, lat_range, lng_base, lng_range, count, ac3_pct, ac7_pct, ac22_pct, dc_pct)
-- Percentages are cumulative thresholds for charger_type bucket.
-- ---------------------------------------------------------------------------

DELETE FROM public.chargers
WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%';

WITH regions AS (
  SELECT *
  FROM (VALUES
    -- region_name, lat_c, lat_r, lng_c, lng_r, cnt, lender_pool_size
    ('Mumbai',        18.93, 0.30, 72.85, 0.30, 150, 20),
    ('Delhi-NCR',     28.65, 0.40, 77.20, 0.40, 150, 20),
    ('Bengaluru',     12.97, 0.30, 77.59, 0.30, 120, 20),
    ('Hyderabad',     17.40, 0.25, 78.48, 0.25,  90, 20),
    ('Chennai',       13.08, 0.25, 80.27, 0.25,  90, 20),
    ('Pune',          18.52, 0.20, 73.86, 0.20,  80, 20),
    ('Kolkata',       22.57, 0.25, 88.37, 0.25,  80, 20),
    ('Ahmedabad',     23.03, 0.20, 72.58, 0.20,  70, 20),
    ('Jaipur',        26.91, 0.25, 75.79, 0.25,  60, 20),
    ('Highway-NH48',  21.00, 4.00, 73.50, 1.50,  60, 20),
    ('Tier2-Mix',     20.00, 6.00, 76.00, 8.00,  50, 20),
    ('Rural-Edge',    25.00, 8.00, 80.00,10.00,  50, 20)
  ) AS t(region_name, lat_c, lat_r, lng_c, lng_r, cnt, lender_pool_size)
),

-- Assign each region a sequential offset so global IDs (gid) are unique
region_offsets AS (
  SELECT
    region_name, lat_c, lat_r, lng_c, lng_r, cnt, lender_pool_size,
    SUM(cnt) OVER (ORDER BY region_name ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS offset
  FROM regions
),

-- Expand each region into individual rows
expanded AS (
  SELECT
    (COALESCE(ro.offset, 0) + gs)                                  AS gid,
    ro.region_name,
    ro.lat_c, ro.lat_r, ro.lng_c, ro.lng_r,
    ro.lender_pool_size
  FROM region_offsets ro
  CROSS JOIN LATERAL generate_series(1, ro.cnt) AS gs
),

-- Derive all charger attributes deterministically from gid
attrs AS (
  SELECT
    gid,
    region_name,

    -- UUID
    ('cccccccc-cccc-cccc-cccc-' || lpad(gid::text, 12, '0'))::uuid AS charger_id,

    -- Lender (round-robin within pool of 20)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb00' ||
      lpad(((ABS(hashtext('lender' || gid::text)) % lender_pool_size) + 1)::text, 2, '0')
    )::uuid AS lender_id,

    -- Coordinates: pseudo-random within region bounding box
    ROUND((lat_c + (((ABS(hashtext('lat' || gid::text)) % 10000)::numeric / 10000.0) - 0.5) * lat_r)::numeric, 7) AS latitude,
    ROUND((lng_c + (((ABS(hashtext('lng' || gid::text)) % 10000)::numeric / 10000.0) - 0.5) * lng_r)::numeric, 7) AS longitude,

    -- Charger type bucket: resolved in next CTE (AC_3.3kW 30%, AC_7kW 30%, AC_22kW 25%, DC_fast 15%)
    (ABS(hashtext('ctype' || gid::text)) % 100) AS ctype_bucket,

    -- Connector type set (based on charger type bucket)
    (ABS(hashtext('conn' || gid::text)) % 100)  AS conn_bucket,

    -- Price ₹/kWh: 6–50, skewed towards 8–18
    ROUND((6.0 + (ABS(hashtext('price' || gid::text)) % 441) / 10.0)::numeric, 2) AS price_raw,

    -- Status: 70% active, 20% paused, 10% suspended
    (ABS(hashtext('status' || gid::text)) % 100) AS status_bucket,

    -- Avg rating: 3.5–5.0, NULL for ~20% (no sessions yet)
    (ABS(hashtext('rating' || gid::text)) % 100) AS rating_bucket,

    -- Total sessions: 0–2000
    (ABS(hashtext('sessions' || gid::text)) % 2001) AS sessions_raw,

    -- Created at: 0–730 days ago
    (ABS(hashtext('created' || gid::text)) % 730) AS created_days_ago,

    -- Title template selector
    (ABS(hashtext('title' || gid::text)) % 8)   AS title_bucket,

    -- Photo selector (1–3 photos)
    (ABS(hashtext('photo' || gid::text)) % 3)   AS photo_count_minus1,

    lender_pool_size
  FROM expanded
),

-- Resolve human-readable values
resolved AS (
  SELECT
    charger_id,
    lender_id,
    region_name,
    latitude,
    longitude,

    -- Charger type
    CASE
      WHEN ctype_bucket < 30 THEN 'AC_3.3kW'
      WHEN ctype_bucket < 60 THEN 'AC_7kW'
      WHEN ctype_bucket < 85 THEN 'AC_22kW'
      ELSE 'DC_fast'
    END AS charger_type,

    ctype_bucket,
    conn_bucket,
    price_raw,
    status_bucket,
    rating_bucket,
    sessions_raw,
    created_days_ago,
    title_bucket,
    photo_count_minus1,
    gid
  FROM attrs
),

-- Build final row
final AS (
  SELECT
    charger_id AS id,
    lender_id,

    -- Title: combine template with region
    (ARRAY[
      'EV Point',
      'Charge Hub',
      'GreenCharge',
      'PowerStop',
      'ChargeMate',
      'VoltStation',
      'EcoCharge',
      'QuickVolt'
    ])[title_bucket + 1]
    || ' ' || region_name
    || ' #' || gid::text                                AS title,

    charger_type,

    -- connector_types array based on charger_type
    CASE charger_type
      WHEN 'AC_3.3kW' THEN
        CASE (conn_bucket % 3)
          WHEN 0 THEN ARRAY['Type2']
          WHEN 1 THEN ARRAY['BharatAC']
          ELSE        ARRAY['Type2', 'BharatAC']
        END
      WHEN 'AC_7kW' THEN
        CASE (conn_bucket % 3)
          WHEN 0 THEN ARRAY['Type2']
          WHEN 1 THEN ARRAY['BharatAC']
          ELSE        ARRAY['Type1', 'BharatAC']
        END
      WHEN 'AC_22kW' THEN
        CASE (conn_bucket % 2)
          WHEN 0 THEN ARRAY['Type2']
          ELSE        ARRAY['Type2', 'Type1']
        END
      ELSE -- DC_fast
        CASE (conn_bucket % 3)
          WHEN 0 THEN ARRAY['CCS2']
          WHEN 1 THEN ARRAY['CHAdeMO']
          ELSE        ARRAY['CCS2', 'CHAdeMO']
        END
    END AS connector_types,

    -- Price: clamp 6–50, bias 8–18 for common AC
    LEAST(50.0, GREATEST(6.0,
      CASE charger_type
        WHEN 'AC_3.3kW' THEN ROUND((7.0  + (price_raw - 6.0) * 0.15)::numeric, 2)
        WHEN 'AC_7kW'   THEN ROUND((8.0  + (price_raw - 6.0) * 0.20)::numeric, 2)
        WHEN 'AC_22kW'  THEN ROUND((10.0 + (price_raw - 6.0) * 0.30)::numeric, 2)
        ELSE                 ROUND((14.0 + (price_raw - 6.0) * 0.50)::numeric, 2)
      END
    )) AS price_per_kwh,

    -- Address (placeholder — real apps would reverse-geocode)
    region_name || ', India' AS address,

    latitude,
    longitude,

    -- Photos (1–3 Cloudinary-style URLs; using public placeholder images)
    CASE (photo_count_minus1)
      WHEN 0 THEN ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg']
      WHEN 1 THEN ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
                        'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg']
      ELSE        ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
                        'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg',
                        'https://res.cloudinary.com/demo/image/upload/ev_charger_3.jpg']
    END AS photos,

    -- Instructions
    'Press the green button to start charging. Cable is on the right side hook. '
    || 'Contact lender if display shows error E' || (gid % 9 + 1)::text || '.'
    AS instructions,

    -- Status
    CASE
      WHEN status_bucket < 70 THEN 'active'
      WHEN status_bucket < 90 THEN 'paused'
      ELSE 'suspended'
    END AS status,

    -- avg_rating (NULL if 0 sessions yet)
    CASE
      WHEN sessions_raw = 0         THEN NULL
      WHEN rating_bucket < 20       THEN NULL  -- no ratings yet despite sessions
      ELSE ROUND((3.5 + (rating_bucket % 15) * 0.1)::numeric, 2)
    END AS avg_rating,

    -- total_sessions
    CASE
      WHEN status_bucket >= 90 THEN 0  -- suspended chargers: no sessions
      ELSE sessions_raw
    END AS total_sessions,

    NOW() - (created_days_ago || ' days')::interval AS created_at,
    NOW() - ((created_days_ago / 2) || ' days')::interval AS updated_at

  FROM resolved
)

INSERT INTO public.chargers (
  id, lender_id, title, charger_type, connector_types,
  price_per_kwh, address, latitude, longitude,
  photos, instructions, status, avg_rating, total_sessions,
  created_at, updated_at
)
SELECT
  id, lender_id, title, charger_type, connector_types,
  price_per_kwh, address, latitude, longitude,
  photos, instructions, status, avg_rating, total_sessions,
  created_at, updated_at
FROM final;

-- ---------------------------------------------------------------------------
-- 3. Edge-case chargers (explicit, non-CTE)
-- ---------------------------------------------------------------------------
-- These cover boundary/stress cases: extreme prices, zero sessions,
-- all connector types, Ladakh lat, Andaman lng, etc.
-- IDs: cccccccc-cccc-cccc-cccc-999999900001..009
-- ---------------------------------------------------------------------------

DELETE FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-9999999%';

INSERT INTO public.chargers (
  id, lender_id, title, charger_type, connector_types,
  price_per_kwh, address, latitude, longitude,
  photos, instructions, status, avg_rating, total_sessions,
  created_at, updated_at
) VALUES

-- Edge 1: Minimum price (₹6)
('cccccccc-cccc-cccc-cccc-999999900001',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
 'Budget AC Edge Case #EC1', 'AC_3.3kW', ARRAY['BharatAC'],
 6.00, 'Ladakh, India', 34.1526, 77.5771,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg'],
 'Budget charging point. Connect cable and tap start on app.',
 'active', NULL, 0,
 NOW() - INTERVAL '1 day', NOW()),

-- Edge 2: Maximum price (₹50)
('cccccccc-cccc-cccc-cccc-999999900002',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002',
 'Premium DC Edge Case #EC2', 'DC_fast', ARRAY['CCS2','CHAdeMO'],
 50.00, 'Connaught Place, New Delhi, India', 28.6315, 77.2167,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
       'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg'],
 'High-speed DC charging. 150kW max. Pre-cool battery before arriving.',
 'active', 4.90, 1999,
 NOW() - INTERVAL '700 days', NOW()),

-- Edge 3: All 5 connector types on one charger
('cccccccc-cccc-cccc-cccc-999999900003',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0003',
 'Universal Hub Edge Case #EC3', 'AC_22kW',
 ARRAY['Type2','BharatAC','CCS2','CHAdeMO','Type1'],
 18.50, 'Bandra Kurla Complex, Mumbai, India', 19.0596, 72.8656,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
       'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg',
       'https://res.cloudinary.com/demo/image/upload/ev_charger_3.jpg'],
 'All connector types available. Pick your cable from the panel.',
 'active', 4.80, 500,
 NOW() - INTERVAL '200 days', NOW()),

-- Edge 4: Suspended, zero sessions, perfect 5.0 avg_rating (historical)
('cccccccc-cccc-cccc-cccc-999999900004',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004',
 'Suspended Star Edge Case #EC4', 'AC_7kW', ARRAY['Type2'],
 12.00, 'Koramangala, Bengaluru, India', 12.9352, 77.6245,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg'],
 'Currently offline for maintenance. Check back soon.',
 'suspended', 5.00, 0,
 NOW() - INTERVAL '400 days', NOW()),

-- Edge 5: Andaman Islands (extreme east longitude)
('cccccccc-cccc-cccc-cccc-999999900005',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0005',
 'Island Charger Edge Case #EC5', 'AC_3.3kW', ARRAY['Type2','BharatAC'],
 14.00, 'Port Blair, Andaman & Nicobar Islands, India', 11.6234, 92.7265,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg'],
 'Solar-powered charger. Available 7am–7pm only.',
 'active', 4.20, 45,
 NOW() - INTERVAL '120 days', NOW()),

-- Edge 6: Kanyakumari (southernmost tip)
('cccccccc-cccc-cccc-cccc-999999900006',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0006',
 'Southtip AC Edge Case #EC6', 'AC_7kW', ARRAY['BharatAC'],
 10.50, 'Kanyakumari, Tamil Nadu, India', 8.0883, 77.5385,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
       'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg'],
 'Near the lighthouse. Parking available for 2 cars.',
 'active', 4.50, 230,
 NOW() - INTERVAL '300 days', NOW()),

-- Edge 7: Very new charger (created today, no sessions)
('cccccccc-cccc-cccc-cccc-999999900007',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0007',
 'Brand New Hub Edge Case #EC7', 'DC_fast', ARRAY['CCS2'],
 22.00, 'Whitefield, Bengaluru, India', 12.9698, 77.7500,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg'],
 'Just installed. Tap app button to initiate session.',
 'active', NULL, 0,
 NOW(), NOW()),

-- Edge 8: Paused with many sessions (historical high-use)
('cccccccc-cccc-cccc-cccc-999999900008',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0008',
 'Paused Veteran Edge Case #EC8', 'AC_22kW', ARRAY['Type2','Type1'],
 16.00, 'Cyber City, Gurugram, India', 28.4949, 77.0890,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg',
       'https://res.cloudinary.com/demo/image/upload/ev_charger_2.jpg'],
 'Temporarily paused. Lender will resume within a week.',
 'paused', 3.90, 2000,
 NOW() - INTERVAL '729 days', NOW()),

-- Edge 9: Low rating (3.5) + active
('cccccccc-cccc-cccc-cccc-999999900009',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0009',
 'Low Rated AC Edge Case #EC9', 'AC_3.3kW', ARRAY['BharatAC'],
 9.00, 'Vasai, Maharashtra, India', 19.3919, 72.8397,
 ARRAY['https://res.cloudinary.com/demo/image/upload/ev_charger_1.jpg'],
 'Cable sometimes stiff. Wiggle firmly to connect. Press power once.',
 'active', 3.50, 88,
 NOW() - INTERVAL '180 days', NOW());

-- ---------------------------------------------------------------------------
-- 4. Verification counts
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  total_chargers   int;
  total_users      int;
  active_count     int;
  paused_count     int;
  suspended_count  int;
BEGIN
  SELECT COUNT(*) INTO total_users   FROM public.users    WHERE phone LIKE '+910000000%';
  SELECT COUNT(*) INTO total_chargers FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%';
  SELECT COUNT(*) INTO active_count    FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%' AND status = 'active';
  SELECT COUNT(*) INTO paused_count    FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%' AND status = 'paused';
  SELECT COUNT(*) INTO suspended_count FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%' AND status = 'suspended';

  RAISE NOTICE '=== Seed 006 complete ===';
  RAISE NOTICE 'Lender users inserted : %', total_users;
  RAISE NOTICE 'Total chargers        : %', total_chargers;
  RAISE NOTICE '  active    : %', active_count;
  RAISE NOTICE '  paused    : %', paused_count;
  RAISE NOTICE '  suspended : %', suspended_count;
END;
$$;
