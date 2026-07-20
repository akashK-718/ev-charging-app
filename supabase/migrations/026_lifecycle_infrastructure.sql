-- Migration 026: lifecycle infrastructure
-- Adds no-show tracking columns, the session review queue, and the pg_cron
-- scheduled sweep that replaces the lazy-sweep-only approach.

-- ── 1. New columns on bookings ─────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS noshow_warning_sent_at           timestamptz,
  ADD COLUMN IF NOT EXISTS noshow_extension_warning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS keep_waiting_until               timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_reason                 text;

-- ── 2. Session review queue ────────────────────────────────────────────────────
-- Populated by runFlagForReviewSweep when a booking is stuck in
-- awaiting_end_confirmation longer than SESSION_END_REVIEW_GRACE_MINUTES.
--
-- MVP Rule: BrandName has no hardware-backed charger telemetry. Session energy
-- and cost are derived from application events rather than physical meter
-- readings. Therefore, any session stuck in awaiting_end_confirmation cannot be
-- safely auto-completed and is placed into a manual review queue for resolution.
-- This rule should be revisited if/when OCPP or smart-meter telemetry is added.

CREATE TABLE IF NOT EXISTS public.session_review_queue (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  flagged_at  timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid        REFERENCES public.users(id),
  resolution  text        CHECK (resolution IN ('completed', 'cancelled')),
  admin_notes text,
  UNIQUE (booking_id)
);

ALTER TABLE public.session_review_queue ENABLE ROW LEVEL SECURITY;

-- ── 3. pg_cron + pg_net extension setup ───────────────────────────────────────
-- Requires Supabase with pg_cron and pg_net available (both enabled by default
-- on Supabase cloud projects). The cron job is a no-op until the
-- lifecycle_sweep entry is populated in app_settings — see docs/SETUP.md.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 4. Schedule booking lifecycle sweep (every minute) ────────────────────────
-- Reads URL and LIFECYCLE_SWEEP_SECRET from app_settings at runtime.
-- The job silently skips if the setting is absent or either field is null.

DO $$
BEGIN
  PERFORM cron.unschedule('booking-lifecycle-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'booking-lifecycle-sweep',
  '* * * * *',
  $cron_body$
  DO $anon$
  DECLARE
    v_config jsonb;
    v_url    text;
    v_secret text;
  BEGIN
    SELECT value INTO v_config
    FROM   public.app_settings
    WHERE  key = 'lifecycle_sweep';
    IF v_config IS NULL THEN RETURN; END IF;
    v_url    := v_config->>'url';
    v_secret := v_config->>'secret';
    IF v_url IS NULL OR v_secret IS NULL THEN RETURN; END IF;
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'x-internal-secret', v_secret
      ),
      body    := '{}'::jsonb
    );
  END;
  $anon$;
  $cron_body$
);
