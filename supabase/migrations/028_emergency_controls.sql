-- ============================================================
-- 028 — Emergency controls: kill switches, maintenance mode,
--       Edge Config lockdown, audit-log hardening
-- ============================================================

-- ── 1. Kill-switch flags + maintenance mode ──────────────────
-- These live in app_settings so admins can toggle them without
-- a deploy. All default to the "allow everything" state so
-- enabling them is a manual, explicit action.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES
  ('allow_bookings',         'true'::jsonb,   now()),
  ('allow_payments',         'true'::jsonb,   now()),
  ('allow_payouts',          'true'::jsonb,   now()),
  ('allow_registrations',    'true'::jsonb,   now()),
  ('allow_charger_creation', 'true'::jsonb,   now()),
  ('platform_mode',          '"normal"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- ── 2. RLS on app_settings ───────────────────────────────────
-- Public SELECT so middleware (anon client) can read platform_mode.
-- All writes go through the service-role client which bypasses RLS.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT USING (true);

-- ── 3. RLS on audit_log ──────────────────────────────────────
-- Admins can read; nobody below service-role can write or delete.
-- Service-role client (used by logAdminAction) bypasses RLS entirely.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_read" ON public.audit_log;
CREATE POLICY "audit_log_admin_read" ON public.audit_log
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
-- Intentionally no INSERT, UPDATE, or DELETE policy for non-service-role callers.
