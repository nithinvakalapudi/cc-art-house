create or replace function private.create_razorpay_attempt(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o record;v_attempt uuid;v_paise bigint;
begin
 select id,user_id,total,delivery_priced,payment_status,status,gift_wrap into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 if o.status='cancelled' then raise exception 'ORDER_CANCELLED';end if;
 if not o.delivery_priced then raise exception 'DELIVERY_PRICE_REQUIRED';end if;
 if o.gift_wrap then raise exception 'GIFT_OPTIONS_NEED_CONFIRMATION';end if;
 if o.payment_status='paid' then raise exception 'ALREADY_PAID';end if;
 v_paise:=round(o.total*100)::bigint;
 if v_paise<100 then raise exception 'INVALID_PAYMENT_AMOUNT';end if;
 insert into public.razorpay_payment_attempts(order_id,user_id,amount_paise) values(o.id,o.user_id,v_paise) returning id into v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'amount',v_paise,'currency','INR');
end; $$;
