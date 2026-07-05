-- Migration 015: app_settings table + proximity check defaults
-- Stores admin-configurable feature flags as key/value pairs.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES ('proximity_check_enabled',   'true')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('proximity_check_radius_km', '0.5')
  ON CONFLICT (key) DO NOTHING;
