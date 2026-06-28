-- Migration 009: Draft chargers + KYC phantom-pending fix
-- Safe to re-run — uses IF EXISTS / idempotent patterns.

-- Step 1: Reset phantom-pending users (created before kyc_submissions table,
-- where the original schema defaulted kyc_status = 'pending' for all new rows).
-- Guard against kyc_submissions not existing yet (if migration 008 hasn't run).
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

-- Step 2: Add 'draft' to charger status enum so unverified lenders can save
-- listings that stay invisible to drivers until KYC is approved.
ALTER TABLE public.chargers DROP CONSTRAINT IF EXISTS chargers_status_check;
ALTER TABLE public.chargers ADD CONSTRAINT chargers_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'suspended'));

-- Note: We do NOT change the column default here.
-- POST /api/chargers decides status ('draft' vs 'active') at insert time
-- based on the lender's kyc_status.
