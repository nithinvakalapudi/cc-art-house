-- Inventory, promotion, fulfillment, customer notes, and admin activity.
-- Inventory is explicitly tracked; one-off paintings default to one in stock.
alter table public.products
  add column if not exists stock_quantity integer,
  add column if not exists low_stock_threshold integer not null default 1;

update public.products
set stock_quantity = case when available then 1 else 0 end
where stock_quantity is null;

alter table public.products
  drop constraint if exists products_stock_quantity_check,
  drop constraint if exists products_low_stock_threshold_check;
alter table public.products
  add constraint products_stock_quantity_check check (stock_quantity is null or stock_quantity >= 0),
  add constraint products_low_stock_threshold_check check (low_stock_threshold between 0 and 100000);
create index if not exists products_low_stock_idx on public.products (stock_quantity) where stock_quantity is not null and stock_quantity > 0;

alter table public.orders
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists fulfillment_note text not null default '',
  add column if not exists promotion_id uuid,
  add column if not exists promotion_code text,
  add column if not exists discount_amount numeric(12,2) not null default 0;

alter table public.orders alter column total set expression as (subtotal - discount_amount + delivery_fee);
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending_confirmation','confirmed','preparing','ready_for_pickup','shipped','delivered','cancelled'));
alter table public.orders add constraint orders_discount_amount_check check (discount_amount >= 0 and discount_amount <= subtotal);
alter table public.orders add constraint orders_fulfillment_note_check check (char_length(fulfillment_note) <= 1000);
alter table public.orders add constraint orders_tracking_carrier_check check (tracking_carrier is null or char_length(tracking_carrier) <= 120);
alter table public.orders add constraint orders_tracking_number_check check (tracking_number is null or char_length(tracking_number) <= 160);
alter table public.orders add constraint orders_tracking_url_check check (tracking_url is null or char_length(tracking_url) <= 1000);

create table if not exists public.store_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  title text not null check (char_length(title) between 2 and 120),
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0 and (discount_type <> 'percentage' or discount_value <= 95)),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.store_promotions enable row level security;
grant select, insert, update on public.store_promotions to authenticated;
create policy "portal users read promotions" on public.store_promotions for select to authenticated using (private.is_store_portal_user());
create policy "admins create promotions" on public.store_promotions for insert to authenticated with check ((select public.is_store_admin()));
create policy "admins update promotions" on public.store_promotions for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
alter table public.orders add constraint orders_promotion_id_fkey foreign key (promotion_id) references public.store_promotions(id) on delete set null;

create table if not exists public.admin_customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null unique check (char_length(customer_email) between 3 and 254),
  customer_name text not null default '',
  note text not null default '' check (char_length(note) <= 4000),
  tags text[] not null default '{}',
  follow_up_on date,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_customer_notes enable row level security;
grant select, insert, update on public.admin_customer_notes to authenticated;
create policy "portal users read customer notes" on public.admin_customer_notes for select to authenticated using (private.is_store_portal_user());
create policy "admins add customer notes" on public.admin_customer_notes for insert to authenticated with check ((select public.is_store_admin()));
create policy "admins update customer notes" on public.admin_customer_notes for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create index if not exists admin_customer_notes_follow_up_idx on public.admin_customer_notes (follow_up_on) where follow_up_on is not null;

create table if not exists public.admin_activity_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_activity_log enable row level security;
grant select on public.admin_activity_log to authenticated;
create policy "portal users read activity log" on public.admin_activity_log for select to authenticated using (private.is_store_portal_user());
create index if not exists admin_activity_log_created_idx on public.admin_activity_log (created_at desc);
create index if not exists admin_activity_log_entity_idx on public.admin_activity_log (entity_type, entity_id, created_at desc);

