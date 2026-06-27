-- Migration: 006_chargers_within_radius
-- Adds the chargers_within_radius RPC function used by GET /api/chargers
-- when lat/lng query params are provided.
--
-- Prerequisites: migration 002 already adds the location geography column,
-- GIST index, and trigger to keep location in sync with lat/lng.
--
-- Safe to re-run — uses CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION chargers_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_m   double precision
)
RETURNS SETOF public.chargers
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.chargers
  WHERE  status = 'active'
    AND  location IS NOT NULL
    AND  ST_DWithin(
           location,
           ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
           radius_m
         )
  ORDER BY ST_Distance(
             location,
             ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
           );
$$;
