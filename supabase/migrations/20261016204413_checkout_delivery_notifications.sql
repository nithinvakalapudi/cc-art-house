alter table public.orders add column if not exists delivery_priced boolean not null default false;
alter table public.orders add column if not exists razorpay_order_id text unique;
alter table public.orders add column if not exists razorpay_payment_id text unique;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check(payment_method in ('to_be_arranged','cash_on_delivery','upi','bank_transfer','razorpay'));
create table public.delivery_rates(
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 2 and 80),
 postal_prefix text not null unique check(postal_prefix ~ '^[0-9A-Za-z]{2,8}$'),
 fee numeric(12,2) not null check(fee between 0 and 100000),
 estimated_days integer not null default 5 check(estimated_days between 1 and 60),
 active boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.delivery_rates enable row level security;
revoke all on public.delivery_rates from public,anon,authenticated;
grant select,insert,update,delete on public.delivery_rates to authenticated;
create policy delivery_rates_admin on public.delivery_rates for all to authenticated using((select public.is_store_admin())) with check((select public.is_store_admin()));
insert into public.delivery_rates(name,postal_prefix,fee,estimated_days,active) values('Bengaluru','560',0,3,false) on conflict(postal_prefix) do nothing;

create table public.razorpay_payment_attempts(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 user_id uuid not null references auth.users(id),provider_order_id text unique,amount_paise bigint not null check(amount_paise>0),status text not null default 'created' check(status in('created','paid','failed')),created_at timestamptz not null default now()
);
alter table public.razorpay_payment_attempts enable row level security;
revoke all on public.razorpay_payment_attempts from public,anon,authenticated;

create or replace function private.create_gift_order(p_details jsonb,p_items jsonb,p_gift_wrap boolean,p_gift_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_fee numeric; v_priced boolean:=false;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE'; end if;
 v_id:=private.create_store_order(p_details->>'customer_name',p_details->>'customer_email',p_details->>'phone',p_details->>'address_line1',p_details->>'address_line2',p_details->>'city',p_details->>'state',p_details->>'postal_code',p_details->>'country',p_details->>'delivery_method',p_details->>'delivery_notes',p_details->>'payment_method',p_items);
 if p_details->>'delivery_method'='pickup' then v_fee:=0;v_priced:=true;
 else select r.fee into v_fee from public.delivery_rates r where r.active and upper(p_details->>'postal_code') like upper(r.postal_prefix)||'%' order by length(r.postal_prefix) desc limit 1; v_priced:=found; end if;
 update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,''),delivery_fee=coalesce(v_fee,0),delivery_priced=v_priced where id=v_id and user_id=auth.uid();
 return v_id;
end; $$;
revoke all on function private.create_gift_order(jsonb,jsonb,boolean,text) from public,anon;
grant execute on function private.create_gift_order(jsonb,jsonb,boolean,text) to authenticated;

