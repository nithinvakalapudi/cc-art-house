create or replace function private.get_delivery_quote(p_postal_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('priced', true, 'zone', name, 'fee', fee, 'estimated_days', estimated_days)
     from public.delivery_rates
     where active and upper(trim(p_postal_code)) ~ '^[0-9A-Z -]{4,12}$'
       and starts_with(upper(trim(p_postal_code)), upper(postal_prefix))
     order by length(postal_prefix) desc, postal_prefix
     limit 1),
    '{"priced":false}'::jsonb
  );
$$;

grant usage on schema private to anon;
grant execute on function private.get_delivery_quote(text), public.get_delivery_quote(text) to anon;
