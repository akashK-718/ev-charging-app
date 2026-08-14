-- Migration 036: RLS domain-1 fix — reviews table
--
-- Audit findings (users / vehicles / push_tokens / reviews):
--
--   users              — RLS enabled, policies correct. No change.
--   vehicles           — RLS enabled, all four CRUD policies correct. No change.
--   push_tokens        — Not a separate table; fcm_token is a column on users,
--                        covered by existing users RLS. No change.
--   notification_preferences — RLS enabled, policies correct. No change.
--
-- reviews — two policy defects found and fixed below:
--
--   Defect 1 (SELECT): "reviews_select_own" used USING (reviewer_id = auth.uid()),
--   allowing a user to read only reviews they wrote. Reviewees could not read
--   reviews about themselves, and no charger-detail or host-profile read path
--   would work via the user-facing client. All current page code happens to use
--   createAdminClient() so the app is not broken today, but the policy is wrong
--   by design. Reviews are public data (they drive visible ratings); any
--   authenticated user must be able to read any review.
--   Fix: replace with USING (true) scoped to authenticated role.
--
--   Defect 2 (UPDATE): "reviews_update_own" had USING (...) but no WITH CHECK,
--   meaning a user could alter a review they own and write a different reviewer_id
--   into it, effectively reassigning authorship. WITH CHECK is required to
--   constrain what the updated row may contain, not just which rows may be touched.
--   Fix: add WITH CHECK (reviewer_id = auth.uid()).

-- ── 1. Fix SELECT: any authenticated user may read any review ─────────────────

DROP POLICY IF EXISTS "reviews_select_own" ON public.reviews;

CREATE POLICY "reviews_select_authenticated"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- ── 2. Fix UPDATE: add WITH CHECK to prevent reviewer_id reassignment ─────────

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;

CREATE POLICY "reviews_update_own"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING  (reviewer_id = auth.uid() AND (locked_at IS NULL OR locked_at > now()))
  WITH CHECK (reviewer_id = auth.uid());
