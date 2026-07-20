-- Migration 027: terminal state guard
-- Prevents bookings from ever transitioning out of auto_rejected or no_show
-- at the database layer. These states are irreversible by design.

CREATE OR REPLACE FUNCTION public.enforce_booking_terminal_states()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('auto_rejected', 'no_show')
     AND NEW.status IS DISTINCT FROM OLD.status
  THEN
    RAISE EXCEPTION
      'booking_terminal_state: booking % is in terminal state % and cannot transition to %',
      OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_terminal_state_guard ON public.bookings;
CREATE TRIGGER booking_terminal_state_guard
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_terminal_states();
