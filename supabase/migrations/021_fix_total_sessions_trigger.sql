-- Migration: 021_fix_total_sessions_trigger
-- chargers.total_sessions was never incremented — backfill existing data
-- and add a trigger to keep it in sync going forward.

-- Backfill: set total_sessions to the actual count of completed bookings
UPDATE chargers c
SET total_sessions = sub.actual_completed
FROM (
  SELECT charger_id, COUNT(*) AS actual_completed
  FROM bookings
  WHERE status = 'completed'
  GROUP BY charger_id
) sub
WHERE c.id = sub.charger_id;

-- Trigger function: increment on every completed transition
CREATE OR REPLACE FUNCTION increment_charger_total_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE chargers
    SET total_sessions = total_sessions + 1
    WHERE id = NEW.charger_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Idempotent trigger creation
DROP TRIGGER IF EXISTS booking_completed_increment_sessions ON bookings;
CREATE TRIGGER booking_completed_increment_sessions
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION increment_charger_total_sessions();
