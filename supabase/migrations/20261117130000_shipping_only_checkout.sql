create or replace function private.create_checkout_order_once(
  p_attempt_id uuid, p_details jsonb, p_items jsonb,
  p_gift_wrap boolean, p_gift_message text, p_promo_code text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid;
  v_delivery_details jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_attempt_id is null then raise exception 'CHECKOUT_ATTEMPT_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkout:' || v_user_id::text || ':' || p_attempt_id::text, 0)
  );

  select order_id into v_order_id from private.checkout_attempts
    where user_id = v_user_id and attempt_id = p_attempt_id;
  if found then return v_order_id; end if;

  v_delivery_details := coalesce(p_details, '{}'::jsonb)
    || pg_catalog.jsonb_build_object('delivery_method', 'shipping');
  v_order_id := private.create_gift_order_with_promo(
    v_delivery_details, p_items, p_gift_wrap, p_gift_message, p_promo_code
  );

  insert into private.checkout_attempts (user_id, attempt_id, order_id)
    values (v_user_id, p_attempt_id, v_order_id);
  return v_order_id;
end;
$$;
