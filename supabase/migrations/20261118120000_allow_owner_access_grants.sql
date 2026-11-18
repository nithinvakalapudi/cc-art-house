-- Permit an existing owner to grant owner access to another confirmed account.
-- Only an owner may create/update the invite (RLS) and the trigger checks that
-- the acting owner is still an owner before changing user_roles.
alter table public.admin_invites
  drop constraint if exists admin_invites_access_level_check;
alter table public.admin_invites
  add constraint admin_invites_access_level_check
  check (access_level in ('read', 'write', 'owner'));

create or replace function private.sync_admin_invite_role()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_user uuid;
  current_role text;
  granted_role text;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = new.invited_by and role = 'owner'
  ) then
    raise exception 'Only an owner can change team access';
  end if;

  select id into target_user
  from auth.users
  where lower(email) = lower(new.email) and email_confirmed_at is not null
  limit 1;
  if target_user is null then return new; end if;

  select role into current_role
  from public.user_roles where user_id = target_user;
  if current_role = 'owner' and new.access_level <> 'owner' then
    raise exception 'Owner access cannot be changed here';
  end if;

  granted_role := case new.access_level
    when 'owner' then 'owner'
    when 'write' then 'admin'
    else 'viewer'
  end;

  insert into public.user_roles(user_id, role)
  values(target_user, granted_role)
  on conflict(user_id) do update set role = excluded.role
  where public.user_roles.role <> 'owner' or excluded.role = 'owner';
  return new;
end;
$$;
revoke all on function private.sync_admin_invite_role() from public, anon, authenticated;

create or replace function public.apply_store_admin_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invited_access text;
  granted_role text;
begin
  if new.email is not null and new.email_confirmed_at is not null then
    select access_level into invited_access
    from public.admin_invites where email = lower(new.email);
    if invited_access is not null then
      granted_role := case invited_access
        when 'owner' then 'owner'
        when 'write' then 'admin'
        else 'viewer'
      end;
      insert into public.user_roles(user_id, role)
      values(new.id, granted_role)
      on conflict(user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.apply_store_admin_invite() from public, anon, authenticated;
