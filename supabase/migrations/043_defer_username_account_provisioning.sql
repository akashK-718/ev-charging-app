-- Supabase Auth writes admin-supplied app metadata after inserting auth.users,
-- in the same transaction. Provision the Kirin profile after those writes.
BEGIN;

CREATE OR REPLACE FUNCTION public.provision_username_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account_username text;
  contact_phone text;
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

  -- NEW is the inserted record, so read the finalized metadata from the table.
  SELECT u.raw_app_meta_data ->> 'kirin_username',
         u.raw_app_meta_data ->> 'kirin_contact_phone'
    INTO account_username, contact_phone
    FROM auth.users AS u
    WHERE u.id = NEW.id;

  IF account_username IS NULL OR account_username !~ '^[a-z][a-z0-9_]{2,29}$'
     OR NEW.email <> account_username || '@username.auth.local'
     OR contact_phone IS NULL OR contact_phone !~ '^91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Invalid username account provisioning';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE phone = '+' || contact_phone) THEN
    RAISE EXCEPTION 'The contact phone is already in use' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.users (id, username, phone, role, is_admin)
  VALUES (NEW.id, account_username, contact_phone, 'driver', false);
  RETURN NEW;
END;
$$;

DROP TRIGGER provision_username_account ON auth.users;

CREATE CONSTRAINT TRIGGER provision_username_account
  AFTER INSERT ON auth.users
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (lower(NEW.email) LIKE '%@username.auth.local')
  EXECUTE FUNCTION public.provision_username_account();

CREATE TRIGGER protect_username_account_email
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_username_account();

COMMIT;
