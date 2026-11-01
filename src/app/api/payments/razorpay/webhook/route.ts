import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
  const signature = request.headers.get('x-razorpay-signature') || '';
  if (!/^[a-f0-9]{64}$/i.test(signature)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: { store_order_id?: string } } } } };
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (event.event !== 'payment.captured') return NextResponse.json({ received: true });
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id || !/^[0-9a-f-]{36}$/i.test(payment.notes?.store_order_id || '')) return NextResponse.json({ error: 'Missing order information.' }, { status: 400 });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.rpc('confirm_razorpay_payment', { p_order_id: payment.notes!.store_order_id, p_provider_order_id: payment.order_id, p_payment_id: payment.id });
  if (error) return NextResponse.json({ error: 'Payment does not match an open store order.' }, { status: 409 });
  return NextResponse.json({ received: true });
}
