-- Let checkout support either a delivery address or studio collection, and save the customer's payment preference.
drop function if exists public.create_store_order(text,text,text,text,text,text,text,text,text,text,text,jsonb);
drop function if exists private.create_store_order(text,text,text,text,text,text,text,text,text,text,text,jsonb);

alter table public.orders drop constraint if exists orders_address_line1_check;
alter table public.orders drop constraint if exists orders_city_check;
alter table public.orders drop constraint if exists orders_state_check;
alter table public.orders drop constraint if exists orders_postal_code_check;
alter table public.orders drop constraint if exists orders_country_check;
alter table public.orders add constraint orders_address_line1_check check (delivery_method = 'pickup' or char_length(address_line1) between 4 and 180);
alter table public.orders add constraint orders_city_check check (delivery_method = 'pickup' or char_length(city) between 2 and 100);
alter table public.orders add constraint orders_state_check check (delivery_method = 'pickup' or char_length(state) between 2 and 100);
alter table public.orders add constraint orders_postal_code_check check (delivery_method = 'pickup' or char_length(postal_code) between 4 and 12);
alter table public.orders add constraint orders_country_check check (delivery_method = 'pickup' or char_length(country) between 2 and 80);
create or replace function private.create_store_order(
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_country text,
  p_delivery_method text,
  p_delivery_notes text,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := nullif(lower(trim(p_customer_email)), '');
  v_order_id uuid;
  v_item record;
  v_product record;
  v_item_count integer;
  v_distinct_count integer;
  v_subtotal numeric(12,2) := 0;
  v_snapshots jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_customer_name is null or char_length(trim(p_customer_name)) not between 2 and 120 then raise exception 'INVALID_NAME'; end if;
  if p_phone is null or char_length(trim(p_phone)) not between 7 and 24 then raise exception 'INVALID_PHONE'; end if;
  if p_delivery_method not in ('shipping', 'pickup') then raise exception 'INVALID_DELIVERY_METHOD'; end if;
  if p_payment_method is null or p_payment_method not in ('to_be_arranged', 'cash_on_delivery', 'upi', 'bank_transfer') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_delivery_notes is not null and char_length(p_delivery_notes) > 1000 then raise exception 'INVALID_DELIVERY_NOTES'; end if;
  if p_delivery_method = 'shipping' and (
    p_address_line1 is null or char_length(trim(p_address_line1)) not between 4 and 180 or
    p_city is null or char_length(trim(p_city)) not between 2 and 100 or
    p_state is null or char_length(trim(p_state)) not between 2 and 100 or
    p_postal_code is null or char_length(trim(p_postal_code)) not between 4 and 12 or
    p_country is null or char_length(trim(p_country)) not between 2 and 80
  ) then raise exception 'INVALID_SHIPPING_ADDRESS'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_ITEMS'; end if;
  select count(*), count(distinct x.product_id) into v_item_count, v_distinct_count
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer);
  if v_item_count < 1 or v_item_count > 20 or v_item_count <> v_distinct_count then raise exception 'INVALID_ITEMS'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer) where product_id is null or quantity <> 1) then raise exception 'INVALID_ITEMS'; end if;

  if v_email is null then
    select lower(email) into v_email from auth.users where id = v_user_id;
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'INVALID_EMAIL'; end if;

  for v_item in
    select x.product_id, x.quantity from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer) order by x.product_id
  loop
    select id, slug, title, price, image_url into v_product from public.products
      where id = v_item.product_id and published and not archived and available for update;
    if not found then raise exception 'SOLD_OR_UNAVAILABLE'; end if;
    if v_product.price <= 0 then raise exception 'PRICE_ON_REQUEST'; end if;
    v_subtotal := v_subtotal + v_product.price;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'product_title', v_product.title,
      'product_slug', v_product.slug, 'image_url', v_product.image_url,
      'unit_price', v_product.price, 'quantity', 1
    ));
  end loop;

  insert into public.orders (
    user_id, customer_name, customer_email, phone, address_line1, address_line2,
    city, state, postal_code, country, delivery_method, delivery_notes, payment_method, subtotal
  ) values (
    v_user_id, trim(p_customer_name), v_email, trim(p_phone), coalesce(trim(p_address_line1), ''),
    coalesce(trim(p_address_line2), ''), coalesce(trim(p_city), ''), coalesce(trim(p_state), ''),
    coalesce(trim(p_postal_code), ''), coalesce(trim(p_country), ''), p_delivery_method,
    coalesce(trim(p_delivery_notes), ''), p_payment_method, v_subtotal
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_title, product_slug, image_url, unit_price, quantity)
    select v_order_id, x.product_id, x.product_title, x.product_slug, x.image_url, x.unit_price, x.quantity
    from jsonb_to_recordset(v_snapshots) as x(product_id uuid, product_title text, product_slug text, image_url text, unit_price numeric, quantity integer);

  update public.products set available = false
    where id in (select x.product_id from jsonb_to_recordset(v_snapshots) as x(product_id uuid));
  return v_order_id;
end;
$$;

revoke all on function private.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public, anon;
grant execute on function private.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.create_store_order(
  p_customer_name text, p_customer_email text, p_phone text,
  p_address_line1 text, p_address_line2 text, p_city text, p_state text,
  p_postal_code text, p_country text, p_delivery_method text, p_delivery_notes text, p_payment_method text, p_items jsonb
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_store_order(
    p_customer_name, p_customer_email, p_phone, p_address_line1, p_address_line2,
    p_city, p_state, p_postal_code, p_country, p_delivery_method, p_delivery_notes, p_payment_method, p_items
  );
$$;
revoke all on function public.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.create_store_order(text,text,text,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;
