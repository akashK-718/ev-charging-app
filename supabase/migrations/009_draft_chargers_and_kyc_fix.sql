-- Migration 009: Draft chargers + KYC phantom-pending fix
-- Safe to re-run — uses IF EXISTS / idempotent patterns.
-- Designed to work whether or not migration 008 has been run first.

-- Step 1: Expand users.kyc_status to include 'not_started' and 'approved'.
-- Drop the old constraint first so we can backfill legacy values without conflicts.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_status_check;

-- Remap legacy 'verified' → 'approved' while no constraint is active.
UPDATE public.users SET kyc_status = 'approved' WHERE kyc_status = 'verified';

-- Now all rows are in the new value set — safe to add the new constraint.
ALTER TABLE public.users ALTER COLUMN kyc_status SET DEFAULT 'not_started';
ALTER TABLE public.users ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected'));

-- Step 2: Reset phantom-pending users (created before kyc_submissions existed,
-- where the original schema defaulted kyc_status = 'pending' for all new rows).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kyc_submissions'
  ) THEN
    -- Table exists: only reset users who have no actual submission
    UPDATE public.users
    SET kyc_status = 'not_started'
    WHERE kyc_status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.kyc_submissions WHERE user_id = users.id
      );
  ELSE
    -- Table doesn't exist yet: no user can have a real submission, reset all
    UPDATE public.users
    SET kyc_status = 'not_started'
    WHERE kyc_status = 'pending';
  END IF;
END $$;

-- Step 3: Create kyc_submissions if it doesn't exist yet (idempotent with 008).
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  aadhaar_photo_url text NOT NULL,
  pan_photo_url text NOT NULL,
  selfie_url text NOT NULL,
  pan_number text NOT NULL,
  aadhaar_last_4 text NOT NULL,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'resubmission_required')),
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id),
  CONSTRAINT bank_or_upi_required CHECK (
    (bank_account_number IS NOT NULL AND bank_ifsc IS NOT NULL) OR upi_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS kyc_submissions_user_active
  ON public.kyc_submissions(user_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON public.kyc_submissions(user_id);

-- Step 4: Add 'draft' to charger status enum.
ALTER TABLE public.chargers DROP CONSTRAINT IF EXISTS chargers_status_check;
ALTER TABLE public.chargers ADD CONSTRAINT chargers_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'suspended'));

-- Step 5: Soft delete column for chargers (idempotent with 008).
ALTER TABLE public.chargers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Step 6: Payouts table (idempotent with 008).
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  amount_paise integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  bank_or_upi text NOT NULL,
  razorpay_payout_id text,
  booking_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failed_reason text
);

CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.payouts(user_id, status);

-- Step 7: Notifications table (idempotent with 008).
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, read, created_at DESC);
