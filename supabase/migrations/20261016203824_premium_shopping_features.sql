alter table public.orders add column gift_wrap boolean not null default false;
alter table public.orders add column gift_message text not null default '' check(char_length(gift_message)<=500);
create function private.create_gift_order(p_details jsonb,p_items jsonb,p_gift_wrap boolean,p_gift_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE'; end if;
 v_id:=private.create_store_order(p_details->>'customer_name',p_details->>'customer_email',p_details->>'phone',p_details->>'address_line1',p_details->>'address_line2',p_details->>'city',p_details->>'state',p_details->>'postal_code',p_details->>'country',p_details->>'delivery_method',p_details->>'delivery_notes',p_details->>'payment_method',p_items);
 update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,'') where id=v_id and user_id=auth.uid();
 return v_id;
end; $$;
revoke all on function private.create_gift_order(jsonb,jsonb,boolean,text) from public,anon;
grant execute on function private.create_gift_order(jsonb,jsonb,boolean,text) to authenticated;
create function public.create_gift_order(p_details jsonb,p_items jsonb,p_gift_wrap boolean default false,p_gift_message text default '') returns uuid language sql security invoker set search_path='' as $$ select private.create_gift_order(p_details,p_items,p_gift_wrap,p_gift_message); $$;
revoke all on function public.create_gift_order(jsonb,jsonb,boolean,text) from public,anon;
grant execute on function public.create_gift_order(jsonb,jsonb,boolean,text) to authenticated;

create table public.product_reviews(
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 order_item_id uuid not null unique references public.order_items(id),
 user_id uuid not null references auth.users(id),
 display_name text not null check(char_length(display_name) between 2 and 60),
 rating integer not null check(rating between 1 and 5),
 body text not null check(char_length(body) between 10 and 1500),
 photo_path text,
 created_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;
create index product_reviews_product_idx on public.product_reviews(product_id);
create index product_reviews_user_idx on public.product_reviews(user_id);
revoke all on public.product_reviews from anon,authenticated;
grant select(id,product_id,display_name,rating,body,photo_path,created_at) on public.product_reviews to anon,authenticated;
grant insert(product_id,order_item_id,user_id,display_name,rating,body,photo_path) on public.product_reviews to authenticated;
create policy reviews_read on public.product_reviews for select to anon,authenticated using(true);
create policy reviews_verified_insert on public.product_reviews for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and i.product_id=product_reviews.product_id and o.user_id=(select auth.uid()) and o.status='delivered')
 and (photo_path is null or photo_path=(select auth.uid())::text||'/'||order_item_id::text||'.jpg')
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('review-photos','review-photos',true,5242880,array['image/jpeg']);
create policy review_photo_upload on storage.objects for insert to authenticated with check(bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where name=(select auth.uid())::text||'/'||i.id::text||'.jpg' and o.user_id=(select auth.uid()) and o.status='delivered'));
create policy review_photo_remove on storage.objects for delete to authenticated using(bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy review_photo_owner_read on storage.objects for select to authenticated using(bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
