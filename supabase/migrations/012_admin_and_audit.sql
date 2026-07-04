-- Migration 012: Admin role + audit log
-- Safe to re-run — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.

-- ============================================
-- Step 1: is_admin flag on users
-- ============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================
-- Step 2: Audit log for admin actions
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id uuid       NOT NULL REFERENCES public.users(id),
  action_type  text        NOT NULL,
  target_user_id uuid      REFERENCES public.users(id),
  metadata     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin  ON public.audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_user_id, created_at DESC);

-- ============================================
-- How to grant admin access
-- ============================================
-- Run both statements in Supabase SQL Editor, substituting your phone number
-- (stored with country code, e.g. 919876543210):
--
--   UPDATE public.users
--     SET is_admin = true
--     WHERE phone = '91XXXXXXXXXX';
--
--   UPDATE auth.users
--     SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
--     WHERE id = (SELECT id FROM public.users WHERE phone = '91XXXXXXXXXX');
--
-- The user must sign out and sign back in (or wait up to 1 hour for the
-- automatic token refresh) for the JWT to pick up the is_admin flag and
-- for middleware + the navbar to reflect admin status.
