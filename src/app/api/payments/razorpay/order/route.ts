import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !url || !serviceKey) return NextResponse.json({ error: 'Online payments are being configured.' }, { status: 503 });
  const db = await serverDb();
  if (!db) return NextResponse.json({ error: 'Please sign in to pay.' }, { status: 401 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to pay.' }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid payment request.' }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
  const orderId = parsed.data.orderId;
  const { data: attempt, error } = await db.rpc('create_razorpay_attempt', { p_order_id: orderId });
  if (error || !attempt) return NextResponse.json({ error: error?.message.includes('DELIVERY_PRICE_REQUIRED') ? 'The studio must confirm delivery pricing before payment.' : 'This order is not ready for payment.' }, { status: 409 });
  try {
    const gateway = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await gateway.orders.create({ amount: attempt.amount, currency: 'INR', receipt: `art_${orderId.replaceAll('-', '').slice(0, 24)}`, notes: { store_order_id: orderId, customer_id: user.id } });
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: saveError } = await service.rpc('set_razorpay_order', { p_attempt_id: attempt.attempt_id, p_provider_order_id: order.id });
    if (saveError) throw new Error('Could not link payment.');
    return NextResponse.json({ keyId, providerOrderId: order.id, amount: order.amount, currency: order.currency, storeOrderId: orderId });
  } catch {
    return NextResponse.json({ error: 'Razorpay could not start this payment. Your order is saved; check Your orders before retrying.' }, { status: 502 });
  }
}
