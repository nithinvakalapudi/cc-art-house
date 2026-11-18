-- Expose only safe, customer-facing fields for promotions that are live and
-- still within their redemption limit. Coupon validation remains server-side.
create or replace view public.storefront_promotions as
select code, title, discount_type, discount_value, ends_at, starts_at
from public.store_promotions
where enabled
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and (max_redemptions is null or redemption_count < max_redemptions);

revoke all on public.storefront_promotions from public;
grant select on public.storefront_promotions to anon, authenticated;
