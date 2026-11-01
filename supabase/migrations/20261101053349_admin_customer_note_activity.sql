
create index if not exists admin_activity_log_actor_idx on public.admin_activity_log (actor_user_id) where actor_user_id is not null;
create index if not exists admin_customer_notes_updated_by_idx on public.admin_customer_notes (updated_by) where updated_by is not null;
create index if not exists store_promotions_created_by_idx on public.store_promotions (created_by) where created_by is not null;
create index if not exists orders_promotion_id_idx on public.orders (promotion_id) where promotion_id is not null;

create trigger admin_activity_customer_notes
after insert or update or delete on public.admin_customer_notes
for each row execute function private.log_store_admin_activity();
