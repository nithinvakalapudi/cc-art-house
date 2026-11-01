-- Bengaluru delivery costs INR 45. Artwork subtotals of INR 2,000 or more
-- receive free delivery while still requiring a supported delivery area.
update public.delivery_rates
set fee = 45, active = true, updated_at = now()
where postal_prefix = '560';

create or replace function private.create_gift_order(p_details jsonb,p_items jsonb,p_gift_wrap boolean,p_gift_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_fee numeric;v_priced boolean:=false;v_details jsonb;v_verified_email text;v_subtotal numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if char_length(coalesce(p_gift_message,''))>500 then raise exception 'INVALID_GIFT_MESSAGE';end if;
 select email into v_verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 v_details:=p_details||jsonb_build_object('customer_email',coalesce(v_verified_email,''));
 v_id:=private.create_store_order(v_details->>'customer_name',v_details->>'customer_email',v_details->>'phone',v_details->>'address_line1',v_details->>'address_line2',v_details->>'city',v_details->>'state',v_details->>'postal_code',v_details->>'country',v_details->>'delivery_method',v_details->>'delivery_notes',v_details->>'payment_method',p_items);
 select subtotal into v_subtotal from public.orders where id=v_id and user_id=auth.uid();
 if v_details->>'delivery_method'='pickup' then v_fee:=0;v_priced:=true;
 else
  select case when v_subtotal>=2000 then 0 else r.fee end into v_fee from public.delivery_rates r where r.active and upper(v_details->>'postal_code') like upper(r.postal_prefix)||'%' order by length(r.postal_prefix) desc limit 1;
  v_priced:=found;
 end if;
 update public.orders set gift_wrap=coalesce(p_gift_wrap,false),gift_message=coalesce(p_gift_message,''),delivery_fee=coalesce(v_fee,0),delivery_priced=v_priced where id=v_id and user_id=auth.uid();
 return v_id;
end; $$;
revoke all on function private.create_gift_order(jsonb,jsonb,boolean,text) from public,anon;
grant execute on function private.create_gift_order(jsonb,jsonb,boolean,text) to authenticated;
