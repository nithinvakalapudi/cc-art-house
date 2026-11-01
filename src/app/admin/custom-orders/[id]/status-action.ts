'use server';

import { revalidatePath } from 'next/cache';
import { isAdmin, serverDb } from '@/lib/supabase-server';

export async function updateCustomStatus(form: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');

  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  const notes = String(form.get('internal_notes') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || notes.length > 5000) throw new Error('Invalid change');

  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { data: current, error: readError } = await db.from('custom_orders')
    .select('production_status,payment_status').eq('id', id).single();
  if (readError || !current) throw new Error('Request not found');

  const allowed: Record<string, string[]> = {
    submitted: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['preview_ready', 'completed', 'cancelled'],
    preview_ready: ['in_progress', 'completed'],
    completed: ['dispatched'],
    dispatched: ['delivered'],
    delivered: [],
    cancelled: ['refunded'],
    refunded: [],
  };
  if (status !== current.production_status && !allowed[current.production_status]?.includes(status)) {
    throw new Error('This production transition is not permitted');
  }
  if (status === 'confirmed' && !['paid', 'partially_paid'].includes(current.payment_status)) {
    throw new Error('Payment must be verified before confirmation');
  }
  if (status === 'refunded' && current.payment_status !== 'refunded') throw new Error('Verified refund required');

  const { data: updated, error } = await db.from('custom_orders')
    .update({ production_status: status })
    .eq('id', id).eq('production_status', current.production_status).select('id').maybeSingle();
  if (error || !updated) throw new Error('Request changed while you were editing. Refresh and retry.');

  const { data: userData } = await db.auth.getUser();
  const { error: noteError } = await db.from('custom_order_admin_notes').upsert({
    custom_order_id: id,
    note: notes,
    updated_by: userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'custom_order_id' });
  if (noteError) throw new Error('Progress was saved, but the private note could not be saved. Please retry.');

  if (status !== current.production_status) {
    await db.from('custom_order_status_history').insert({
      custom_order_id: id,
      from_status: current.production_status,
      to_status: status,
    });
  }

  revalidatePath(`/admin/custom-orders/${id}`);
  revalidatePath('/admin/custom-orders');
}
