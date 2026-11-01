-- Only the store owner can remove an invited teammate. Deleting the invite
-- revokes the matching admin/viewer role in the same database transaction.
grant delete on public.admin_invites to authenticated;

drop policy if exists "owners delete invitations" on public.admin_invites;
create policy "owners delete invitations"
  on public.admin_invites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = (select auth.uid())
        and role = 'owner'
    )
  );

create or replace function private.remove_store_admin_role_after_invite_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
begin
  if not exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'owner'
  ) then
    raise exception 'Only the store owner can remove team access';
  end if;

  select id
    into target_user
  from auth.users
  where lower(email) = lower(old.email)
  limit 1;

  if target_user is not null then
    if exists (
      select 1
      from public.user_roles
      where user_id = target_user
        and role = 'owner'
    ) then
      raise exception 'Owner access cannot be removed here';
    end if;

    delete from public.user_roles
    where user_id = target_user
      and role in ('admin', 'viewer');
  end if;

  return old;
end;
$$;

revoke all on function private.remove_store_admin_role_after_invite_delete()
  from public, anon, authenticated;

drop trigger if exists remove_store_admin_role_after_invite_delete
  on public.admin_invites;
create trigger remove_store_admin_role_after_invite_delete
  after delete on public.admin_invites
  for each row
  execute function private.remove_store_admin_role_after_invite_delete();
