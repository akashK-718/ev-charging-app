-- Migration 039: RLS — availability_slots and spatial_ref_sys
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  WHY THIS MIGRATION EXISTS                                                  │
-- │                                                                             │
-- │  Supabase's Security Advisor flagged two tables as "RLS Disabled in Public":│
-- │    1. public.availability_slots  — genuine gap; fix applied below.          │
-- │    2. public.spatial_ref_sys     — PostGIS system table; handled in a       │
-- │                                    privilege-safe DO block.                 │
-- │                                                                             │
-- │  availability_slots was not within the scope of the three domain-split      │
-- │  audit PRs (domains were: identity, marketplace, money+admin). It holds     │
-- │  per-charger scheduling windows (day_of_week[], start_time, end_time) and   │
-- │  was left uncovered because no domain explicitly owned it.                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- ════════════════════════════════════════════════════════════════════════════════
-- availability_slots
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Design intent:
--   • availability_slots belongs to a charger via charger_id FK.
--     Ownership follows the charger — the lender who owns the charger owns its slots.
--   • Drivers (and anonymous users) may read slot schedules for published chargers
--     (status IN ('active', 'paused')), consistent with what the charger SELECT
--     policy (migration 037) already allows on the parent table.
--   • No non-owner may INSERT, UPDATE, or DELETE any slot.
--   • Slot creation at charger-listing time goes through create_charger_with_slots()
--     (SECURITY DEFINER, bypasses RLS). The INSERT policy is belt-and-suspenders
--     for any direct-client insert attempt.
--   • No slot-update or slot-delete API route currently exists. The implicit deny
--     from having no UPDATE/DELETE policy prevents direct-client tampering.
--
-- API route audit (all routes touching availability_slots):
--   GET  /api/lender/chargers/[id]          — adminClient, after lender_id === user.id
--                                             ownership check. RLS not in the path.  ✅
--   POST /api/lender/chargers/[id]/duplicate — adminClient, after lender_id !== user.id
--                                             → 403. RLS not in the path.           ✅
--   POST /api/chargers (create)              — SECURITY DEFINER fn, bypasses RLS.   ✅
--   GET  /api/chargers/[id]/availability-window — does NOT read availability_slots;
--                                             computeMaxEndTime() reads bookings only
--                                             (slot enforcement is explicitly deferred
--                                             in the availability.ts source comment). ✅
-- No route relies solely on RLS without an independent server-side ownership check.

ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- SELECT — any user (including anon) may read slots for active/paused chargers.
--          Charger owners see slots for all their own chargers regardless of status.
--          Mirrors chargers_select_public_or_own from migration 037.
CREATE POLICY "availability_slots_select_public_or_owner"
  ON public.availability_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chargers c
      WHERE c.id = availability_slots.charger_id
        AND (
          c.status IN ('active', 'paused')
          OR (auth.uid() IS NOT NULL AND c.lender_id = auth.uid())
        )
    )
  );

-- INSERT — only the lender who owns the charger may insert slots.
--          (create_charger_with_slots SECURITY DEFINER bypasses this; the policy
--          guards any direct-client insert attempt.)
CREATE POLICY "availability_slots_insert_owner"
  ON public.availability_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chargers c
      WHERE c.id = availability_slots.charger_id
        AND c.lender_id = auth.uid()
    )
  );

-- UPDATE — owner only. WITH CHECK prevents charger_id reassignment.
CREATE POLICY "availability_slots_update_owner"
  ON public.availability_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chargers c
      WHERE c.id = availability_slots.charger_id
        AND c.lender_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chargers c
      WHERE c.id = availability_slots.charger_id
        AND c.lender_id = auth.uid()
    )
  );

-- DELETE — owner only.
CREATE POLICY "availability_slots_delete_owner"
  ON public.availability_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chargers c
      WHERE c.id = availability_slots.charger_id
        AND c.lender_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════════
-- spatial_ref_sys  (PostGIS system table)
-- ════════════════════════════════════════════════════════════════════════════════
--
-- spatial_ref_sys is created by the PostGIS extension. On Supabase, migrations
-- run as the postgres superuser, so the ALTER TABLE may succeed. If it fails
-- (insufficient_privilege on a Supabase-managed extension table), the block
-- catches the error and the migration continues cleanly. Either way:
--
--   IF IT SUCCEEDS: a public SELECT policy is added. The table holds only SRID
--     reference definitions (coordinate system metadata) — not application data.
--     USING (true) is correct: the data is public by nature, PostGIS functions
--     that reference it need it readable in all security contexts (anon,
--     authenticated, SECURITY DEFINER), and no write policy is needed because
--     nothing in this application writes to spatial_ref_sys.
--
--   IF IT FAILS: the finding is consciously accepted as low risk. spatial_ref_sys
--     contains no sensitive application data (it is pure coordinate reference
--     metadata), and the Supabase advisor warning on PostGIS system tables is a
--     known false-positive pattern. Forcing RLS changes on infrastructure you
--     don't own carries more risk than the finding itself.

DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "spatial_ref_sys_public_read" ON public.spatial_ref_sys;
  CREATE POLICY "spatial_ref_sys_public_read"
    ON public.spatial_ref_sys
    FOR SELECT
    USING (true);

  RAISE NOTICE 'spatial_ref_sys: RLS enabled with public SELECT policy.';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys: insufficient privilege — RLS not applied. Accepted as low-risk known finding on PostGIS extension table.';
  WHEN OTHERS THEN
    RAISE NOTICE 'spatial_ref_sys: unexpected error (%) — RLS not applied.', SQLERRM;
END;
$$;
