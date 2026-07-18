-- Migration: 024_hosting_paused
-- Adds hosting_paused flag to users and updates search RPCs to filter it out.
-- A paused host's chargers are excluded from all search results without touching
-- individual charger statuses, preserving per-charger state during the pause.
--
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS and CREATE OR REPLACE.

-- Step 1: flag on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hosting_paused boolean NOT NULL DEFAULT false;

-- Step 2: chargers_within_radius — join users, exclude paused hosts and deleted chargers
CREATE OR REPLACE FUNCTION chargers_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_m   double precision
)
RETURNS SETOF public.chargers
LANGUAGE sql
STABLE
AS $$
  SELECT c.* FROM public.chargers c
  JOIN public.users u ON u.id = c.lender_id
  WHERE  c.status = 'active'
    AND  c.location IS NOT NULL
    AND  c.deleted_at IS NULL
    AND  u.hosting_paused = false
    AND  ST_DWithin(
           c.location,
           ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
           radius_m
         )
  ORDER BY ST_Distance(
             c.location,
             ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
           );
$$;

-- Step 3: chargers_along_route — same join + filters
CREATE OR REPLACE FUNCTION chargers_along_route(
  route_geojson text,
  buffer_m      double precision DEFAULT 2500
)
RETURNS TABLE (
  id             uuid,
  lender_id      uuid,
  title          varchar(120),
  charger_type   text,
  connector_types text[],
  price_per_kwh  numeric,
  address        text,
  latitude       numeric,
  longitude      numeric,
  location       geography,
  photos         text[],
  instructions   text,
  status         text,
  avg_rating     numeric,
  total_sessions int,
  created_at     timestamptz,
  updated_at     timestamptz,
  distance_from_route_m double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.lender_id,
    c.title,
    c.charger_type,
    c.connector_types,
    c.price_per_kwh,
    c.address,
    c.latitude,
    c.longitude,
    c.location,
    c.photos,
    c.instructions,
    c.status,
    c.avg_rating,
    c.total_sessions,
    c.created_at,
    c.updated_at,
    ST_Distance(
      c.location,
      ST_SetSRID(ST_GeomFromGeoJSON(route_geojson), 4326)::geography
    ) AS distance_from_route_m
  FROM public.chargers c
  JOIN public.users u ON u.id = c.lender_id
  WHERE
    c.status = 'active'
    AND c.location IS NOT NULL
    AND c.deleted_at IS NULL
    AND u.hosting_paused = false
    AND ST_DWithin(
      c.location,
      ST_SetSRID(ST_GeomFromGeoJSON(route_geojson), 4326)::geography,
      buffer_m
    )
  ORDER BY distance_from_route_m ASC;
$$;
