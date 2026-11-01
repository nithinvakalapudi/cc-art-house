'use server';

import { revalidatePath } from 'next/cache';
import { isAdmin, serverDb } from '@/lib/supabase-server';

export async function updateInventory(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  const stock = Number(formData.get('stock_quantity'));
  const threshold = Number(formData.get('low_stock_threshold'));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(stock) || stock < 0 || stock > 100000 || !Number.isInteger(threshold) || threshold < 0 || threshold > 100000) throw new Error('Enter valid inventory values.');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { error } = await db.from('products').update({ stock_quantity: stock, low_stock_threshold: threshold, available: stock > 0 }).eq('id', id);
  if (error) throw new Error('Could not update inventory.');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/products');
  revalidatePath('/shop');
}
