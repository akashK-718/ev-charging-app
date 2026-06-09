-- Migration: 002_add_postgis
-- Adds geo-query support for "find chargers near me"

create extension if not exists postgis;

-- Add a PostGIS point column derived from lat/lng
alter table public.chargers
  add column location geography(point, 4326);

-- Populate from existing lat/lng
update public.chargers
  set location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;

-- Spatial index for fast nearest-neighbour queries
create index idx_chargers_location on public.chargers using gist (location);

-- Trigger to keep location in sync with lat/lng
create or replace function sync_charger_location()
returns trigger as $$
begin
  new.location := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_charger_location
  before insert or update of latitude, longitude on public.chargers
  for each row execute function sync_charger_location();
