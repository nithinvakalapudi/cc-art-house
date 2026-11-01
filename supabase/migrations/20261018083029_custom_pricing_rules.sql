create table if not exists public.custom_pricing_rules(
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in('size','style','medium','frame','complexity','priority')),
  option_key text not null check(option_key ~ '^[a-z0-9_-]{2,80}$'),
  label text not null check(char_length(label) between 2 and 120),
  amount numeric(12,2) not null default 0 check(amount>=0),
  active boolean not null default true,
  sort_order integer not null default 0 check(sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind,option_key)
);
alter table public.custom_pricing_rules enable row level security;
revoke all on public.custom_pricing_rules from public,anon,authenticated;
grant select on public.custom_pricing_rules to anon,authenticated;
grant insert,update,delete on public.custom_pricing_rules to authenticated;
create policy pricing_public_read on public.custom_pricing_rules for select to anon,authenticated using(active or public.is_store_admin());
create policy pricing_admin_insert on public.custom_pricing_rules for insert to authenticated with check(public.is_store_admin());
create policy pricing_admin_update on public.custom_pricing_rules for update to authenticated using(public.is_store_admin()) with check(public.is_store_admin());
create policy pricing_admin_delete on public.custom_pricing_rules for delete to authenticated using(public.is_store_admin());
create index custom_pricing_rules_active_sort_idx on public.custom_pricing_rules(active,kind,sort_order);

insert into public.custom_pricing_rules(kind,option_key,label,amount,sort_order) values
('size','custom','Custom size',0,10),('style','personal','Personal style',0,10),('medium','artist_choice','Artist recommendation',0,10),('frame','discuss','Discuss with studio',0,10),('complexity','quoted','Based on your brief',0,10),('priority','standard','Standard studio schedule',0,10)
on conflict(kind,option_key) do nothing;
