alter table public.order_notification_events drop constraint if exists order_notification_events_event_check;
alter table public.order_notification_events add constraint order_notification_events_event_check check(event='placed' or event='payment:paid' or event like 'status:%');
create or replace function private.claim_order_notification(p_order_id uuid,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_owner uuid;v_inserted uuid;
begin
 if v_user is null or (p_event<>'placed' and p_event<>'payment:paid' and p_event not like 'status:%') then raise exception 'AUTH_REQUIRED';end if;
 select user_id into v_owner from public.orders where id=p_order_id;
 if v_owner is null or (v_owner<>v_user and not public.is_store_admin()) then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event='placed' and v_owner<>v_user then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event='payment:paid' and (v_owner<>v_user or not exists(select 1 from public.orders where id=p_order_id and payment_status='paid')) then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event like 'status:%' and not public.is_store_admin() then raise exception 'ADMIN_REQUIRED';end if;
 insert into public.order_notification_events(order_id,event) values(p_order_id,p_event) on conflict(order_id,event) do update set status='sending' where public.order_notification_events.status='failed' returning id into v_inserted;
 return v_inserted is not null;
end; $$;
