insert into public.site_settings (key, value, section)
values ('gallery_auto_seconds', '5', 'gallery')
on conflict (key) do update
set value = excluded.value,
    section = excluded.section,
    updated_at = now();
