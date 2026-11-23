'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, isAdmin, serverDb } from '@/lib/supabase-server';

export async function savePromotion(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  const code = String(formData.get('code') || '').trim().toUpperCase();
  const title = String(formData.get('title') || '').trim();
  const discountType = String(formData.get('discount_type') || '');
  const discountValue = Number(formData.get('discount_value'));
  const startsAtText = String(formData.get('starts_at') || '');
  const endsAtText = String(formData.get('ends_at') || '');
  const maxText = String(formData.get('max_redemptions') || '').trim();
  const maxRedemptions = maxText ? Number(maxText) : null;
  const enabled = formData.get('enabled') === 'on';
  const showInCart = formData.get('show_in_cart') === 'on';
  const firstOrderOnly = formData.get('first_order_only') === 'on';
  const parseIndiaDateTime = (value: string) => value ? new Date(`${value}:00+05:30`) : null;
  const startsAt = parseIndiaDateTime(startsAtText) ?? new Date();
  const endsAt = parseIndiaDateTime(endsAtText);
  if ((id && !/^[0-9a-f-]{36}$/i.test(id)) || !/^[A-Z0-9_-]{3,32}$/.test(code) || title.length < 2 || title.length > 120 || !['percentage', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percentage' && discountValue > 95) || !Number.isFinite(startsAt.getTime()) || (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)) || (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1))) throw new Error('Check the promotion details.');
  const db = await serverDb();
  const user = await currentUser();
  if (!db) throw new Error('Database unavailable');
  const values = { code, title, discount_type: discountType, discount_value: discountValue, starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null, max_redemptions: maxRedemptions, enabled, show_in_cart: showInCart, first_order_only: firstOrderOnly, updated_at: new Date().toISOString() };
  const result = id
    ? await db.from('store_promotions').update(values).eq('id', id)
    : await db.from('store_promotions').insert({ ...values, created_by: user?.id ?? null });
  if (result.error) throw new Error(result.error.code === '23505' ? 'That promotion code already exists.' : 'Could not save the promotion.');
  revalidatePath('/admin/promotions');
  revalidatePath('/');
  revalidatePath('/cart/checkout');
}

export async function togglePromotion(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  const enabled = formData.get('enabled') === 'true';
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid promotion.');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { error } = await db.from('store_promotions').update({ enabled: !enabled, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('Could not update this promotion.');
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

export async function setHomepagePromotion(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  const featured = formData.get('featured') === 'true';
  if (featured && !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Choose a valid promotion.');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { error } = await db.rpc('set_homepage_promotion', { p_promotion_id: featured ? id : null });
  if (error) throw new Error('Could not update the homepage promotion.');
  revalidatePath('/admin/promotions');
  revalidatePath('/');
}

export async function deletePromotion(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid promotion.');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { error } = await db.from('store_promotions').delete().eq('id', id);
  if (error) throw new Error('Could not delete this coupon.');
  revalidatePath('/admin/promotions');
  revalidatePath('/');
  revalidatePath('/cart/checkout');
}
