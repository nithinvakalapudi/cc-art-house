-- Create a narrowly scoped role check for read-only portal users. The function
-- lives outside the exposed API schema and derives identity only from auth.uid().
create or replace function private.is_store_portal_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('owner','admin','viewer')
  );
$$;
revoke all on function private.is_store_portal_user() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_store_portal_user() to authenticated;

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role = any (array['owner'::text,'admin'::text,'viewer'::text]));

alter table public.admin_invites add column if not exists access_level text not null default 'write';
alter table public.admin_invites drop constraint if exists admin_invites_access_level_check;
alter table public.admin_invites add constraint admin_invites_access_level_check check (access_level in ('read','write'));

-- Readers can inspect store records through the portal. Existing write policies
-- continue to use is_store_admin(), so viewer accounts cannot mutate those rows.
create policy "portal users read products" on public.products for select to authenticated using (private.is_store_portal_user());
create policy "portal users read categories" on public.categories for select to authenticated using (private.is_store_portal_user());
create policy "portal users read product images" on public.product_images for select to authenticated using (private.is_store_portal_user());
create policy "portal users read product reservations" on public.product_reservations for select to authenticated using (private.is_store_portal_user());
create policy "portal users read artwork certificates" on public.artwork_certificates for select to authenticated using (private.is_store_portal_user());
create policy "portal users read custom previews" on public.custom_order_previews for select to authenticated using (private.is_store_portal_user());
create policy "portal users read custom quotes" on public.custom_order_quotes for select to authenticated using (private.is_store_portal_user());
create policy "portal users read delivery rates" on public.delivery_rates for select to authenticated using (private.is_store_portal_user());
create policy "portal users read all custom pricing" on public.custom_pricing_rules for select to authenticated using (private.is_store_portal_user());

drop policy if exists "admins read contact messages" on public.contact_messages;
create policy "portal users read contact messages" on public.contact_messages for select to authenticated using (private.is_store_portal_user());
drop policy if exists "custom_orders_admin_read" on public.custom_orders;
create policy "portal users read custom orders" on public.custom_orders for select to authenticated using (private.is_store_portal_user());
drop policy if exists "customers and admins read orders" on public.orders;
create policy "customers and portal users read orders" on public.orders for select to authenticated using (user_id = (select auth.uid()) or private.is_store_portal_user());
drop policy if exists "customers and admins read order items" on public.order_items;
create policy "customers and portal users read order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = (select auth.uid()) or private.is_store_portal_user())));
drop policy if exists "custom_order_history_read" on public.custom_order_status_history;
create policy "portal users and customers read custom order history" on public.custom_order_status_history for select to authenticated using (exists (select 1 from public.custom_orders o where o.id = custom_order_status_history.custom_order_id and (o.user_id = (select auth.uid()) or private.is_store_portal_user())));
drop policy if exists "custom_order_images_customer_read" on public.custom_order_images;
create policy "portal users and customers read custom order images" on public.custom_order_images for select to authenticated using (exists (select 1 from public.custom_orders o where o.id = custom_order_images.custom_order_id and (o.user_id = (select auth.uid()) or private.is_store_portal_user())));
drop policy if exists "custom_references_customer_read" on storage.objects;
create policy "customers and portal users read custom references" on storage.objects for select to authenticated using (bucket_id='custom-references' and ((storage.foldername(name))[1] = ((select auth.uid())::text) or private.is_store_portal_user()));

-- Role assignment is owner-only and never allows changing an existing owner.
create or replace function public.set_store_admin_access(invitee_email text, requested_access text)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(invitee_email));
declare target_user uuid;
declare target_role text;
begin
  if not exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'owner') then
    raise exception 'Only the store owner can change team access';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Invalid email address';
  end if;
  if requested_access not in ('read','write') then raise exception 'Access must be read or write'; end if;
  select id into target_user from auth.users where lower(email) = normalized_email and email_confirmed_at is not null limit 1;
  if target_user is not null then
    select role into target_role from public.user_roles where user_id = target_user;
    if target_role = 'owner' then raise exception 'Owner access cannot be changed here'; end if;
  end if;
  insert into public.admin_invites(email,invited_by,access_level)
  values(normalized_email,(select auth.uid()),requested_access)
  on conflict(email) do update set access_level = excluded.access_level, invited_by = excluded.invited_by;
  if target_user is not null then
    insert into public.user_roles(user_id,role) values(target_user,case when requested_access='write' then 'admin' else 'viewer' end)
    on conflict(user_id) do update set role = excluded.role where public.user_roles.role <> 'owner';
  end if;
end;
$$;
revoke all on function public.set_store_admin_access(text,text) from public, anon;
grant execute on function public.set_store_admin_access(text,text) to authenticated;

-- Keep the legacy RPC owner-only too, so an existing write admin cannot bypass
-- the new access selector through a direct API request.
create or replace function public.invite_store_admin(invitee_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.set_store_admin_access(invitee_email,'write');
end;
$$;
revoke all on function public.invite_store_admin(text) from public, anon;
grant execute on function public.invite_store_admin(text) to authenticated;

-- Invitations are written only by the owner-checked function above.
drop policy if exists "admins create invitations" on public.admin_invites;
revoke insert, update, delete on public.admin_invites from anon, authenticated;

create or replace function public.apply_store_admin_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invited_access text;
begin
  if new.email is not null and new.email_confirmed_at is not null then
    select access_level into invited_access from public.admin_invites where email = lower(new.email);
    if invited_access is not null then
      insert into public.user_roles(user_id,role)
      values(new.id,case when invited_access='write' then 'admin' else 'viewer' end)
      on conflict(user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
