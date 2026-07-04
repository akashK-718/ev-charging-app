-- Migration 013: grant_admin() helper function
-- Usage: SELECT grant_admin('91XXXXXXXXXX');
--
-- Creates a fully-provisioned admin account for a phone number that has never
-- signed up, OR upgrades an existing account to admin — in both cases idempotent.
--
-- For NEW numbers: inserts into auth.users (placeholder password, corrected on first
-- OTP login by the verify-otp route) and public.users with is_admin=true, role='both',
-- kyc_status='approved' and name='Admin' so the welcome flow is skipped automatically.
--
-- For EXISTING numbers: merges is_admin:true into raw_user_meta_data and sets
-- public.users.is_admin = true. The JWT picks up the flag on next login.
--
-- Requires: pgcrypto extension (already enabled via migration 001).

CREATE OR REPLACE FUNCTION grant_admin(phone_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id uuid;
  fake_email    text;
BEGIN
  fake_email := phone_number || '@auth.local';

  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = fake_email;

  IF auth_user_id IS NULL THEN
    -- New number: create auth user + public profile from scratch.
    -- The encrypted_password here is a placeholder; the verify-otp route calls
    -- auth.admin.updateUserById on first login to set the HMAC-derived password.
    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      fake_email,
      crypt('placeholder_password', gen_salt('bf')),
      now(),
      -- Include name so the middleware welcome-flow gate is not triggered
      '{"role": "both", "is_admin": true, "name": "Admin"}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO auth_user_id;

    INSERT INTO public.users (id, phone, name, role, is_admin, kyc_status)
    VALUES (auth_user_id, phone_number, 'Admin', 'both', true, 'approved');

  ELSE
    -- Existing number: upgrade in place.
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
    WHERE id = auth_user_id;

    UPDATE public.users
    SET is_admin = true
    WHERE phone = phone_number;
  END IF;
END;
$$;
