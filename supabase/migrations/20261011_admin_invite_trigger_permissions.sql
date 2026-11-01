-- Trigger functions are invoked by PostgreSQL; clients must not call this SECURITY DEFINER function.
revoke all on function public.apply_store_admin_invite() from public, anon, authenticated;
create index if not exists admin_invites_invited_by_idx on public.admin_invites (invited_by);
