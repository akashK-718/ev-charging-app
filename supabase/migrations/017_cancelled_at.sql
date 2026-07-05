-- Migration 017: cancelled_at timestamp for bookings
-- Follows the same pattern as confirmed_at, rejected_at, no_show_at.
-- Used by the BookingTimeline and the driver cancel endpoint.
-- Idempotent: safe to re-run.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
