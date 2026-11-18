'use server';

import { z } from 'zod';
import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin, serverDb } from '@/lib/supabase-server';

const artworkImage = z.union([z.url(), z.string().regex(/^\/artist-gallery\/[A-Za-z0-9._-]+$/), z.literal('')]);
const product = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,200}$/),
  price: z.coerce.number().nonnegative(),
  discount_percent: z.coerce.number().min(0).max(95),
  medium: z.string().trim().max(120),
  dimensions: z.string().trim().max(120),
  description: z.string().trim().max(5000),
  inspiration: z.string().trim().max(3000), care_instructions: z.string().trim().max(1500),
  creation_hours: z.string(), edition_number: z.string(), edition_total: z.string(),
  palette: z.string().trim().max(500), room_tags: z.string().trim().max(500),
  artist_video_url: z.union([z.url(), z.literal('')]), reference_image_url: artworkImage, completed_image_url: artworkImage,
  image_url: artworkImage,
  category_id: z.string(),
  available: z.enum(['true', 'false']),
});

function parseProduct(form: FormData) {
  const parsed = product.safeParse({discount_percent:'0',inspiration:'',care_instructions:'',creation_hours:'',edition_number:'',edition_total:'',palette:'',room_tags:'',artist_video_url:'',reference_image_url:'',completed_image_url:'',...Object.fromEntries(form.entries())});
  if (!parsed.success) throw new Error('Check the painting title, slug, price and image URL.');
  const d = parsed.data;
  const gallery: { url: string; alt_text: string; sort_order: number }[] = [];
  for (let index = 1; index <= 3; index++) {
    const url = String(form.get(`gallery_url_${index}`) || '').trim();
    const alt = String(form.get(`gallery_alt_${index}`) || '').trim();
    if (!artworkImage.safeParse(url).success || alt.length > 180) throw new Error('Check the extra image URLs and descriptions.');
    if (url) gallery.push({ url, alt_text: alt || d.title, sort_order: index });
  }
  const finalPrice = d.discount_percent > 0 ? Math.round(d.price * (1 - d.discount_percent / 100) * 100) / 100 : d.price;
  return { values: {
    title: d.title, slug: d.slug, price: finalPrice, original_price: d.discount_percent > 0 ? d.price : null, medium: d.medium || null,
    dimensions: d.dimensions || null, description: d.description || null,
    image_url: d.image_url || null, category_id: d.category_id || null,
    available: d.available === 'true', published: form.has('published'),
    featured: form.has('featured'), archived: form.has('archived'), inspiration: d.inspiration || null,
    care_instructions: d.care_instructions || null, creation_hours: d.creation_hours ? Number(d.creation_hours) : null,
    edition_number: d.edition_number ? Number(d.edition_number) : null, edition_total: d.edition_total ? Number(d.edition_total) : null,
    palette: d.palette.split(',').map(value => value.trim()).filter(Boolean), room_tags: d.room_tags.split(',').map(value => value.trim()).filter(Boolean),
    artist_video_url: d.artist_video_url || null, reference_image_url: d.reference_image_url || null, completed_image_url: d.completed_image_url || null,
    reservation_enabled: false,
  }, gallery };
}

function refresh(slug: string) {
  updateTag('catalogue');
  revalidatePath('/'); revalidatePath('/shop'); revalidatePath('/style-finder');
  revalidatePath(`/shop/${slug}`); revalidatePath('/admin/products');
}

export async function saveProduct(form: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const { values, gallery } = parseProduct(form);
  const db = await serverDb(); if (!db) throw new Error('Database unavailable');
  const { data: created, error } = await db.from('products').insert(values).select('id').single();
  if (error || !created) throw new Error(error?.message || 'Unable to save painting');
  if (gallery.length) {
    const result = await db.from('product_images').insert(gallery.map(item => ({ ...item, product_id: created.id })));
    if (result.error) throw new Error(`Painting saved, but extra images failed: ${result.error.message}`);
  }
  refresh(values.slug);
  redirect(`/admin/products/${created.id}?saved=1`);
}

export async function updateProduct(id: string, form: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const { values, gallery } = parseProduct(form);
  const db = await serverDb(); if (!db) throw new Error('Database unavailable');
  const { data: existing, error: readError } = await db.from('products').select('slug').eq('id', id).single();
  if (readError || !existing) throw new Error('Painting not found');
  const { error } = await db.from('products').update(values).eq('id', id);
  if (error) throw new Error(error.message);
  const { data: oldImages, error: imagesError } = await db.from('product_images').select('id,sort_order').eq('product_id', id);
  if (imagesError) throw new Error(imagesError.message);
  for (let index = 1; index <= 3; index++) {
    const wanted = gallery.find(item => item.sort_order === index);
    const old = oldImages?.find(item => item.sort_order === index);
    if (wanted && old) {
      const result = await db.from('product_images').update(wanted).eq('id', old.id);
      if (result.error) throw new Error(result.error.message);
    } else if (wanted) {
      const result = await db.from('product_images').insert({ ...wanted, product_id: id });
      if (result.error) throw new Error(result.error.message);
    } else if (old) {
      const result = await db.from('product_images').delete().eq('id', old.id);
      if (result.error) throw new Error(result.error.message);
    }
  }
  refresh(existing.slug); refresh(values.slug);
  redirect(`/admin/products/${id}?saved=1`);
}
