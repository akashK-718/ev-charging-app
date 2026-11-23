-- Migration 011 installed an update trigger on payouts before the table had this column.
alter table public.payouts add column if not exists updated_at timestamptz default now();

-- Record manual settlement atomically. This function makes no provider calls.
create or replace function public.record_processed_payout(p_id uuid, p_admin uuid, p_hold_hours integer)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  item public.payouts;
  processed_time timestamptz := now();
  released_count integer;
  released_total bigint;
begin
  if not exists (select 1 from public.users where id = p_admin and is_admin) then
    raise exception 'PAYOUT_FORBIDDEN';
  end if;
  select * into item from public.payouts where id = p_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if item.status <> 'pending' then raise exception 'PAYOUT_ALREADY_REVIEWED'; end if;

  if p_hold_hours is null or p_hold_hours < 0 then raise exception 'Invalid hold'; end if;
  if exists (select 1 from public.bookings where id = any(item.booking_ids)
      and actual_end > processed_time - make_interval(hours => p_hold_hours)) then
    raise exception 'PAYOUT_ON_HOLD';
  end if;

  with released as (
    update public.payments p set payout_released_at = processed_time, status = 'transferred'
    from public.bookings b where b.id = p.booking_id and b.id = any(item.booking_ids)
      and b.lender_id = item.user_id and b.status = 'completed'
      and b.actual_end <= processed_time - make_interval(hours => p_hold_hours)
      and p.status = 'paid' and p.payout_released_at is null
    returning p.lender_payout
  )
  select count(*), sum(lender_payout) into released_count, released_total from released;
  if released_count = 0 or released_count <> cardinality(item.booking_ids) or released_total <> item.amount_paise then
    raise exception 'PAYOUT_RECONCILIATION_FAILED';
  end if;

  update public.payouts set status = 'completed', processed_at = processed_time where id = p_id;
  insert into public.audit_log(admin_user_id, action_type, target_user_id, metadata)
    values (p_admin, 'payout_processed', item.user_id,
      jsonb_build_object('payout_id', p_id, 'amount_paise', item.amount_paise));
  insert into public.notifications(user_id, type, data)
    values (item.user_id, 'payout_processed',
      jsonb_build_object('payout_id', p_id, 'amount_paise', item.amount_paise, 'booking_count', released_count));
end;
$$;
revoke all on function public.record_processed_payout(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_processed_payout(uuid,uuid,integer) to service_role;
