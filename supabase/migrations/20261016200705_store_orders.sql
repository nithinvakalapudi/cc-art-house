-- One-off original paintings: checkout locks each product, snapshots its current price,
-- creates the order and order lines atomically, then removes it from the available catalogue.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  phone text not null check (char_length(phone) between 7 and 24),
  address_line1 text not null check (char_length(address_line1) between 4 and 180),
  address_line2 text not null default '' check (char_length(address_line2) <= 180),
  city text not null check (char_length(city) between 2 and 100),
  state text not null check (char_length(state) between 2 and 100),
  postal_code text not null check (char_length(postal_code) between 4 and 12),
  country text not null check (char_length(country) between 2 and 80),
  delivery_method text not null default 'shipping' check (delivery_method in ('shipping', 'pickup')),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 1000),
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'refunded')),
  payment_method text not null default 'to_be_arranged' check (payment_method in ('to_be_arranged', 'cash_on_delivery', 'upi', 'bank_transfer')),
  subtotal numeric(12,2) not null check (subtotal > 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) generated always as (subtotal + delivery_fee) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  product_slug text not null,
  image_url text,
  unit_price numeric(12,2) not null check (unit_price > 0),
  quantity integer not null default 1 check (quantity = 1),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);

create index if not exists orders_customer_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "customers and admins read orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_store_admin()));
create policy "admins update orders" on public.orders
  for update to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
create policy "customers and admins read order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
      and (o.user_id = (select auth.uid()) or (select public.is_store_admin())))
  );

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

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
