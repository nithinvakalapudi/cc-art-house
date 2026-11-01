create or replace function private.create_gift_order(p_details jsonb,p_items jsonb,p_gift_wrap boolean,p_gift_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_fee numeric;v_priced boolean:=false;v_details jsonb;v_verified_email text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE';end if;
 select email into v_verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 v_details:=p_details||jsonb_build_object('customer_email',coalesce(v_verified_email,''));
 v_id:=private.create_store_order(v_details->>'customer_name',v_details->>'customer_email',v_details->>'phone',v_details->>'address_line1',v_details->>'address_line2',v_details->>'city',v_details->>'state',v_details->>'postal_code',v_details->>'country',v_details->>'delivery_method',v_details->>'delivery_notes',v_details->>'payment_method',p_items);
 if v_details->>'delivery_method'='pickup' then v_fee:=0;v_priced:=true;
 else select r.fee into v_fee from public.delivery_rates r where r.active and upper(v_details->>'postal_code') like upper(r.postal_prefix)||'%' order by length(r.postal_prefix) desc limit 1;v_priced:=found;end if;
 update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,''),delivery_fee=coalesce(v_fee,0),delivery_priced=v_priced where id=v_id and user_id=auth.uid();return v_id;
end; $$;
revoke all on function private.create_gift_order(jsonb,jsonb,boolean,text) from public,anon;
grant execute on function private.create_gift_order(jsonb,jsonb,boolean,text) to authenticated;
create or replace function private.claim_order_notification(p_order_id uuid,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_owner uuid;v_inserted uuid;
begin
 if v_user is null or p_event not in('placed','status_changed') then raise exception 'AUTH_REQUIRED';end if;
 select user_id into v_owner from public.orders where id=p_order_id;
 if v_owner is null or (v_owner<>v_user and not public.is_store_admin()) then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event='placed' and v_owner<>v_user then raise exception 'ORDER_NOT_FOUND';end if;
 insert into public.order_notification_events(order_id,event) values(p_order_id,p_event) on conflict(order_id,event) do update set status='sending' where public.order_notification_events.status='failed' returning id into v_inserted;
 return v_inserted is not null;
end; $$;
create or replace function private.finish_order_notification(p_order_id uuid,p_event text,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_owner uuid;
begin
 select user_id into v_owner from public.orders where id=p_order_id;
 if v_user is null or (v_owner<>v_user and not public.is_store_admin()) then raise exception 'ORDER_NOT_FOUND';end if;
 update public.order_notification_events set status=case when p_sent then 'sent' else 'failed' end where order_id=p_order_id and event=p_event and status='sending';
end; $$;
create or replace function public.finish_order_notification(p_order_id uuid,p_event text,p_sent boolean) returns void language sql security invoker set search_path='' as $$select private.finish_order_notification(p_order_id,p_event,p_sent);$$;
revoke all on function private.finish_order_notification(uuid,text,boolean),public.finish_order_notification(uuid,text,boolean) from public,anon;
grant execute on function private.finish_order_notification(uuid,text,boolean),public.finish_order_notification(uuid,text,boolean) to authenticated;
-- Payment confirmation is verified with Razorpay's HMAC on the server and runs with the server key only.
create or replace function private.confirm_razorpay_payment(p_order_id uuid,p_provider_order_id text,p_payment_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role')<>'service_role' then raise exception 'SERVER_ONLY';end if;
 if p_payment_id !~ '^pay_[A-Za-z0-9]+$' then raise exception 'INVALID_PAYMENT';end if;
 update public.orders set payment_status='paid',payment_method='razorpay',razorpay_payment_id=p_payment_id,updated_at=now() where id=p_order_id and razorpay_order_id=p_provider_order_id and payment_status='pending';
 if not found then raise exception 'PAYMENT_ORDER_MISMATCH';end if;
 update public.razorpay_payment_attempts set status='paid' where order_id=p_order_id and provider_order_id=p_provider_order_id;
end; $$;
revoke all on function private.confirm_razorpay_payment(uuid,text,text),public.confirm_razorpay_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function private.confirm_razorpay_payment(uuid,text,text) to service_role;
