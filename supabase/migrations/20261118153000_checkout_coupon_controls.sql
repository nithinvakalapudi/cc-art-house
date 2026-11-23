alter table public.store_promotions
  add column if not exists show_in_cart boolean not null default true,
  add column if not exists first_order_only boolean not null default false;

grant delete on public.store_promotions to authenticated;
drop policy if exists "admins delete promotions" on public.store_promotions;
create policy "admins delete promotions" on public.store_promotions
  for delete to authenticated using ((select public.is_store_admin()));

-- A standing first-order welcome offer. Admins can edit, pause, feature, or
-- delete it from the Promotions portal after this migration is applied.
insert into public.store_promotions
  (code, title, discount_type, discount_value, starts_at, enabled, show_in_cart, first_order_only)
values
  ('WELCOME10', 'Welcome — 10% off your first order', 'percentage', 10, now(), true, true, true)
on conflict (code) do update set
  title = excluded.title,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  enabled = true,
  show_in_cart = true,
  first_order_only = true,
  updated_at = now();

create or replace function public.get_checkout_promotions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_has_orders boolean := false;
  v_promotions jsonb;
begin
  if v_user_id is not null then
    select exists (
      select 1 from public.orders
      where user_id = v_user_id and status <> 'cancelled'
    ) into v_has_orders;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code,
    'title', title,
    'discount_type', discount_type,
    'discount_value', discount_value,
    'first_order_only', first_order_only
  ) order by first_order_only desc, starts_at desc), '[]'::jsonb)
  into v_promotions
  from public.store_promotions
  where enabled and show_in_cart
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (max_redemptions is null or redemption_count < max_redemptions)
    and (not first_order_only or not v_has_orders);

  return v_promotions;
end;
$$;
revoke all on function public.get_checkout_promotions() from public;
grant execute on function public.get_checkout_promotions() to anon, authenticated;

create or replace function private.quote_store_promotion(p_code text,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_promo public.store_promotions%rowtype;
  v_used integer;
  v_discount numeric(12,2);
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_subtotal is null or p_subtotal<=0 then return jsonb_build_object('valid',false,'message','Add a painting to see whether this code applies.'); end if;
  select * into v_promo from public.store_promotions where code=upper(trim(coalesce(p_code,''))) and enabled and starts_at<=now() and (ends_at is null or ends_at>now());
  if not found then return jsonb_build_object('valid',false,'message','That code is not active or has expired.'); end if;
  if v_promo.first_order_only and exists (select 1 from public.orders where user_id=v_user_id and status <> 'cancelled') then
    return jsonb_build_object('valid',false,'message','This welcome coupon is for your first order.');
  end if;
  select count(*) into v_used from public.orders where promotion_id=v_promo.id and status<>'cancelled';
  if v_promo.max_redemptions is not null and v_used>=v_promo.max_redemptions then return jsonb_build_object('valid',false,'message','This code has reached its redemption limit.'); end if;
  v_discount:=case when v_promo.discount_type='percentage' then round(p_subtotal*v_promo.discount_value/100,2) else least(p_subtotal,v_promo.discount_value) end;
  return jsonb_build_object('valid',true,'code',v_promo.code,'title',v_promo.title,'discount_amount',v_discount,'message',v_promo.title||' applied.');
end;
$$;
revoke all on function private.quote_store_promotion(text,numeric) from public,anon,authenticated;
grant execute on function private.quote_store_promotion(text,numeric) to authenticated;
create or replace function public.quote_store_promotion(p_code text,p_subtotal numeric)
returns jsonb language sql security invoker set search_path = '' as $$ select private.quote_store_promotion(p_code,p_subtotal); $$;
revoke all on function public.quote_store_promotion(text,numeric) from public,anon;
grant execute on function public.quote_store_promotion(text,numeric) to authenticated;

create or replace function private.create_gift_order_with_promo(p_details jsonb,p_items jsonb,p_gift_wrap boolean,p_gift_message text,p_promo_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_fee numeric;
  v_priced boolean:=false;
  v_details jsonb;
  v_verified_email text;
  v_subtotal numeric;
  v_discount numeric:=0;
  v_promo public.store_promotions%rowtype;
  v_used integer;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE'; end if;
  select email into v_verified_email from auth.users where id=v_user_id and email_confirmed_at is not null;
  v_details:=p_details||jsonb_build_object('customer_email',coalesce(v_verified_email,''));
  if nullif(trim(p_promo_code),'') is not null then
    select * into v_promo from public.store_promotions where code=upper(trim(p_promo_code)) for update;
    if not found or not v_promo.enabled or v_promo.starts_at>now() or (v_promo.ends_at is not null and v_promo.ends_at<=now()) then raise exception 'PROMO_INVALID'; end if;
    if v_promo.first_order_only and exists (select 1 from public.orders where user_id=v_user_id and status <> 'cancelled') then raise exception 'PROMO_FIRST_ORDER_ONLY'; end if;
    select count(*) into v_used from public.orders where promotion_id=v_promo.id and status<>'cancelled';
    if v_promo.max_redemptions is not null and v_used>=v_promo.max_redemptions then raise exception 'PROMO_EXHAUSTED'; end if;
  end if;
  v_id:=private.create_store_order(v_details->>'customer_name',v_details->>'customer_email',v_details->>'phone',v_details->>'address_line1',v_details->>'address_line2',v_details->>'city',v_details->>'state',v_details->>'postal_code',v_details->>'country',v_details->>'delivery_method',v_details->>'delivery_notes',v_details->>'payment_method',p_items);
  select subtotal into v_subtotal from public.orders where id=v_id and user_id=v_user_id;
  if v_promo.id is not null then
    v_discount:=case when v_promo.discount_type='percentage' then round(v_subtotal*v_promo.discount_value/100,2) else least(v_subtotal,v_promo.discount_value) end;
  end if;
  if v_details->>'delivery_method'='pickup' then v_fee:=0;v_priced:=true;
  else select case when v_subtotal>=2000 then 0 else r.fee end into v_fee from public.delivery_rates r where r.active and upper(v_details->>'postal_code') like upper(r.postal_prefix)||'%' order by length(r.postal_prefix) desc limit 1; v_priced:=found;
  end if;
  update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,''),delivery_fee=coalesce(v_fee,0),delivery_priced=v_priced,discount_amount=v_discount,promotion_id=v_promo.id,promotion_code=v_promo.code where id=v_id and user_id=v_user_id;
  if v_promo.id is not null then update public.store_promotions set redemption_count=redemption_count+1,updated_at=now() where id=v_promo.id; end if;
  return v_id;
end;
$$;
revoke all on function private.create_gift_order_with_promo(jsonb,jsonb,boolean,text,text) from public,anon,authenticated;
grant execute on function private.create_gift_order_with_promo(jsonb,jsonb,boolean,text,text) to authenticated;
create or replace function public.create_gift_order_with_promo(p_details jsonb,p_items jsonb,p_gift_wrap boolean default false,p_gift_message text default '',p_promo_code text default null)
returns uuid language sql security invoker set search_path = '' as $$ select private.create_gift_order_with_promo(p_details,p_items,p_gift_wrap,p_gift_message,p_promo_code); $$;
revoke all on function public.create_gift_order_with_promo(jsonb,jsonb,boolean,text,text) from public,anon;
grant execute on function public.create_gift_order_with_promo(jsonb,jsonb,boolean,text,text) to authenticated;
