-- Migration 011: KYC approval trigger + updated_at triggers
-- Safe to re-run — uses CREATE OR REPLACE / DROP IF EXISTS throughout.

-- ============================================
-- Step 1: Auto-promote draft chargers when a lender's KYC is approved
-- ============================================
CREATE OR REPLACE FUNCTION promote_drafts_on_kyc_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kyc_status = 'approved' AND OLD.kyc_status IS DISTINCT FROM 'approved' THEN
    UPDATE public.chargers
    SET status = 'active'
    WHERE lender_id = NEW.id
      AND status = 'draft'
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_kyc_approval_promote_drafts ON public.users;
CREATE TRIGGER users_kyc_approval_promote_drafts
  AFTER UPDATE OF kyc_status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION promote_drafts_on_kyc_approval();

-- ============================================
-- Step 2: Auto-update updated_at on every write
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Ensure updated_at column exists on chargers (other tables already have it from initial schema)
ALTER TABLE public.chargers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS chargers_updated_at ON public.chargers;
CREATE TRIGGER chargers_updated_at
  BEFORE UPDATE ON public.chargers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS kyc_submissions_updated_at ON public.kyc_submissions;
CREATE TRIGGER kyc_submissions_updated_at
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS payouts_updated_at ON public.payouts;
CREATE TRIGGER payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 3: Backfill — promote any drafts belonging to already-approved lenders
-- ============================================
UPDATE public.chargers
SET status = 'active'
WHERE status = 'draft'
  AND deleted_at IS NULL
  AND lender_id IN (
    SELECT id FROM public.users WHERE kyc_status = 'approved'
  );
