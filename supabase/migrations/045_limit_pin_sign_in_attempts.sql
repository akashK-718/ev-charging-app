BEGIN;

CREATE TABLE public.pin_sign_in_attempts (
  username text PRIMARY KEY REFERENCES public.users(username) ON DELETE CASCADE,
  attempted_at timestamptz[] NOT NULL
);

ALTER TABLE public.pin_sign_in_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pin_sign_in_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pin_sign_in_attempts TO service_role;

-- Reserve an attempt before checking the PIN. The upsert serializes concurrent
-- requests across app instances. Unknown usernames never create rows.
CREATE FUNCTION public.reserve_pin_sign_in_attempt(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  attempted_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
    RETURN true;
  END IF;

  INSERT INTO public.pin_sign_in_attempts AS attempts (username, attempted_at)
  SELECT username, ARRAY[attempted_now]
  FROM public.users
  WHERE username = p_username
  ON CONFLICT (username) DO UPDATE
    SET attempted_at = ARRAY(
      SELECT stamp FROM unnest(attempts.attempted_at) AS t(stamp)
      WHERE stamp > attempted_now - interval '24 hours'
    ) || attempted_now
    WHERE (SELECT count(*) FROM unnest(attempts.attempted_at) AS t(stamp)
           WHERE stamp > attempted_now - interval '15 minutes') < 5
      AND (SELECT count(*) FROM unnest(attempts.attempted_at) AS t(stamp)
           WHERE stamp > attempted_now - interval '24 hours') < 12;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_pin_sign_in_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_pin_sign_in_attempt(text) TO service_role;

COMMIT;
