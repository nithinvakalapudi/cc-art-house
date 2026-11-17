update public.site_settings
set value = 'CC Art Works'
where key = 'site_name'
  and lower(trim(value)) in ('the art house', 'cc art house');

update public.site_settings
set value = 'CC Art Works | Handmade paintings'
where key = 'seo_title'
  and lower(trim(value)) in ('the art house | handmade paintings', 'cc art house | handmade paintings');

update public.site_settings
set value = 'CC Art Works brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.'
where key = 'about_story'
  and value = 'The Art House brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.';
