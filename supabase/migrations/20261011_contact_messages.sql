create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 30),
  address text check (address is null or char_length(address) <= 250),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 3000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create policy "visitors send contact messages" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "admins read contact messages" on public.contact_messages for select to authenticated using (public.is_store_admin());
grant insert on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
