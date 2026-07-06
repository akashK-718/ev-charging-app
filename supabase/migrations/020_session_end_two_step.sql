-- Migration: 020_session_end_two_step
-- Two-step session end: lender initiates (awaiting_end_confirmation), driver confirms (completed).
-- Auto-complete sweep fires after 15 minutes if driver does not confirm.

-- Add awaiting_end_confirmation to the status check constraint.
-- Drop existing constraint first (IF EXISTS so it's safe if the name differs).
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'rejected',
    'auto_rejected',
    'cancelled',
    'awaiting_driver_confirmation',
    'in_progress',
    'awaiting_end_confirmation',
    'completed',
    'no_show'
  ));

-- Timestamp set when the lender requests session end.
-- Cleared (null) on completion. Used by the auto-complete sweep.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS end_initiated_at timestamptz;
