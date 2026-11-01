'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { isAdmin, serverDb } from '@/lib/supabase-server';

const kinds = ['size', 'style', 'medium', 'frame', 'complexity', 'priority'] as const;
const createSchema = z.object({
  kind: z.enum(kinds),
  option_key: z.string().regex(/^[a-z0-9_-]{2,80}$/),
  label: z.string().trim().min(2).max(120),
  amount: z.coerce.number().finite().nonnegative(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});
const updateSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(2).max(120),
  amount: z.coerce.number().finite().nonnegative(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

async function adminDb() {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  return db;
}

function refreshPricing() {
  revalidatePath('/admin/pricing');
  revalidatePath('/api/pricing');
  revalidatePath('/custom-art');
}

export async function saveRule(form: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) throw new Error('Check the option, key, price, and display order.');
  const db = await adminDb();
  const { error } = await db.from('custom_pricing_rules').insert({ ...parsed.data, active: true });
  if (error) throw new Error(error.message);
  refreshPricing();
}

export async function updateRule(form: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) throw new Error('Check the option details.');
  const db = await adminDb();
  const { error } = await db.from('custom_pricing_rules').update({
    label: parsed.data.label,
    amount: parsed.data.amount,
    sort_order: parsed.data.sort_order,
    active: form.get('active') === 'on',
  }).eq('id', parsed.data.id);
  if (error) throw new Error(error.message);
  refreshPricing();
}
