-- Public schema defaults can grant table privileges to anon. Order PII is only for signed-in customers and admins.
revoke all on table public.orders, public.order_items from anon;
grant select, update on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
