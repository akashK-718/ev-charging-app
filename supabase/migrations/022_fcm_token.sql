-- Add FCM push token column to users table.
-- Token is saved on every app load and used for server-side push delivery.
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token text;
