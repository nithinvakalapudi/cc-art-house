alter table public.store_promotions
  add column if not exists homepage_featured boolean not null default false;

create unique index if not exists store_promotions_single_homepage_feature_idx
  on public.store_promotions (homepage_featured)
  where homepage_featured;

create or replace function public.set_homepage_promotion(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_store_admin() then
    raise exception 'Only a store admin can feature a promotion';
  end if;

  if p_promotion_id is not null and not exists (
    select 1 from public.store_promotions
    where id = p_promotion_id
      and enabled
      and (ends_at is null or ends_at > now())
  ) then
    raise exception 'Choose an active promotion that has not expired';
  end if;

  update public.store_promotions
  set homepage_featured = false, updated_at = now()
  where homepage_featured;

  if p_promotion_id is not null then
    update public.store_promotions
    set homepage_featured = true, updated_at = now()
    where id = p_promotion_id;
  end if;
end;
$$;
revoke all on function public.set_homepage_promotion(uuid) from public, anon;
grant execute on function public.set_homepage_promotion(uuid) to authenticated;

-- Only the admin-selected offer is exposed to the public homepage. The view
-- still hides paused, not-yet-started, expired, and fully redeemed coupons.
create or replace view public.storefront_promotions as
select code, title, discount_type, discount_value, ends_at, starts_at
from public.store_promotions
where homepage_featured
  and enabled
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and (max_redemptions is null or redemption_count < max_redemptions);

revoke all on public.storefront_promotions from public;
grant select on public.storefront_promotions to anon, authenticated;
