-- Migration: 007_chargers_along_route
-- Returns active chargers within buffer_m metres of a GeoJSON LineString route.
-- Mirrors chargers_within_radius (006) but operates on a line rather than a point,
-- and returns distance_from_route_m so the client can display "X km off your route".
--
-- Prerequisite: migration 002 adds the location geography column + GIST index.
-- Safe to re-run — uses CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION chargers_along_route(
  route_geojson text,           -- GeoJSON LineString geometry string
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
  WHERE
    c.status = 'active'
    AND c.location IS NOT NULL
    AND ST_DWithin(
      c.location,
      ST_SetSRID(ST_GeomFromGeoJSON(route_geojson), 4326)::geography,
      buffer_m
    )
  ORDER BY distance_from_route_m ASC;
$$;
