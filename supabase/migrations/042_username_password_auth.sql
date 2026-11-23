-- Password accounts use an internal Auth email and a regular Kirin profile.
ALTER TABLE public.users ADD COLUMN username text UNIQUE
  CHECK (username ~ '^[a-z][a-z0-9_]{2,29}$');

-- Profile writes already go through authenticated application endpoints.
-- The old own-row update policy also allowed direct edits to identity and admin fields.
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE FUNCTION public.provision_username_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account_username text := NEW.raw_app_meta_data ->> 'kirin_username';
  contact_phone text := NEW.raw_app_meta_data ->> 'kirin_contact_phone';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.email IS DISTINCT FROM OLD.email AND (
      lower(OLD.email) LIKE '%@username.auth.local' OR
      lower(NEW.email) LIKE '%@username.auth.local'
    ) THEN
      RAISE EXCEPTION 'The internal username email cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF lower(NEW.email) NOT LIKE '%@username.auth.local' OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only Auth Admin can set app metadata. This reserves the email namespace
  -- and creates the profile in the same transaction as the Auth user.
  IF account_username IS NULL OR account_username !~ '^[a-z][a-z0-9_]{2,29}$'
     OR NEW.email <> account_username || '@username.auth.local'
     OR contact_phone IS NULL OR contact_phone !~ '^91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid username account provisioning';
  END IF;

  -- Canonical numbers are protected by users.phone's unique constraint.
  -- Reject older profiles that stored the same number with a leading plus.
  IF EXISTS (SELECT 1 FROM public.users WHERE phone = '+' || contact_phone) THEN
    RAISE EXCEPTION 'The contact phone is already in use' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.users (id, username, phone, role, is_admin)
  VALUES (NEW.id, account_username, contact_phone, 'driver', false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_username_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER provision_username_account
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_username_account();