create or replace function private.get_delivery_quote(p_postal_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select name,fee,estimated_days into r from public.delivery_rates where active and upper(p_postal_code) like upper(postal_prefix)||'%' order by length(postal_prefix) desc limit 1;
 if found then return jsonb_build_object('priced',true,'zone',r.name,'fee',r.fee,'estimated_days',r.estimated_days);end if;
 return jsonb_build_object('priced',false,'zone',null,'fee',null,'estimated_days',null);
end; $$;
create or replace function public.get_delivery_quote(p_postal_code text) returns jsonb language sql security invoker set search_path='' as $$select private.get_delivery_quote(p_postal_code);$$;
revoke all on function private.get_delivery_quote(text),public.get_delivery_quote(text) from public,anon;
grant execute on function private.get_delivery_quote(text),public.get_delivery_quote(text) to authenticated;

create or replace function private.create_razorpay_attempt(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o record;v_attempt uuid;v_paise bigint;
begin
 select id,user_id,total,delivery_priced,payment_status into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 if not o.delivery_priced then raise exception 'DELIVERY_PRICE_REQUIRED';end if;
 if o.payment_status='paid' then raise exception 'ALREADY_PAID';end if;
 v_paise:=round(o.total*100)::bigint;
 if v_paise<100 then raise exception 'INVALID_PAYMENT_AMOUNT';end if;
 insert into public.razorpay_payment_attempts(order_id,user_id,amount_paise) values(o.id,o.user_id,v_paise) returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'amount',v_paise,'currency','INR');
end; $$;
create or replace function public.create_razorpay_attempt(p_order_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.create_razorpay_attempt(p_order_id);$$;
revoke all on function private.create_razorpay_attempt(uuid),public.create_razorpay_attempt(uuid) from public,anon;
grant execute on function private.create_razorpay_attempt(uuid),public.create_razorpay_attempt(uuid) to authenticated;

create or replace function private.set_razorpay_order(p_attempt_id uuid,p_provider_order_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_provider_order_id is null or p_provider_order_id !~ '^order_[A-Za-z0-9]+$' then raise exception 'INVALID_PROVIDER_ORDER';end if;
 update public.razorpay_payment_attempts set provider_order_id=p_provider_order_id where id=p_attempt_id and user_id=auth.uid() and provider_order_id is null;
 if not found then raise exception 'ATTEMPT_NOT_FOUND';end if;
 update public.orders o set razorpay_order_id=p_provider_order_id,payment_method='razorpay',payment_status='pending' from public.razorpay_payment_attempts a where a.id=p_attempt_id and o.id=a.order_id and o.user_id=auth.uid();
end; $$;
create or replace function public.set_razorpay_order(p_attempt_id uuid,p_provider_order_id text) returns void language sql security invoker set search_path='' as $$select private.set_razorpay_order(p_attempt_id,p_provider_order_id);$$;
revoke all on function private.set_razorpay_order(uuid,text),public.set_razorpay_order(uuid,text) from public,anon;
grant execute on function private.set_razorpay_order(uuid,text),public.set_razorpay_order(uuid,text) to authenticated;

create or replace function private.confirm_razorpay_payment(p_order_id uuid,p_provider_order_id text,p_payment_id text) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null or p_payment_id !~ '^pay_[A-Za-z0-9]+$' then raise exception 'INVALID_PAYMENT';end if;
 update public.orders set payment_status='paid',payment_method='razorpay',razorpay_payment_id=p_payment_id,updated_at=now() where id=p_order_id and user_id=v_user and razorpay_order_id=p_provider_order_id and payment_status='pending';
 if not found then raise exception 'PAYMENT_ORDER_MISMATCH';end if;
 update public.razorpay_payment_attempts set status='paid' where order_id=p_order_id and provider_order_id=p_provider_order_id and user_id=v_user;
end; $$;
create or replace function public.confirm_razorpay_payment(p_order_id uuid,p_provider_order_id text,p_payment_id text) returns void language sql security invoker set search_path='' as $$select private.confirm_razorpay_payment(p_order_id,p_provider_order_id,p_payment_id);$$;
revoke all on function private.confirm_razorpay_payment(uuid,text,text),public.confirm_razorpay_payment(uuid,text,text) from public,anon;
grant execute on function private.confirm_razorpay_payment(uuid,text,text) to authenticated;
create table public.order_notification_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,event text not null check(event in('placed','status_changed')),status text not null default 'sending' check(status in('sending','sent','failed')),created_at timestamptz not null default now(),unique(order_id,event)
);
alter table public.order_notification_events enable row level security;
revoke all on public.order_notification_events from public,anon,authenticated;
create or replace function private.claim_order_notification(p_order_id uuid,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
declare o record;
begin
 if auth.uid() is null or p_event not in('placed','status_changed') then raise exception 'AUTH_REQUIRED';end if;
 select user_id,status into o from public.orders where id=p_order_id;
 if not found or (o.user_id<>auth.uid() and not public.is_store_admin()) then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event='placed' and o.user_id<>auth.uid() then raise exception 'ORDER_NOT_FOUND';end if;
 insert into public.order_notification_events(order_id,event) values(p_order_id,p_event) on conflict(order_id,event) do nothing;
 return found;
end; $$;
create or replace function public.claim_order_notification(p_order_id uuid,p_event text) returns boolean language sql security invoker set search_path='' as $$select private.claim_order_notification(p_order_id,p_event);$$;
revoke all on function private.claim_order_notification(uuid,text),public.claim_order_notification(uuid,text) from public,anon;
grant execute on function private.claim_order_notification(uuid,text),public.claim_order_notification(uuid,text) to authenticated;
create or replace function private.finish_order_notification(p_order_id uuid,p_event text,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.order_notification_events set status=case when p_sent then 'sent' else 'failed' end where order_id=p_order_id and event=p_event and status='sending';
end; $$;
revoke all on function private.finish_order_notification(uuid,text,boolean) from public,anon,authenticated;
