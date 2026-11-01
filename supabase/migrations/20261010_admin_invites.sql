-- Admin invitations are controlled by an existing owner or admin.
create table if not exists public.admin_invites (
  email text primary key,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.admin_invites enable row level security;

create policy "admins read invitations" on public.admin_invites
  for select to authenticated using (public.is_store_admin());
create policy "admins create invitations" on public.admin_invites
  for insert to authenticated with check (
    public.is_store_admin() and invited_by = (select auth.uid())
  );

-- A matching account receives its role when it first signs up or confirms email.
create or replace function public.apply_store_admin_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and new.email_confirmed_at is not null and exists (
    select 1 from public.admin_invites where email = lower(new.email)
  ) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_store_admin_invite_on_user on auth.users;
create trigger apply_store_admin_invite_on_user
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.apply_store_admin_invite();

-- Existing customer accounts can be invited too. The trigger runs on their next email update,
-- or the inviting admin may use the function below to assign them immediately.
create or replace function public.invite_store_admin(invitee_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(invitee_email));
declare target_user uuid;
begin
  if not public.is_store_admin() then raise exception 'Not authorized'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email address';
  end if;
  insert into public.admin_invites (email, invited_by)
    values (normalized_email, auth.uid()) on conflict (email) do nothing;
  select id into target_user from auth.users where lower(email) = normalized_email and email_confirmed_at is not null limit 1;
  if target_user is not null then
    insert into public.user_roles (user_id, role) values (target_user, 'admin')
    on conflict (user_id) do nothing;
  end if;
end;
$$;

revoke all on function public.invite_store_admin(text) from public, anon;
grant execute on function public.invite_store_admin(text) to authenticated;
