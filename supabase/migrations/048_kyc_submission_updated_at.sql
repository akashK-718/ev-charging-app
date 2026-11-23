-- Migration 011 installs a BEFORE UPDATE trigger that writes this column.
-- The original KYC table omitted it, preventing admin review decisions.
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
