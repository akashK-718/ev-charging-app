-- Migration 014: Two-step session initiation flow
-- Lender initiates (confirmed → awaiting_driver_confirmation),
-- driver confirms (awaiting_driver_confirmation → in_progress).
-- Idempotent: safe to re-run.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',                      -- created, awaiting lender accept
    'confirmed',                    -- lender accepted
    'rejected',                     -- lender manually rejected
    'auto_rejected',                -- 30-min timeout
    'cancelled',                    -- driver cancelled
    'awaiting_driver_confirmation', -- lender initiated session, driver must confirm
    'in_progress',                  -- session started (both parties confirmed)
    'completed',                    -- session ended successfully
    'no_show'                       -- driver didn't show up
  ));