-- Track meaningful admin changes without recording customer addresses, private notes, or messages.
create or replace function private.log_store_admin_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb; v_entity_id text; v_action text; v_summary jsonb; v_email text;
begin
  if not (select public.is_store_admin()) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  v_old := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_action := lower(tg_op);
  v_entity_id := coalesce(v_new->>'id', v_new->>'key', v_new->>'code', v_old->>'id', v_old->>'key', v_old->>'code', 'unknown');
  if tg_table_name = 'products' then
    v_summary := jsonb_build_object('title',coalesce(v_new->>'title',v_old->>'title'),'price',coalesce(v_new->>'price',v_old->>'price'),'original_price',coalesce(v_new->>'original_price',v_old->>'original_price'),'available',coalesce(v_new->>'available',v_old->>'available'),'published',coalesce(v_new->>'published',v_old->>'published'),'stock_quantity',coalesce(v_new->>'stock_quantity',v_old->>'stock_quantity'));
  elsif tg_table_name = 'orders' then
    v_summary := jsonb_build_object('status',coalesce(v_new->>'status',v_old->>'status'),'payment_status',coalesce(v_new->>'payment_status',v_old->>'payment_status'),'total',coalesce(v_new->>'total',v_old->>'total'),'promotion_code',coalesce(v_new->>'promotion_code',v_old->>'promotion_code'),'tracking_number',coalesce(v_new->>'tracking_number',v_old->>'tracking_number'));
  elsif tg_table_name = 'site_settings' then
    v_summary := jsonb_build_object('key',coalesce(v_new->>'key',v_old->>'key'),'section',coalesce(v_new->>'section',v_old->>'section'));
  elsif tg_table_name = 'store_promotions' then
    v_summary := jsonb_build_object('code',coalesce(v_new->>'code',v_old->>'code'),'discount_type',coalesce(v_new->>'discount_type',v_old->>'discount_type'),'discount_value',coalesce(v_new->>'discount_value',v_old->>'discount_value'),'enabled',coalesce(v_new->>'enabled',v_old->>'enabled'));
  else
    v_summary := '{}'::jsonb;
  end if;
  select email into v_email from auth.users where id = (select auth.uid());
  insert into public.admin_activity_log(actor_user_id,actor_email,action,entity_type,entity_id,summary)
  values((select auth.uid()),v_email,v_action,tg_table_name,v_entity_id,v_summary);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.log_store_admin_activity() from public, anon, authenticated;
create trigger admin_activity_products after insert or update or delete on public.products for each row execute function private.log_store_admin_activity();
create trigger admin_activity_orders after insert or update or delete on public.orders for each row execute function private.log_store_admin_activity();
create trigger admin_activity_site_settings after insert or update or delete on public.site_settings for each row execute function private.log_store_admin_activity();
create trigger admin_activity_promotions after insert or update or delete on public.store_promotions for each row execute function private.log_store_admin_activity();

-- Extend the existing one-of-a-kind checkout routine to decrement tracked stock.
alter table public.order_items drop constraint if exists order_items_quantity_check;
alter table public.order_items add constraint order_items_quantity_check check (quantity between 1 and 50);

create or replace function private.create_store_order(
  p_customer_name text, p_customer_email text, p_phone text,
  p_address_line1 text, p_address_line2 text, p_city text, p_state text,
  p_postal_code text, p_country text, p_delivery_method text, p_delivery_notes text,
  p_payment_method text, p_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid()); v_email text := nullif(lower(trim(p_customer_email)), ''); v_order_id uuid;
  v_item record; v_product record; v_item_count integer; v_distinct_count integer; v_subtotal numeric(12,2) := 0; v_snapshots jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_customer_name is null or char_length(trim(p_customer_name)) not between 2 and 120 then raise exception 'INVALID_NAME'; end if;
  if p_phone is null or char_length(trim(p_phone)) not between 7 and 24 then raise exception 'INVALID_PHONE'; end if;
  if p_delivery_method not in ('shipping','pickup') then raise exception 'INVALID_DELIVERY_METHOD'; end if;
  if p_payment_method is null or p_payment_method not in ('to_be_arranged','cash_on_delivery','upi','bank_transfer','razorpay') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_delivery_notes is not null and char_length(p_delivery_notes)>1000 then raise exception 'INVALID_DELIVERY_NOTES'; end if;
  if p_delivery_method='shipping' and (p_address_line1 is null or char_length(trim(p_address_line1)) not between 4 and 180 or p_city is null or char_length(trim(p_city)) not between 2 and 100 or p_state is null or char_length(trim(p_state)) not between 2 and 100 or p_postal_code is null or char_length(trim(p_postal_code)) not between 4 and 12 or p_country is null or char_length(trim(p_country)) not between 2 and 80) then raise exception 'INVALID_SHIPPING_ADDRESS'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_ITEMS'; end if;
  select count(*),count(distinct x.product_id) into v_item_count,v_distinct_count from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer);
  if v_item_count<1 or v_item_count>20 or v_item_count<>v_distinct_count or exists(select 1 from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer) where product_id is null or quantity not between 1 and 50) then raise exception 'INVALID_ITEMS'; end if;
  if v_email is null then select lower(email) into v_email from auth.users where id=v_user_id; end if;
  if v_email is not null and (char_length(v_email)>254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'INVALID_EMAIL'; end if;
  for v_item in select x.product_id,x.quantity from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer) order by x.product_id loop
    select id,slug,title,price,image_url,stock_quantity into v_product from public.products where id=v_item.product_id and published and not archived and available for update;
    if not found or (v_product.stock_quantity is not null and v_product.stock_quantity<v_item.quantity) then raise exception 'SOLD_OR_UNAVAILABLE'; end if;
    if v_product.price<=0 then raise exception 'PRICE_ON_REQUEST'; end if;
    v_subtotal:=v_subtotal+(v_product.price*v_item.quantity);
    v_snapshots:=v_snapshots||jsonb_build_array(jsonb_build_object('product_id',v_product.id,'product_title',v_product.title,'product_slug',v_product.slug,'image_url',v_product.image_url,'unit_price',v_product.price,'quantity',v_item.quantity));
  end loop;
  insert into public.orders(user_id,customer_name,customer_email,phone,address_line1,address_line2,city,state,postal_code,country,delivery_method,delivery_notes,payment_method,subtotal)
  values(v_user_id,trim(p_customer_name),v_email,trim(p_phone),coalesce(trim(p_address_line1),''),coalesce(trim(p_address_line2),''),coalesce(trim(p_city),''),coalesce(trim(p_state),''),coalesce(trim(p_postal_code),''),coalesce(trim(p_country),''),p_delivery_method,coalesce(trim(p_delivery_notes),''),p_payment_method,v_subtotal) returning id into v_order_id;
  insert into public.order_items(order_id,product_id,product_title,product_slug,image_url,unit_price,quantity)
  select v_order_id,x.product_id,x.product_title,x.product_slug,x.image_url,x.unit_price,x.quantity from jsonb_to_recordset(v_snapshots) as x(product_id uuid,product_title text,product_slug text,image_url text,unit_price numeric,quantity integer);
  update public.products p set stock_quantity=case when p.stock_quantity is null then null else p.stock_quantity-x.quantity end,available=case when p.stock_quantity is null then false else p.stock_quantity>x.quantity end
  from jsonb_to_recordset(v_snapshots) as x(product_id uuid,quantity integer) where p.id=x.product_id;
  return v_order_id;
