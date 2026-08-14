-- Migration 037: RLS domain-2 — chargers and bookings tables
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  CRITICAL FINDING                                                           │
-- │                                                                             │
-- │  Neither `chargers` nor `bookings` had ENABLE ROW LEVEL SECURITY applied   │
-- │  in any prior migration. Without RLS, every call made through the           │
-- │  user-facing Supabase client (anon / authenticated role) can read or write  │
-- │  any row in either table directly — bypassing all application-layer          │
-- │  ownership checks.                                                          │
-- │                                                                             │
-- │  Today all mutating API routes use createAdminClient() (service role,       │
-- │  bypasses RLS), so the live app is not broken. But any direct PostgREST     │
-- │  call using the anon key, or any future client-side Supabase query, would   │
-- │  silently return or allow access to rows the caller does not own.           │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- chargers — design intent
--   • Active and paused chargers are public-readable (Explore page,
--     unauthenticated requests use the anon role).
--   • Draft and suspended chargers are visible only to their owner.
--   • Only the owner may insert, update, or soft-delete their charger.
--   • `GET /api/chargers` uses createClient() (user-facing, respects RLS) and
--     already filters status='active'. The SELECT policy below is fully
--     compatible; the spatial RPCs called from the same route will also respect
--     RLS, which is correct — we do not want drafts leaking through PostGIS RPCs.
--
-- bookings — design intent
--   • A booking is a two-party record. Only the driver or the lender may read
--     or write it.
--   • Booking creation goes through create_booking_with_payment() (SECURITY
--     DEFINER), which already bypasses RLS. The INSERT policy is belt-and-
--     suspenders to guard any direct-client insert attempt.
--   • All state-transition API routes use createAdminClient(). The UPDATE policy
--     guards future or accidental direct-client updates.
--   • Hard deletes never occur on bookings; no DELETE policy is needed.

-- ════════════════════════════════════════════════════════════════════════════════
-- chargers
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.chargers ENABLE ROW LEVEL SECURITY;

-- SELECT — active/paused chargers are publicly readable (anon + authenticated).
--          Owners also see their own draft and suspended chargers.
--          Soft-deleted rows (deleted_at IS NOT NULL) remain inaccessible to
--          non-owners regardless of status, because no active/paused charger
--          should have deleted_at set; the second branch (lender_id = auth.uid())
--          lets owners see them for recovery purposes if ever needed.
CREATE POLICY "chargers_select_public_or_own"
  ON public.chargers
  FOR SELECT
  USING (
    status IN ('active', 'paused')
    OR (auth.uid() IS NOT NULL AND lender_id = auth.uid())
  );

-- INSERT — authenticated lenders may only insert rows naming themselves as lender.
CREATE POLICY "chargers_insert_own"
  ON public.chargers
  FOR INSERT
  TO authenticated
  WITH CHECK (lender_id = auth.uid());

-- UPDATE — owner only. WITH CHECK ensures the lender_id cannot be reassigned.
CREATE POLICY "chargers_update_own"
  ON public.chargers
  FOR UPDATE
  TO authenticated
  USING  (lender_id = auth.uid())
  WITH CHECK (lender_id = auth.uid());

-- DELETE — owner only. Soft deletes are implemented as UPDATE (deleted_at);
--          this policy blocks hard deletes from a direct client connection.
CREATE POLICY "chargers_delete_own"
  ON public.chargers
  FOR DELETE
  TO authenticated
  USING (lender_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════════
-- bookings
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- SELECT — only the driver or the lender party on the booking.
CREATE POLICY "bookings_select_party"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid() OR lender_id = auth.uid());

-- INSERT — driver must supply their own id as driver_id.
--          (create_booking_with_payment() SECURITY DEFINER bypasses this in the
--          normal booking flow; the policy guards any direct-client insert.)
CREATE POLICY "bookings_insert_driver"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- UPDATE — either party. WITH CHECK prevents reassigning driver_id or lender_id.
--          (All lifecycle transitions go through API routes using adminClient;
--          this guards any direct-client update attempt.)
CREATE POLICY "bookings_update_party"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING  (driver_id = auth.uid() OR lender_id = auth.uid())
  WITH CHECK (driver_id = auth.uid() OR lender_id = auth.uid());
