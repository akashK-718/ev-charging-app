-- Migration 008: Lender complete flow
-- KYC submissions, soft-delete chargers, payouts, notifications

-- Step 1: Update users.kyc_status check constraint to include 'not_started' and 'approved'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE public.users ALTER COLUMN kyc_status SET DEFAULT 'not_started';
ALTER TABLE public.users ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected'));

-- Step 2: KYC submissions table
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

CREATE UNIQUE INDEX IF NOT EXISTS kyc_submissions_user_active ON public.kyc_submissions(user_id)
  WHERE status IN ('pending', 'approved');

-- Step 3: Soft delete for chargers
ALTER TABLE public.chargers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Step 4: Payouts table
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

-- Step 5: Notifications table for stubs
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.payouts(user_id, status);
