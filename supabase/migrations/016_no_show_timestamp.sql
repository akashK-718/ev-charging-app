-- Migration 016: no_show_at timestamp for bookings
-- no_show status was already included in the bookings_status_check constraint
-- added in migration 010. This adds the transition timestamp used by the
-- auto-no-show sweep and surfaced in the booking timeline.
-- Idempotent: safe to re-run.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS no_show_at timestamptz;
