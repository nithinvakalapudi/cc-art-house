'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sendOrderEmail } from '@/lib/order-email';
import { isAdmin, serverDb } from '@/lib/supabase-server';

const statuses = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled'] as const;
const payments = ['unpaid', 'pending', 'paid', 'refunded'] as const;
const packaging = ['awaiting_artwork','quality_check','protective_wrap','framed','packed','dispatched','delivered'] as const;

export async function updateOrder(formData: FormData) {
  if (!await isAdmin()) throw new Error('Unauthorized');
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  const paymentStatus = String(formData.get('payment_status') || '');
  const paymentMethod = String(formData.get('payment_method') || '');
  const deliveryFee = Number(formData.get('delivery_fee'));
  const deliveryPriced = formData.get('delivery_priced') === 'on';
  const packagingStatus = String(formData.get('packaging_status') || 'awaiting_artwork');
  const trackingCarrier = String(formData.get('tracking_carrier') || '').trim();
  const trackingNumber = String(formData.get('tracking_number') || '').trim();
  const trackingUrl = String(formData.get('tracking_url') || '').trim();
  const fulfillmentNote = String(formData.get('fulfillment_note') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.includes(status as typeof statuses[number]) || !payments.includes(paymentStatus as typeof payments[number]) || !['to_be_arranged', 'cash_on_delivery', 'upi', 'bank_transfer', 'razorpay'].includes(paymentMethod) || !packaging.includes(packagingStatus as typeof packaging[number]) || !Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 100000 || trackingCarrier.length > 120 || trackingNumber.length > 160 || fulfillmentNote.length > 1000 || (trackingUrl && (!/^https:\/\//i.test(trackingUrl) || trackingUrl.length > 1000))) throw new Error('Invalid order update');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { data: previous } = await db.from('orders').select('status,payment_status,delivery_fee,delivery_priced').eq('id', id).maybeSingle();
  const { data: updated, error } = await db.from('orders').update({ status, payment_status: paymentStatus, payment_method: paymentMethod, delivery_fee: deliveryFee, delivery_priced: deliveryPriced, packaging_status: packagingStatus, tracking_carrier: trackingCarrier || null, tracking_number: trackingNumber || null, tracking_url: trackingUrl || null, fulfillment_note: fulfillmentNote, updated_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
  if (error || !updated) throw new Error('Unable to update this order. Check that this account still has write access.');
  if (previous && (previous.status !== status || previous.payment_status !== paymentStatus || Number(previous.delivery_fee) !== deliveryFee || previous.delivery_priced !== deliveryPriced)) {
    await sendOrderEmail(id, `status:${status}:${paymentStatus}:${Date.now()}`);
  }
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  revalidatePath('/admin');
  redirect(`/admin/orders/${id}?updated=1`);
}
