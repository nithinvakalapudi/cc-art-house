create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  section text not null default 'general',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists "Public can read website settings" on public.site_settings;
create policy "Public can read website settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins can insert website settings" on public.site_settings;
create policy "Admins can insert website settings" on public.site_settings for insert to authenticated with check (public.is_store_admin());
drop policy if exists "Admins can update website settings" on public.site_settings;
create policy "Admins can update website settings" on public.site_settings for update to authenticated using (public.is_store_admin()) with check (public.is_store_admin());
drop policy if exists "Owners can delete website settings" on public.site_settings;
create policy "Owners can delete website settings" on public.site_settings for delete to authenticated using (exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'owner'));

insert into public.site_settings (key,value,section) values
('site_name','the art house','brand'),('site_tagline','You imagine. We create by hand.','brand'),
('announcement_text','HANDMADE PAINTINGS ✦ PERSONAL ART ✦ MEANINGFUL GIFTS','brand'),
('contact_strip_text','Made with care, made for your story','brand'),
('hero_eyebrow','THE ART OF MAKING IT PERSONAL','homepage'),('hero_title','Art that feels','homepage'),
('hero_accent','like you.','homepage'),('hero_description','Handmade paintings for the corners you love, the people you cherish, and the stories worth keeping.','homepage'),
('hero_image_url','/artist-gallery/traditional-portrait-optimized.webp','homepage'),
('featured_title','Paintings to fall in love with','homepage'),('featured_description','Discover original art made to bring a little more colour into every day.','homepage'),
('shop_title','Find art that feels like home.','shop'),('shop_description','One-of-a-kind paintings, patiently made to bring warmth and character to your space.','shop'),
('about_title','Art made with feeling.','about'),('about_intro','From detailed mandalas to personal keepsakes, each piece starts with the joy of making something meaningful by hand.','about'),
('about_story_title','One idea can become something you keep forever.','about'),
('about_story','The Art House brings handmade paintings, mandalas, traditional art, and custom pieces together in one place.','about'),
('contact_heading','Contact us.','contact'),('contact_intro','Have a painting in mind, or just a question? We would love to hear from you.','contact'),
('contact_address','Kundalahalli Gate, Bengaluru, Karnataka','contact'),('contact_email','nithinchowdary171@gmail.com','contact'),
('contact_phone','','contact'),('whatsapp_number','','contact'),('instagram_handle','@artworksof_cctwinzz','contact'),
('instagram_url','https://www.instagram.com/artworksof_cctwinzz/','contact'),('map_query','Kundalahalli Gate, Bengaluru','contact'),
('show_gallery','true','navigation'),('show_style_finder','true','navigation'),('show_about','true','navigation'),('show_contact','true','navigation'),
('gallery_auto_seconds','6.5','gallery'),('gallery_curator_default','false','gallery')
on conflict (key) do nothing;
