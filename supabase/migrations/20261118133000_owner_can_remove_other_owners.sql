-- Allow an owner to revoke another owner's team invitation and role.
-- A signed-in owner cannot remove their own owner role through this path.
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
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'owner'
  ) then
    raise exception 'Only an owner can remove team access';
  end if;

  select id into target_user
  from auth.users
  where lower(email) = lower(old.email)
  limit 1;

  if target_user is not null then
    if target_user = (select auth.uid()) then
      raise exception 'You cannot remove your own owner access';
    end if;

    delete from public.user_roles
    where user_id = target_user and role in ('admin', 'viewer', 'owner');
  end if;

  return old;
end;
$$;

revoke all on function private.remove_store_admin_role_after_invite_delete()
  from public, anon, authenticated;
