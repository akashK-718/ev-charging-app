-- Migration 010: Complete booking lifecycle
-- New status state machine, transition timestamps, idempotent-refund tracking,
-- and an atomic booking+payment creation function.
-- Safe to re-run — uses IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE throughout.

-- ============================================
-- Step 1: Expand bookings.status to the full lifecycle
-- ============================================
-- Existing rows used 'active' for an in-progress session and 'cancelled' for
-- a lender rejection — remap them onto the new, more specific values before
-- the constraint is tightened.
UPDATE public.bookings SET status = 'in_progress' WHERE status = 'active';
UPDATE public.bookings SET status = 'rejected' WHERE status = 'cancelled' AND cancellation_reason IS NOT NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',       -- created, awaiting lender accept
    'confirmed',     -- lender accepted
    'rejected',      -- lender manually rejected
    'auto_rejected', -- 30-min timeout
    'cancelled',     -- driver cancelled (future PR)
    'in_progress',   -- session started
    'completed',     -- session ended successfully
    'no_show'        -- driver didn't show up (future PR)
  ));

-- ============================================
-- Step 2: Transition timestamps + rejection reason
-- ============================================
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill rejection_reason from the legacy cancellation_reason column so
-- existing rejected rows keep their reason visible.
UPDATE public.bookings
SET rejection_reason = cancellation_reason
WHERE status IN ('rejected', 'auto_rejected') AND rejection_reason IS NULL;

-- ============================================
-- Step 3: Index for the 30-minute auto-reject sweep
-- ============================================
CREATE INDEX IF NOT EXISTS bookings_pending_old
ON public.bookings(status, created_at)
WHERE status = 'pending';

-- ============================================
-- Step 4: Idempotent-refund tracking on payments
-- ============================================
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_refund_id text;

-- ============================================
-- Step 5: Atomic booking + payment creation
-- Mirrors the create_charger_with_slots pattern — a driver's booking and its
-- payment row must both exist or neither does, so we create them in one
-- transaction via a security-definer function. Auth + payment-signature
-- verification happen in the API route before this is ever called.
-- ============================================
CREATE OR REPLACE FUNCTION create_booking_with_payment(
  p_charger_id        uuid,
  p_driver_id          uuid,
  p_lender_id          uuid,
  p_scheduled_start    timestamptz,
  p_scheduled_end      timestamptz,
  p_confirmation_code  text,
  p_gross_amount       integer,
  p_platform_fee       integer,
  p_lender_payout      integer,
  p_razorpay_order_id  text,
  p_razorpay_payment_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  INSERT INTO public.bookings (
    charger_id, driver_id, lender_id, scheduled_start, scheduled_end,
    status, confirmation_code
  ) VALUES (
    p_charger_id, p_driver_id, p_lender_id, p_scheduled_start, p_scheduled_end,
    'pending', p_confirmation_code
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (
    booking_id, razorpay_order_id, razorpay_payment_id,
    gross_amount, platform_fee, lender_payout, status
  ) VALUES (
    v_booking_id, p_razorpay_order_id, p_razorpay_payment_id,
    p_gross_amount, p_platform_fee, p_lender_payout, 'paid'
  );

  RETURN v_booking_id;
END;
$$;
