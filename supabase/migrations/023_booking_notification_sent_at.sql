-- Idempotency guard for the booking_received push notification.
-- The payment verify endpoint can be retried; this timestamp lets us do an
-- atomic UPDATE ... WHERE notification_sent_at IS NULL so only the first
-- successful call sends the push.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
