-- Notify an order's verified account email and the studio. Idempotent per order and event.
create table public.order_notification_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 event text not null check(event in('placed','status_changed')),status text not null default 'sending' check(status in('sending','sent','failed')),
 created_at timestamptz not null default now(),unique(order_id,event)
);
alter table public.order_notification_events enable row level security;
revoke all on public.order_notification_events from public,anon,authenticated;
create or replace function private.claim_order_notification(p_order_id uuid,p_event text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_owner uuid;
begin
 if v_user is null or p_event not in('placed','status_changed') then raise exception 'AUTH_REQUIRED';end if;
 select user_id into v_owner from public.orders where id=p_order_id;
 if v_owner is null or (v_owner<>v_user and not public.is_store_admin()) then raise exception 'ORDER_NOT_FOUND';end if;
 if p_event='placed' and v_owner<>v_user then raise exception 'ORDER_NOT_FOUND';end if;
 insert into public.order_notification_events(order_id,event) values(p_order_id,p_event) on conflict(order_id,event) do nothing;
 return found;
end; $$;
create or replace function public.claim_order_notification(p_order_id uuid,p_event text) returns boolean language sql security invoker set search_path='' as $$select private.claim_order_notification(p_order_id,p_event);$$;
revoke all on function private.claim_order_notification(uuid,text),public.claim_order_notification(uuid,text) from public,anon;
grant execute on function private.claim_order_notification(uuid,text),public.claim_order_notification(uuid,text) to authenticated;
create or replace function private.finish_order_notification(p_order_id uuid,p_event text,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
begin update public.order_notification_events set status=case when p_sent then 'sent' else 'failed' end where order_id=p_order_id and event=p_event and status='sending';end; $$;
revoke all on function private.finish_order_notification(uuid,text,boolean) from public,anon,authenticated;