end;
$$;
revoke all on function private.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function private.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function private.restore_cancelled_order_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    update public.products p set stock_quantity=p.stock_quantity+i.quantity,available=(not p.archived and p.published)
    from public.order_items i where i.order_id=new.id and i.product_id=p.id and p.stock_quantity is not null;
    if old.promotion_id is not null then update public.store_promotions set redemption_count=greatest(0,redemption_count-1) where id=old.promotion_id; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.restore_cancelled_order_stock() from public,anon,authenticated;
create trigger restore_order_reservations_on_cancel after update of status on public.orders for each row execute function private.restore_cancelled_order_stock();

create or replace function private.quote_store_promotion(p_code text,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_promo public.store_promotions%rowtype; v_used integer; v_discount numeric(12,2);
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_subtotal is null or p_subtotal<=0 then return jsonb_build_object('valid',false,'message','Add a painting to see whether this code applies.'); end if;
  select * into v_promo from public.store_promotions where code=upper(trim(coalesce(p_code,''))) and enabled and starts_at<=now() and (ends_at is null or ends_at>now());
  if not found then return jsonb_build_object('valid',false,'message','That code is not active or has expired.'); end if;
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
declare v_id uuid; v_fee numeric; v_priced boolean:=false; v_details jsonb; v_verified_email text; v_subtotal numeric; v_discount numeric:=0; v_promo public.store_promotions%rowtype; v_used integer;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE'; end if;
  select email into v_verified_email from auth.users where id=(select auth.uid()) and email_confirmed_at is not null;
  v_details:=p_details||jsonb_build_object('customer_email',coalesce(v_verified_email,''));
  if nullif(trim(p_promo_code),'') is not null then
    select * into v_promo from public.store_promotions where code=upper(trim(p_promo_code)) for update;
    if not found or not v_promo.enabled or v_promo.starts_at>now() or (v_promo.ends_at is not null and v_promo.ends_at<=now()) then raise exception 'PROMO_INVALID'; end if;
    select count(*) into v_used from public.orders where promotion_id=v_promo.id and status<>'cancelled';
    if v_promo.max_redemptions is not null and v_used>=v_promo.max_redemptions then raise exception 'PROMO_EXHAUSTED'; end if;
  end if;
  v_id:=private.create_store_order(v_details->>'customer_name',v_details->>'customer_email',v_details->>'phone',v_details->>'address_line1',v_details->>'address_line2',v_details->>'city',v_details->>'state',v_details->>'postal_code',v_details->>'country',v_details->>'delivery_method',v_details->>'delivery_notes',v_details->>'payment_method',p_items);
  select subtotal into v_subtotal from public.orders where id=v_id and user_id=(select auth.uid());
  if v_promo.id is not null then
    v_discount:=case when v_promo.discount_type='percentage' then round(v_subtotal*v_promo.discount_value/100,2) else least(v_subtotal,v_promo.discount_value) end;
  end if;
  if v_details->>'delivery_method'='pickup' then v_fee:=0;v_priced:=true;
  else select case when v_subtotal>=2000 then 0 else r.fee end into v_fee from public.delivery_rates r where r.active and upper(v_details->>'postal_code') like upper(r.postal_prefix)||'%' order by length(r.postal_prefix) desc limit 1; v_priced:=found;
  end if;
  update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,''),delivery_fee=coalesce(v_fee,0),delivery_priced=v_priced,discount_amount=v_discount,promotion_id=v_promo.id,promotion_code=v_promo.code where id=v_id and user_id=(select auth.uid());
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
