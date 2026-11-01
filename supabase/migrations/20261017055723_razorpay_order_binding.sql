-- The provider order ID is trusted only after the server creates it with Razorpay.
create or replace function private.set_razorpay_order(p_attempt_id uuid,p_provider_order_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role')<>'service_role' then raise exception 'SERVER_ONLY';end if;
 if p_provider_order_id is null or p_provider_order_id !~ '^order_[A-Za-z0-9]+$' then raise exception 'INVALID_PROVIDER_ORDER';end if;
 update public.razorpay_payment_attempts set provider_order_id=p_provider_order_id where id=p_attempt_id and provider_order_id is null;
 if not found then raise exception 'ATTEMPT_NOT_FOUND';end if;
 update public.orders o set razorpay_order_id=p_provider_order_id,payment_method='razorpay',payment_status='pending' from public.razorpay_payment_attempts a where a.id=p_attempt_id and o.id=a.order_id;
end; $$;
create or replace function public.set_razorpay_order(p_attempt_id uuid,p_provider_order_id text) returns void language sql security invoker set search_path='' as $$select private.set_razorpay_order(p_attempt_id,p_provider_order_id);$$;
revoke all on function private.set_razorpay_order(uuid,text),public.set_razorpay_order(uuid,text) from public,anon,authenticated;
grant execute on function private.set_razorpay_order(uuid,text),public.set_razorpay_order(uuid,text) to service_role;
