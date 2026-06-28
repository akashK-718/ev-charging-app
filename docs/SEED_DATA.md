# Demo Seed Data — 006_demo_chargers

## What it contains

| Category | Count |
|---|---|
| Fake lender users (`public.users`) | 20 |
| Demo chargers (CTE-generated) | 1,200 |
| Edge-case chargers (explicit) | 9 |
| **Total chargers** | **1,209** |

### Geographic distribution

| Region | Count |
|---|---|
| Mumbai | 150 |
| Delhi-NCR | 150 |
| Bengaluru | 120 |
| Hyderabad | 90 |
| Chennai | 90 |
| Pune | 80 |
| Kolkata | 80 |
| Ahmedabad | 70 |
| Jaipur | 60 |
| Highway NH-48 corridor | 60 |
| Tier-2 mix (spread across India) | 50 |
| Rural/edge (wide spread) | 50 |
| Edge cases (boundary testing) | 9 |

### Attribute distributions (CTE-generated batch)

| Attribute | Distribution |
|---|---|
| Charger type | AC_3.3kW 30% · AC_7kW 30% · AC_22kW 25% · DC_fast 15% |
| Status | active 70% · paused 20% · suspended 10% |
| Price (₹/kWh) | AC_3.3kW ~7–13 · AC_7kW ~8–17 · AC_22kW ~10–23 · DC_fast ~14–28 |
| Avg rating | ~3.5–5.0 for ~60% of chargers; NULL for ~40% (no sessions or new) |
| Total sessions | 0–2,000 (suspended chargers forced to 0) |
| Charger age | 0–730 days |
| Photos | 1–3 placeholder Cloudinary URLs |

### Edge cases covered

| ID suffix | Scenario |
|---|---|
| `999999900001` | Minimum price ₹6, Ladakh coordinates, zero sessions |
| `999999900002` | Maximum price ₹50, 1,999 sessions, 4.90 rating |
| `999999900003` | All 5 connector types on one charger |
| `999999900004` | Suspended with 5.0 rating but 0 sessions |
| `999999900005` | Andaman Islands (extreme east: lng 92.7°) |
| `999999900006` | Kanyakumari (southernmost tip: lat 8.09°) |
| `999999900007` | Brand-new charger (created_at = NOW, no sessions) |
| `999999900008` | Paused veteran with 2,000 sessions |
| `999999900009` | Low rating 3.50, active |

## How to run

**Supabase cloud (SQL Editor):**
1. Open your project → SQL Editor
2. Paste the contents of `supabase/seeds/006_demo_chargers.sql`
3. Run — takes ~2–5 seconds
4. Check the NOTICE output for row counts

**Local Supabase:**
```bash
supabase db reset   # applies all migrations then all seeds
# or selectively:
psql "$DATABASE_URL" -f supabase/seeds/006_demo_chargers.sql
```

## How to remove

```sql
-- Remove all seed chargers
DELETE FROM public.chargers WHERE id::text LIKE 'cccccccc-cccc-cccc-cccc-%';

-- Remove seed users
DELETE FROM public.users WHERE phone LIKE '+910000000%';
```

## When to use

- **Local dev** — gives the map meaningful density; lets you test near-me radius, route-mode buffer, and filter UI without real data.
- **Staging** — populate a fresh environment for demos or QA without needing real lenders to list chargers.
- **Never in production** — these are fake records with fake lender accounts. The deterministic UUIDs (`cccc…` / `bbbb…`) are easy to identify and delete.

## Idempotency

The seed uses a DELETE-then-INSERT pattern keyed on UUID prefix. Re-running is safe — it replaces all seed rows without touching real user data.

## Notes

- `public.users` has no email column — seed users are identified by phone (`+910000000001`..`+910000000020`). Email lives in `auth.users` which is NOT seeded.
- The `location geography` column is auto-populated from `latitude`/`longitude` by the trigger added in `002_add_postgis.sql` — no manual PostGIS insert needed.
- Photo URLs use `res.cloudinary.com/demo/...` (Cloudinary's public demo account) — they're plausible-looking URLs but may not all return real images.
