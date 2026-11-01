alter table public.products add column if not exists inspiration text;
alter table public.products add column if not exists care_instructions text;
alter table public.products add column if not exists creation_hours integer check(creation_hours is null or creation_hours between 1 and 10000);
alter table public.products add column if not exists edition_number integer check(edition_number is null or edition_number > 0);
alter table public.products add column if not exists edition_total integer check(edition_total is null or edition_total > 0);
alter table public.products add column if not exists authenticity_code text unique;
alter table public.products add column if not exists palette text[] not null default '{}';
alter table public.products add column if not exists room_tags text[] not null default '{}';
alter table public.products add column if not exists artist_video_url text;
alter table public.products add column if not exists reference_image_url text;
alter table public.products add column if not exists completed_image_url text;
alter table public.products add column if not exists reservation_enabled boolean not null default true;
alter table public.products add column if not exists reservation_hours integer not null default 24 check(reservation_hours between 1 and 72);
update public.products set authenticity_code='CCA-'||upper(substr(replace(id::text,'-',''),1,10)) where authenticity_code is null;
alter table public.products alter column authenticity_code set not null;

alter table public.orders add column if not exists scheduled_delivery_date date;
alter table public.orders add column if not exists hide_price_in_package boolean not null default false;
alter table public.orders add column if not exists handwritten_note text not null default '' check(char_length(handwritten_note)<=500);
alter table public.orders add column if not exists whatsapp_opt_in boolean not null default false;
alter table public.orders add column if not exists packaging_status text not null default 'awaiting_artwork' check(packaging_status in('awaiting_artwork','quality_check','protective_wrap','framed','packed','dispatched','delivered'));

create table public.custom_order_quotes(
 id uuid primary key default gen_random_uuid(),custom_order_id uuid not null unique references public.custom_orders(id) on delete cascade,
 amount numeric(12,2) not null check(amount>0),advance_amount numeric(12,2) not null default 0 check(advance_amount>=0 and advance_amount<=amount),
 estimated_completion_date date,terms text not null default '' check(char_length(terms)<=3000),status text not null default 'sent' check(status in('draft','sent','accepted','declined','expired')),
 customer_responded_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.custom_order_quotes enable row level security;
revoke all on public.custom_order_quotes from public,anon,authenticated;grant select,insert,update on public.custom_order_quotes to authenticated;
create policy quote_customer_read on public.custom_order_quotes for select to authenticated using(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid())));
create policy quote_customer_respond on public.custom_order_quotes for update to authenticated using(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid()))) with check(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid())));
create policy quote_admin_manage on public.custom_order_quotes for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()));

create table public.custom_order_previews(
 id uuid primary key default gen_random_uuid(),custom_order_id uuid not null references public.custom_orders(id) on delete cascade,
 image_url text not null,caption text not null default '',revision_number integer not null default 1,
 status text not null default 'awaiting_approval' check(status in('awaiting_approval','approved','changes_requested')),
 customer_note text not null default '' check(char_length(customer_note)<=1500),created_at timestamptz not null default now(),responded_at timestamptz
);
alter table public.custom_order_previews enable row level security;
revoke all on public.custom_order_previews from public,anon,authenticated;grant select,insert,update on public.custom_order_previews to authenticated;
create policy preview_customer_read on public.custom_order_previews for select to authenticated using(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid())));
create policy preview_customer_respond on public.custom_order_previews for update to authenticated using(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid()))) with check(exists(select 1 from public.custom_orders o where o.id=custom_order_id and o.user_id=(select auth.uid())));
create policy preview_admin_manage on public.custom_order_previews for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()));

create table public.product_reservations(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in('active','converted','cancelled','expired')),expires_at timestamptz not null,created_at timestamptz not null default now()
);
create unique index product_active_reservation_idx on public.product_reservations(product_id) where status='active';
alter table public.product_reservations enable row level security;
revoke all on public.product_reservations from public,anon,authenticated;grant select,insert,update on public.product_reservations to authenticated;
create policy reservation_customer_read on public.product_reservations for select to authenticated using(user_id=(select auth.uid()));
create policy reservation_admin_manage on public.product_reservations for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()));

create or replace function private.reserve_artwork(p_product_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype;r public.product_reservations%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 update public.product_reservations set status='expired' where product_id=p_product_id and status='active' and expires_at<=now();
 select * into p from public.products where id=p_product_id and published and not archived and available and reservation_enabled for update;
 if not found then raise exception 'NOT_AVAILABLE';end if;
 if exists(select 1 from public.product_reservations where product_id=p_product_id and status='active') then raise exception 'ALREADY_RESERVED';end if;
 insert into public.product_reservations(product_id,user_id,expires_at) values(p_product_id,auth.uid(),now()+make_interval(hours=>p.reservation_hours)) returning * into r;
 return jsonb_build_object('id',r.id,'expires_at',r.expires_at);
end;$$;
create or replace function public.reserve_artwork(p_product_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_artwork(p_product_id);$$;
revoke all on function private.reserve_artwork(uuid),public.reserve_artwork(uuid) from public,anon;grant execute on function private.reserve_artwork(uuid),public.reserve_artwork(uuid) to authenticated;

create table public.wishlist_alerts(product_id uuid not null references public.products(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,similar_art boolean not null default true,availability boolean not null default true,price_changes boolean not null default false,created_at timestamptz not null default now(),primary key(product_id,user_id));
alter table public.wishlist_alerts enable row level security;revoke all on public.wishlist_alerts from public,anon,authenticated;grant select,insert,update,delete on public.wishlist_alerts to authenticated;
create policy wishlist_alert_owner on public.wishlist_alerts for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.notification_preferences(user_id uuid primary key references auth.users(id) on delete cascade,whatsapp_opt_in boolean not null default false,order_updates boolean not null default true,custom_art_updates boolean not null default true,phone text,updated_at timestamptz not null default now());
alter table public.notification_preferences enable row level security;revoke all on public.notification_preferences from public,anon,authenticated;grant select,insert,update on public.notification_preferences to authenticated;
create policy notification_preference_owner on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.artwork_certificates(
 id uuid primary key default gen_random_uuid(),order_item_id uuid not null unique references public.order_items(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,certificate_number text not null unique,issued_at timestamptz not null default now()
);
alter table public.artwork_certificates enable row level security;revoke all on public.artwork_certificates from public,anon,authenticated;grant select,insert on public.artwork_certificates to authenticated;
create policy certificate_owner_read on public.artwork_certificates for select to authenticated using(user_id=(select auth.uid()));
create policy certificate_admin_manage on public.artwork_certificates for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()));

create or replace function private.issue_delivery_certificates() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='delivered' and old.status is distinct from 'delivered' then
  insert into public.artwork_certificates(order_item_id,user_id,product_id,certificate_number)
  select i.id,new.user_id,i.product_id,'CCA-CERT-'||upper(substr(replace(i.id::text,'-',''),1,12)) from public.order_items i where i.order_id=new.id on conflict(order_item_id) do nothing;
 end if;return new;
end;$$;
drop trigger if exists issue_delivery_certificates on public.orders;
create trigger issue_delivery_certificates after update of status on public.orders for each row execute function private.issue_delivery_certificates();
revoke all on function private.issue_delivery_certificates() from public,anon,authenticated;
