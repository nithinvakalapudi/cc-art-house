-- Only the server may confirm a provider signature; browsers cannot set paid status.
create or replace function private.confirm_razorpay_payment(p_order_id uuid,p_provider_order_id text,p_payment_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role')<>'service_role' then raise exception 'SERVER_ONLY';end if;
 if p_payment_id !~ '^pay_[A-Za-z0-9]+$' then raise exception 'INVALID_PAYMENT';end if;
 update public.orders set payment_status='paid',payment_method='razorpay',razorpay_payment_id=p_payment_id,updated_at=now() where id=p_order_id and razorpay_order_id=p_provider_order_id and payment_status='pending';
 if not found then raise exception 'PAYMENT_ORDER_MISMATCH';end if;
 update public.razorpay_payment_attempts set status='paid' where order_id=p_order_id and provider_order_id=p_provider_order_id;
end; $$;
revoke all on function private.confirm_razorpay_payment(uuid,text,text),public.confirm_razorpay_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function private.confirm_razorpay_payment(uuid,text,text),public.confirm_razorpay_payment(uuid,text,text) to service_role;
