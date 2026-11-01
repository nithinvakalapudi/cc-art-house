'use server';

import { revalidatePath } from 'next/cache';
import { currentUser, isAdmin, serverDb } from '@/lib/supabase-server';

export async function saveCustomerNote(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const email = String(formData.get('customer_email') || '').trim().toLowerCase();
  const name = String(formData.get('customer_name') || '').trim();
  const note = String(formData.get('note') || '').trim();
  const tags = String(formData.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
  const followUp = String(formData.get('follow_up_on') || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 || name.length > 120 || note.length > 4000 || tags.some((tag) => tag.length > 40) || (followUp && !/^\d{4}-\d{2}-\d{2}$/.test(followUp))) throw new Error('Check the customer note details.');
  const db = await serverDb();
  const user = await currentUser();
  if (!db) throw new Error('Database unavailable');
  const { error } = await db.from('admin_customer_notes').upsert({ customer_email: email, customer_name: name, note, tags, follow_up_on: followUp || null, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'customer_email' });
  if (error) throw new Error('Could not save the customer note.');
  revalidatePath('/admin/customers');
}
