-- Migration 034: Add vehicles table (driver garage, multi-vehicle, one default per user)

CREATE TABLE IF NOT EXISTS public.vehicles (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nickname             text,
  make                 text          NOT NULL,
  model                text          NOT NULL,
  connector_types      text[]        NOT NULL
    CHECK (
      cardinality(connector_types) >= 1
      AND connector_types <@ ARRAY['Type2','BharatAC','CCS2','CHAdeMO','Type1']::text[]
    ),
  battery_capacity_kwh numeric(5,1)  CHECK (battery_capacity_kwh IS NULL OR battery_capacity_kwh > 0),
  license_plate        text,
  is_default           boolean       NOT NULL DEFAULT false,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

-- Performance index for common lookup pattern
CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON public.vehicles (user_id);
CREATE INDEX IF NOT EXISTS vehicles_user_default_idx ON public.vehicles (user_id, is_default) WHERE is_default = true;

-- Row-level security (users only see and modify their own vehicles)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_own"
  ON public.vehicles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vehicles_insert_own"
  ON public.vehicles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vehicles_update_own"
  ON public.vehicles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vehicles_delete_own"
  ON public.vehicles FOR DELETE
  USING (user_id = auth.uid());

-- Trigger: auto-promote the oldest remaining vehicle to default
-- when the current default vehicle is deleted. Runs SECURITY DEFINER
-- so it can update rows belonging to the affected user without RLS interference.
CREATE OR REPLACE FUNCTION public.vehicles_promote_default_on_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.is_default THEN
    UPDATE public.vehicles
    SET is_default = true
    WHERE id = (
      SELECT id
      FROM   public.vehicles
      WHERE  user_id = OLD.user_id
      ORDER  BY created_at ASC
      LIMIT  1
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_promote_default_after_delete ON public.vehicles;
CREATE TRIGGER vehicles_promote_default_after_delete
  AFTER DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.vehicles_promote_default_on_delete();

-- updated_at auto-maintenance.
-- CREATE OR REPLACE is idempotent: safe if migration 011 already defined this function.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
