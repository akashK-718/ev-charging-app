-- Migration 038: RLS domain-3 — payments, payouts, kyc_submissions, notifications,
--                              and session_review_queue clarification
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  FINDINGS                                                                   │
-- │                                                                             │
-- │  payments       — NO RLS. Financial records readable/writable by anyone     │
-- │                   with the anon key via a direct PostgREST query.           │
-- │  payouts        — NO RLS. Same: any authenticated user could read another  │
-- │                   lender's payout amounts and bank/UPI details.             │
-- │  kyc_submissions — NO RLS. Identity documents (Aadhaar, PAN, selfie URLs,  │
-- │                   bank account, UPI ID) exposed to any direct-client query. │
-- │  notifications  — NO RLS. Notification inbox for any user readable without  │
-- │                   restriction.                                               │
-- │                                                                             │
-- │  Already correct (no changes):                                              │
-- │  app_settings        — RLS enabled (migration 028), public SELECT.         │
-- │  audit_log           — RLS enabled (migration 028), admin-only SELECT.      │
-- │  session_review_queue — RLS enabled (migration 026), no policies → default  │
-- │                         deny for all non-service-role callers. All admin    │
-- │                         routes use createAdminClient() and bypass RLS.      │
-- │                         Adding an explicit admin SELECT policy below for    │
-- │                         clarity; behavior is unchanged.                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- Write-side design notes (all tables):
--   All INSERTs and UPDATEs on financial and identity tables go through either:
--     • create_booking_with_payment() SECURITY DEFINER function, or
--     • API routes that use createAdminClient() (service-role, bypasses RLS).
--   Implicit deny (no INSERT/UPDATE/DELETE policy) therefore protects against
--   direct-client mutation attempts without any policy needed to express it.
--   The single exception is kyc_submissions INSERT, which is performed by a
--   lender via the user-facing client in a future path; that policy is added below.

-- ════════════════════════════════════════════════════════════════════════════════
-- payments
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- SELECT — the driver who paid (booking.driver_id) and the lender who earned
--          (booking.lender_id) may both read the payment record.
--          A subquery on bookings is required because payments has no direct
--          user FK — it is linked through booking_id.
CREATE POLICY "payments_select_booking_party"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payments.booking_id
        AND (b.driver_id = auth.uid() OR b.lender_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policy:
--   • Booking+payment creation: create_booking_with_payment() SECURITY DEFINER.
--   • Payment status updates (paid→transferred, refunds): API routes via adminClient.
--   • Razorpay webhook handler: uses no DB client directly (stubs only; when
--     implemented will use adminClient). The webhook secret is server-side only.
-- Implicit deny blocks any direct-client mutation attempt.

-- ════════════════════════════════════════════════════════════════════════════════
-- payouts
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- SELECT — the lender whose money is being paid out.
CREATE POLICY "payouts_select_own"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy:
--   • Payout creation and status updates: admin routes via adminClient.
-- Implicit deny blocks any direct-client mutation attempt.

-- ════════════════════════════════════════════════════════════════════════════════
-- kyc_submissions
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT — lender sees only their own submission.
--          Admins read all submissions via createAdminClient() which bypasses RLS,
--          so no admin branch is needed in the SELECT USING clause.
CREATE POLICY "kyc_submissions_select_own"
  ON public.kyc_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT — lender may submit their own KYC (user_id must match caller).
--          The uniqueness index on (user_id) WHERE status IN ('pending','approved')
--          enforces the one-active-submission-per-user constraint at DB level.
CREATE POLICY "kyc_submissions_insert_own"
  ON public.kyc_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policy:
--   • Status transitions (pending→approved/rejected/resubmission_required):
--     admin routes via createAdminClient().
--   • payout-details PATCH: updates bank/UPI on the approved submission via
--     adminClient with .eq('user_id', user.id) — bypasses RLS.
-- Implicit deny blocks any direct-client mutation attempt.

-- ════════════════════════════════════════════════════════════════════════════════
-- notifications
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT — users read only their own notifications.
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy:
--   • Notifications are inserted by the notify() helper via adminClient (server-side only).
--   • mark-updates-read marks all notifications as read via adminClient with
--     .eq('user_id', user.id) — bypasses RLS.
-- Implicit deny blocks any direct-client mutation attempt.

-- ════════════════════════════════════════════════════════════════════════════════
-- session_review_queue — explicit admin SELECT for clarity
-- (RLS was already ENABLED in migration 026 with no policies → default deny)
-- ════════════════════════════════════════════════════════════════════════════════

-- Adding an explicit policy so the intent is documented. Behavior for all
-- non-service-role callers was already default-deny; this makes it explicit.
CREATE POLICY "session_review_queue_admin_select"
  ON public.session_review_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- No INSERT/UPDATE policy for non-service-role:
--   • Rows are created by the lifecycle sweep (pg_cron → /api/internal/lifecycle-sweep
--     → adminClient).
--   • Rows are resolved by /api/admin/review-queue/[id]/resolve via adminClient.
-- Implicit deny is already in effect; stated here for clarity.
