create table private.checkout_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  order_id uuid not null,
  primary key (user_id, attempt_id)
);

alter table private.checkout_attempts enable row level security;
revoke all on private.checkout_attempts from public, anon, authenticated;

create function private.create_checkout_order_once(
  p_attempt_id uuid, p_details jsonb, p_items jsonb,
  p_gift_wrap boolean, p_gift_message text, p_promo_code text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_attempt_id is null then raise exception 'CHECKOUT_ATTEMPT_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkout:' || v_user_id::text || ':' || p_attempt_id::text, 0)
  );

  select order_id into v_order_id from private.checkout_attempts
    where user_id = v_user_id and attempt_id = p_attempt_id;
  if found then return v_order_id; end if;

  v_order_id := private.create_gift_order_with_promo(
    p_details, p_items, p_gift_wrap, p_gift_message, p_promo_code
  );

  insert into private.checkout_attempts (user_id, attempt_id, order_id)
    values (v_user_id, p_attempt_id, v_order_id);
  return v_order_id;
end;
$$;

create function public.create_checkout_order_once(
  p_attempt_id uuid, p_details jsonb, p_items jsonb,
  p_gift_wrap boolean, p_gift_message text, p_promo_code text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_checkout_order_once(
    p_attempt_id, p_details, p_items, p_gift_wrap, p_gift_message, p_promo_code
  );
$$;

revoke all on function private.create_checkout_order_once(uuid,jsonb,jsonb,boolean,text,text) from public,anon,authenticated;
revoke all on function public.create_checkout_order_once(uuid,jsonb,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function private.create_checkout_order_once(uuid,jsonb,jsonb,boolean,text,text) to authenticated;
grant execute on function public.create_checkout_order_once(uuid,jsonb,jsonb,boolean,text,text) to authenticated;
