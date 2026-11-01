-- Avoid a callable public SECURITY DEFINER RPC for role assignment. Owners write
-- invitations through RLS; a private trigger syncs access onto existing accounts.
drop function if exists public.set_store_admin_access(text,text);
revoke all on function public.invite_store_admin(text) from public, anon, authenticated;

grant insert, update on public.admin_invites to authenticated;
drop policy if exists "owners create invitations" on public.admin_invites;
create policy "owners create invitations" on public.admin_invites for insert to authenticated
  with check (invited_by = (select auth.uid()) and exists (
    select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'owner'
  ));
drop policy if exists "owners update invitations" on public.admin_invites;
create policy "owners update invitations" on public.admin_invites for update to authenticated
  using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'owner'))
  with check (invited_by = (select auth.uid()) and exists (
    select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'owner'
  ));

create or replace function private.sync_admin_invite_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_user uuid;
declare current_role text;
begin
  if not exists (select 1 from public.user_roles where user_id = new.invited_by and role = 'owner') then
    raise exception 'Only the store owner can change team access';
  end if;
  select id into target_user from auth.users
    where lower(email) = lower(new.email) and email_confirmed_at is not null limit 1;
  if target_user is null then return new; end if;
  select role into current_role from public.user_roles where user_id = target_user;
  if current_role = 'owner' then raise exception 'Owner access cannot be changed here'; end if;
  insert into public.user_roles(user_id,role)
    values(target_user,case when new.access_level='write' then 'admin' else 'viewer' end)
    on conflict(user_id) do update set role = excluded.role where public.user_roles.role <> 'owner';
  return new;
end;
$$;
revoke all on function private.sync_admin_invite_role() from public, anon, authenticated;

drop trigger if exists sync_admin_invite_role on public.admin_invites;
create trigger sync_admin_invite_role
  after insert or update of email, access_level, invited_by on public.admin_invites
  for each row execute function private.sync_admin_invite_role();
