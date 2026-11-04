-- Customers can cancel only unconfirmed, unpaid orders. The database performs
-- the transition atomically so the existing stock-restoration trigger runs.
alter table public.orders
  add column if not exists cancelled_by text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text not null default '';

alter table public.orders
  drop constraint if exists orders_cancelled_by_check,
  add constraint orders_cancelled_by_check
    check (cancelled_by is null or cancelled_by in ('customer', 'admin')),
  drop constraint if exists orders_cancellation_reason_check,
  add constraint orders_cancellation_reason_check
    check (char_length(cancellation_reason) <= 500);

create or replace function private.cancel_store_order(p_order_id uuid, p_reason text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_cancelled_order_id uuid;
  v_reason text := coalesce(trim(p_reason), '');
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_order_id is null or char_length(v_reason) > 500 then
    raise exception 'INVALID_CANCELLATION' using errcode = '22023';
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_by = 'customer',
      cancelled_at = now(),
      cancellation_reason = v_reason,
      updated_at = now()
  where id = p_order_id
    and user_id = v_user_id
    and status = 'pending_confirmation'
    and payment_status = 'unpaid'
  returning id into v_cancelled_order_id;

  if v_cancelled_order_id is null then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  return v_cancelled_order_id;
end;
$$;

revoke all on function private.cancel_store_order(uuid, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.cancel_store_order(uuid, text) to authenticated;

create or replace function public.cancel_store_order(p_order_id uuid, p_reason text default '')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_store_order(p_order_id, p_reason);
$$;

revoke all on function public.cancel_store_order(uuid, text) from public, anon;
grant execute on function public.cancel_store_order(uuid, text) to authenticated;

-- Add a separate notification event so a customer cancellation email can be
-- sent to the studio exactly once and cannot be forged by another customer.
alter table public.order_notification_events
  drop constraint if exists order_notification_events_event_check;
alter table public.order_notification_events
  add constraint order_notification_events_event_check
    check (event = 'placed' or event = 'payment:paid' or event = 'customer_cancelled' or event like 'status:%');

create or replace function private.claim_order_notification(p_order_id uuid, p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_inserted uuid;
begin
  if v_user is null or (
    p_event <> 'placed'
    and p_event <> 'payment:paid'
    and p_event <> 'customer_cancelled'
    and p_event not like 'status:%'
  ) then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select user_id into v_owner from public.orders where id = p_order_id;
  if v_owner is null or (v_owner <> v_user and not public.is_store_admin()) then
    raise exception 'ORDER_NOT_FOUND' using errcode = '42501';
  end if;
  if p_event = 'placed' and v_owner <> v_user then
    raise exception 'ORDER_NOT_FOUND' using errcode = '42501';
  end if;
  if p_event = 'payment:paid' and (v_owner <> v_user or not exists (
    select 1 from public.orders where id = p_order_id and payment_status = 'paid'
  )) then
    raise exception 'ORDER_NOT_FOUND' using errcode = '42501';
  end if;
  if p_event = 'customer_cancelled' and (v_owner <> v_user or not exists (
    select 1 from public.orders where id = p_order_id and status = 'cancelled' and cancelled_by = 'customer'
  )) then
    raise exception 'ORDER_NOT_FOUND' using errcode = '42501';
  end if;
  if p_event like 'status:%' and not public.is_store_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  insert into public.order_notification_events(order_id, event)
  values (p_order_id, p_event)
  on conflict (order_id, event) do update set status = 'sending'
    where public.order_notification_events.status = 'failed'
  returning id into v_inserted;

  return v_inserted is not null;
end;
$$;

revoke all on function private.claim_order_notification(uuid, text) from public, anon;
grant execute on function private.claim_order_notification(uuid, text) to authenticated;
