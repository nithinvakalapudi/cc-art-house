alter table public.products
  add column if not exists original_price numeric(12, 2);

alter table public.products
  drop constraint if exists products_original_price_check;

alter table public.products
  add constraint products_original_price_check
  check (original_price is null or (original_price > price and original_price >= 0));

comment on column public.products.original_price is
  'Optional pre-discount price. products.price remains the final checkout price.';
