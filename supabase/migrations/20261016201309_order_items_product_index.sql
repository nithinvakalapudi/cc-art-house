-- Keep product foreign-key lookups on order history indexed.
create index if not exists order_items_product_id_idx on public.order_items (product_id);
