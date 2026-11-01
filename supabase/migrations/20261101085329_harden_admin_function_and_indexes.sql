-- Keep the definer-privileged lookup in the private schema and make the exposed
-- function a harmless invoker wrapper for existing RLS policies and RPC code.
create or replace function private.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;
revoke all on function private.is_store_admin() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_store_admin() to authenticated;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_store_admin();
$$;
revoke all on function public.is_store_admin() from public, anon, authenticated;
grant execute on function public.is_store_admin() to authenticated;

create index if not exists custom_order_admin_notes_updated_by_idx
  on public.custom_order_admin_notes(updated_by)
  where updated_by is not null;
create index if not exists razorpay_payment_attempts_order_id_idx
  on public.razorpay_payment_attempts(order_id);
create index if not exists razorpay_payment_attempts_user_id_idx
  on public.razorpay_payment_attempts(user_id);
