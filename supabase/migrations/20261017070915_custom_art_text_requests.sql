create table public.custom_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 7 and 25),
  painting_type text not null check (char_length(painting_type) between 2 and 120),
  description text not null check (char_length(description) between 10 and 5000),
  style text not null check (char_length(style) between 2 and 200),
  size text not null check (char_length(size) between 2 and 120),
  dimensions text not null default '' check (char_length(dimensions) <= 120),
  medium text not null check (char_length(medium) between 2 and 200),
  frame text not null check (char_length(frame) between 2 and 200),
  complexity text not null check (char_length(complexity) between 2 and 500),
  priority text not null check (char_length(priority) between 2 and 200),
  colors text not null default '' check (char_length(colors) <= 200),
  budget numeric(12,2) check (budget is null or budget >= 0),
  delivery_date date,
  instructions text not null default '' check (char_length(instructions) <= 5000),
  estimated_price numeric(12,2) not null default 0 check (estimated_price >= 0),
  pricing_snapshot jsonb not null default '{"status":"quote_pending"}'::jsonb,
  production_status text not null default 'submitted' check (production_status in ('submitted','confirmed','in_progress','preview_ready','completed','dispatched','delivered','cancelled','refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid','refunded')),
  internal_notes text not null default '' check (char_length(internal_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_orders enable row level security;
revoke all on public.custom_orders from public, anon, authenticated;
grant select, insert, update on public.custom_orders to authenticated;
create policy custom_orders_customer_insert on public.custom_orders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy custom_orders_customer_read on public.custom_orders for select to authenticated using ((select auth.uid()) = user_id);
create policy custom_orders_admin_read on public.custom_orders for select to authenticated using ((select public.is_store_admin()));
create policy custom_orders_admin_update on public.custom_orders for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create index custom_orders_user_created_idx on public.custom_orders(user_id,created_at desc);

create table public.custom_order_images (
  id uuid primary key default gen_random_uuid(),
  custom_order_id uuid not null references public.custom_orders(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 5000000),
  kind text not null default 'reference' check (kind = 'reference'),
  created_at timestamptz not null default now()
);
alter table public.custom_order_images enable row level security;
revoke all on public.custom_order_images from public, anon, authenticated;
grant select, insert on public.custom_order_images to authenticated;
create policy custom_order_images_customer_insert on public.custom_order_images for insert to authenticated with check (exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid())));
create policy custom_order_images_customer_read on public.custom_order_images for select to authenticated using (exists(select 1 from public.custom_orders o where o.id=custom_order_id and (o.user_id=(select auth.uid()) or (select public.is_store_admin()))));

create table public.custom_order_status_history (
  id uuid primary key default gen_random_uuid(),
  custom_order_id uuid not null references public.custom_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);
alter table public.custom_order_status_history enable row level security;
revoke all on public.custom_order_status_history from public, anon, authenticated;
grant select, insert on public.custom_order_status_history to authenticated;
create policy custom_order_history_read on public.custom_order_status_history for select to authenticated using (exists(select 1 from public.custom_orders o where o.id=custom_order_id and (o.user_id=(select auth.uid()) or (select public.is_store_admin()))));
create policy custom_order_history_admin_insert on public.custom_order_status_history for insert to authenticated with check ((select public.is_store_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('custom-references','custom-references',false,5000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy custom_references_customer_upload on storage.objects for insert to authenticated with check (bucket_id='custom-references' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy custom_references_customer_read on storage.objects for select to authenticated using (bucket_id='custom-references' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_store_admin())));
