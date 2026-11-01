create or replace function private.confirm_razorpay_payment(p_order_id uuid,p_provider_order_id text,p_payment_id text) returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
 if (select auth.jwt()->>'role')<>'service_role' then raise exception 'SERVER_ONLY';end if;
 if p_payment_id !~ '^pay_[A-Za-z0-9]+$' then raise exception 'INVALID_PAYMENT';end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.razorpay_order_id is distinct from p_provider_order_id then raise exception 'PAYMENT_ORDER_MISMATCH';end if;
 if v_order.payment_status='paid' and v_order.razorpay_payment_id=p_payment_id then return;end if;
 if v_order.payment_status<>'pending' then raise exception 'PAYMENT_ORDER_MISMATCH';end if;
 update public.orders set payment_status='paid',payment_method='razorpay',razorpay_payment_id=p_payment_id,updated_at=now() where id=p_order_id;
 update public.razorpay_payment_attempts set status='paid' where order_id=p_order_id and provider_order_id=p_provider_order_id;
end; $$;
