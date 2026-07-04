-- Migration 013: grant_admin() helper function
-- Usage: SELECT grant_admin('91XXXXXXXXXX');
--
-- For NEW phone numbers: inserts a row into public.users only (is_admin=true,
-- role='both', kyc_status='approved', name='Admin'). The auth.users row is created
-- by the Supabase admin API on the first OTP login — never via raw SQL, which avoids
-- missing internal GoTrue fields that cause unexpected_failure on sign-in.
--
-- For EXISTING phone numbers: sets is_admin=true in public.users and merges
-- is_admin:true into the auth.users JWT metadata (if the auth account exists).
-- The JWT picks up the flag on the user's next login.
--
-- Idempotent: safe to run multiple times on the same number.

CREATE OR REPLACE FUNCTION grant_admin(phone_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.users WHERE phone = phone_number;

  IF existing_id IS NULL THEN
    -- New number: create the public profile only.
    -- auth.users is intentionally left to the verify-otp route (Supabase admin API
    -- createUser call) which sets all GoTrue-internal fields correctly.
    INSERT INTO public.users (phone, name, role, is_admin, kyc_status)
    VALUES (phone_number, 'Admin', 'both', true, 'approved');

  ELSE
    -- Existing user: promote in place.
    UPDATE public.users
    SET is_admin = true
    WHERE id = existing_id;

    -- Merge is_admin into JWT metadata if the auth account already exists.
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
    WHERE id = existing_id;
  END IF;
END;
$$;
