-- Booking and payment creation must run through verified server-side payment
-- handling. Restrict every overload, including those left by older migrations.
DROP POLICY IF EXISTS "bookings_insert_driver" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_party" ON public.bookings;

DO $$
DECLARE
  booking_rpc regprocedure;
BEGIN
  FOR booking_rpc IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_booking_with_payment'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', booking_rpc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', booking_rpc);
  END LOOP;
END
$$;
