-- Migration: 004_availability_slots_and_charger_fn
-- Creates the availability_slots table and an atomic function for charger creation.
-- Safe to re-run — CREATE TABLE uses IF NOT EXISTS; function uses CREATE OR REPLACE.

-- ============================================
-- AVAILABILITY SLOTS
-- ============================================
create table if not exists public.availability_slots (
  id           uuid      primary key default uuid_generate_v4(),
  charger_id   uuid      not null references public.chargers(id) on delete cascade,
  day_of_week  int[]     not null,           -- 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time   time      not null,
  end_time     time      not null,
  is_active    boolean   not null default true
);

create index if not exists idx_availability_charger on public.availability_slots(charger_id);

-- ============================================
-- ATOMIC CHARGER CREATION FUNCTION
-- Inserts charger + availability slots in a single transaction so both
-- succeed or both fail — no orphan chargers or orphan slots.
--
-- security definer: runs with the function owner's privileges so it can
-- bypass client RLS. Auth + role checks are enforced in the API route
-- before this function is ever called.
-- ============================================
create or replace function create_charger_with_slots(
  p_lender_id       uuid,
  p_title           text,
  p_charger_type    text,
  p_connector_types text[],
  p_price_per_kwh   numeric,
  p_address         text,
  p_latitude        numeric,
  p_longitude       numeric,
  p_photos          text[],
  p_instructions    text,
  p_slots           jsonb   -- [{days_of_week:[1,2], start_time:"06:00", end_time:"22:00"}, ...]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_charger_id uuid;
  v_slot       jsonb;
begin
  insert into public.chargers (
    lender_id, title, charger_type, connector_types,
    price_per_kwh, address, latitude, longitude,
    photos, instructions, status
  ) values (
    p_lender_id, p_title, p_charger_type, p_connector_types,
    p_price_per_kwh, p_address, p_latitude, p_longitude,
    p_photos, p_instructions, 'active'
  )
  returning id into v_charger_id;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    insert into public.availability_slots (charger_id, day_of_week, start_time, end_time)
    values (
      v_charger_id,
      (
        select array_agg(elem::int)
        from   jsonb_array_elements_text(v_slot -> 'days_of_week') as elem
      ),
      (v_slot ->> 'start_time')::time,
      (v_slot ->> 'end_time')::time
    );
  end loop;

  return v_charger_id;
end;
$$;
