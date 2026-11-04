'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { sendOrderEmail } from '@/lib/order-email';
import { serverDb } from '@/lib/supabase-server';

export type CancelOrderState = { error: string; success: boolean };

export async function cancelOrder(_previous: CancelOrderState, formData: FormData): Promise<CancelOrderState> {
  const orderId = String(formData.get('order_id') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || reason.length > 500) {
    return { error: 'Please check the order details and try again.', success: false };
  }

  const db = await serverDb();
  if (!db) return { error: 'Order cancellation is temporarily unavailable.', success: false };
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Please sign in again before cancelling this order.', success: false };

  const { error } = await db.rpc('cancel_store_order', { p_order_id: orderId, p_reason: reason });
  if (error) {
    const message = error.message.includes('ORDER_NOT_CANCELLABLE')
      ? 'This order can no longer be cancelled online. Please contact the studio for help.'
      : 'We couldn’t cancel this order. Please try again or contact the studio.';
    return { error: message, success: false };
  }

  after(async () => { await sendOrderEmail(orderId, 'customer_cancelled'); });
  revalidatePath('/account/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin');
  return { error: '', success: true };
}
