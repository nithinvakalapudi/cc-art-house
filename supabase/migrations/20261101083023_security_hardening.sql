-- Tighten customer-managed fields while retaining the existing storefront flows.

-- Anonymous visitors may read active pricing rules, but they do not need to execute
-- the SECURITY DEFINER role-check function. Keep admin checks for authenticated users.
drop policy if exists pricing_public_read on public.custom_pricing_rules;
create policy pricing_public_read on public.custom_pricing_rules
  for select to anon using (active);
create policy pricing_authenticated_read on public.custom_pricing_rules
  for select to authenticated using (active or (select public.is_store_admin()));

revoke execute on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

-- New custom-order inserts cannot spoof studio-controlled pricing or workflow data.
create or replace function private.guard_custom_order_customer_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.is_store_admin()) then
    if new.user_id is distinct from (select auth.uid()) then
      raise exception 'CUSTOM_ORDER_OWNER_MISMATCH' using errcode = '42501';
    end if;
    new.estimated_price := 0;
    new.pricing_snapshot := '{"status":"quote_pending"}'::jsonb;
    new.production_status := 'submitted';
    new.payment_status := 'unpaid';
    new.created_at := now();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists guard_custom_order_customer_insert on public.custom_orders;
create trigger guard_custom_order_customer_insert
  before insert on public.custom_orders
  for each row execute function private.guard_custom_order_customer_insert();
revoke all on function private.guard_custom_order_customer_insert() from public, anon, authenticated;

-- Move internal notes into an admin-only table before removing the customer-readable column.
create table if not exists public.custom_order_admin_notes (
  custom_order_id uuid primary key references public.custom_orders(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 5000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.custom_order_admin_notes(custom_order_id, note, updated_at)
select id, internal_notes, updated_at
from public.custom_orders
where coalesce(internal_notes, '') <> ''
on conflict (custom_order_id) do update
  set note = excluded.note, updated_at = excluded.updated_at;
alter table public.custom_order_admin_notes enable row level security;
revoke all on public.custom_order_admin_notes from public, anon, authenticated;
grant select, insert, update on public.custom_order_admin_notes to authenticated;
drop policy if exists custom_order_admin_notes_admin on public.custom_order_admin_notes;
create policy custom_order_admin_notes_admin on public.custom_order_admin_notes
  for all to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
-- Keep the customer response endpoints, while preventing edits to studio-authored fields.
create or replace function private.guard_custom_quote_customer_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.is_store_admin()) then
    if old.status <> 'sent' or new.status not in ('accepted', 'declined')
       or new.id is distinct from old.id
       or new.custom_order_id is distinct from old.custom_order_id
       or new.amount is distinct from old.amount
       or new.advance_amount is distinct from old.advance_amount
       or new.estimated_completion_date is distinct from old.estimated_completion_date
       or new.terms is distinct from old.terms
       or new.created_at is distinct from old.created_at
       or new.updated_at is distinct from old.updated_at then
      raise exception 'CUSTOMER_QUOTE_FIELDS_RESTRICTED' using errcode = '42501';
    end if;
    new.customer_responded_at := now();
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_custom_quote_customer_update on public.custom_order_quotes;
create trigger guard_custom_quote_customer_update
  before update on public.custom_order_quotes
  for each row execute function private.guard_custom_quote_customer_update();
revoke all on function private.guard_custom_quote_customer_update() from public, anon, authenticated;

create or replace function private.guard_custom_preview_customer_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.is_store_admin()) then
    if old.status <> 'awaiting_approval' or new.status not in ('approved', 'changes_requested')
       or new.id is distinct from old.id
       or new.custom_order_id is distinct from old.custom_order_id
       or new.image_url is distinct from old.image_url
       or new.caption is distinct from old.caption
       or new.revision_number is distinct from old.revision_number
       or new.created_at is distinct from old.created_at then
      raise exception 'CUSTOMER_PREVIEW_FIELDS_RESTRICTED' using errcode = '42501';
    end if;
    new.responded_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists guard_custom_preview_customer_update on public.custom_order_previews;
create trigger guard_custom_preview_customer_update
  before update on public.custom_order_previews
  for each row execute function private.guard_custom_preview_customer_update();
revoke all on function private.guard_custom_preview_customer_update() from public, anon, authenticated;

-- Durable contact-form rate limiting. Only the server's service-role client can invoke this.
create schema if not exists private;
create table if not exists private.submission_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  submission_count integer not null check (submission_count > 0)
);
create index if not exists submission_rate_limits_window_idx
  on private.submission_rate_limits(window_started_at);
revoke all on private.submission_rate_limits from public, anon, authenticated;

create or replace function public.consume_submission_rate_limit(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_now timestamptz := now();
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_RATE_LIMIT_KEY' using errcode = '22023';
  end if;
  insert into private.submission_rate_limits as limits(key_hash, window_started_at, submission_count)
  values (p_key_hash, v_now, 1)
  on conflict (key_hash) do update set
    window_started_at = case when limits.window_started_at <= v_now - interval '10 minutes' then v_now else limits.window_started_at end,
    submission_count = case when limits.window_started_at <= v_now - interval '10 minutes' then 1 else limits.submission_count + 1 end
  returning submission_count into v_count;
  delete from private.submission_rate_limits where window_started_at < v_now - interval '1 day';
  return v_count <= 5;
end;
$$;
revoke all on function public.consume_submission_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_submission_rate_limit(text) to service_role;
