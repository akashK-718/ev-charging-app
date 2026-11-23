-- Check new reservations against the weekly schedule in the charger's Indian local time.
create or replace function public.check_booking_operating_hours()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  starts timestamp := new.scheduled_start at time zone 'Asia/Kolkata';
  ends timestamp := new.scheduled_end at time zone 'Asia/Kolkata';
  covered tsmultirange;
begin
  if starts is null or ends is null or ends <= starts or ends - starts > interval '12 hours' then
    raise exception 'SLOT_CONFLICT: invalid booking interval';
  end if;
  perform id from public.chargers where id = new.charger_id for update;
  select range_agg(tsrange(day::date + s.start_time,
    day::date + s.end_time + case
      when s.start_time = time '00:00' and s.end_time = time '23:59' then interval '1 minute'
      when s.end_time < s.start_time then interval '1 day'
      else interval '0' end, '[)'))
    into covered
    from generate_series(starts::date - interval '1 day', ends::date::timestamp, interval '1 day') day
    join public.availability_slots s on s.charger_id = new.charger_id and s.is_active
      and extract(dow from day)::int = any(s.day_of_week);
  if covered is null or not (covered @> tsrange(starts, ends, '[)')) then
    raise exception 'SLOT_CONFLICT: outside host operating hours';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_operating_hours on public.bookings;
create trigger booking_operating_hours before insert or update of charger_id, scheduled_start, scheduled_end
on public.bookings for each row execute function public.check_booking_operating_hours();

-- The listing and its replacement schedule commit together, using the same charger lock as bookings.
create or replace function public.edit_charger_with_hours(p_id uuid, p_owner uuid, p_changes jsonb, p_slots jsonb)
returns public.chargers language plpgsql set search_path = public, pg_temp as $$
declare
  edited public.chargers;
begin
  select * into strict edited from public.chargers
    where id = p_id and lender_id = p_owner and deleted_at is null for update;
  if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Choose operating hours for at least one day';
  end if;
  edited := jsonb_populate_record(edited, p_changes);
  update public.chargers set title = edited.title, charger_type = edited.charger_type,
    connector_types = edited.connector_types, price_per_kwh = edited.price_per_kwh,
    address = edited.address, latitude = edited.latitude, longitude = edited.longitude,
    photos = edited.photos, instructions = edited.instructions, updated_at = now()
    where id = p_id returning * into edited;
  delete from public.availability_slots where charger_id = p_id;
  insert into public.availability_slots(charger_id, day_of_week, start_time, end_time)
    select p_id, array[s.day_of_week], s.start_time, s.end_time
    from jsonb_to_recordset(p_slots) as s(day_of_week int, start_time time, end_time time);
  return edited;
end;
$$;
revoke all on function public.edit_charger_with_hours(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.edit_charger_with_hours(uuid,uuid,jsonb,jsonb) to service_role;
