-- Art Store catalogue and access control. Safe to rerun on this new project.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin'))
);

create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('owner', 'admin')
  );
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  medium text,
  dimensions text,
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  published boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists products_public_listing_idx
  on public.products (created_at desc) where published and not archived;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0
);

alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

create policy "users read own role" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admins read roles" on public.user_roles
  for select to authenticated using (public.is_store_admin());

create policy "visitors read published categories" on public.categories
  for select to anon, authenticated using (published);
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

create policy "visitors read published products" on public.products
  for select to anon, authenticated using (published and not archived);
create policy "admins manage products" on public.products
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

create policy "visitors read public product images" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p
      where p.id = product_id and p.published and not p.archived)
  );
create policy "admins manage product images" on public.product_images
  for all to authenticated using (public.is_store_admin())
  with check (public.is_store_admin());

insert into public.categories (slug, name, published, sort_order) values
  ('abstract', 'Abstract', true, 1),
  ('landscapes', 'Landscapes', true, 2),
  ('portraits', 'Portraits', true, 3),
  ('florals', 'Florals', true, 4)
on conflict (slug) do nothing;
