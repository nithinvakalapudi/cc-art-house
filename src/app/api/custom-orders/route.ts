import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase-server';
import { serviceDb } from '@/lib/supabase-service';
import { readBoundedBody } from '@/lib/request-body';

const schema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(25),
  painting_type: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  size: z.string().trim().min(2).max(200),
  style: z.string().trim().min(2).max(200),
  medium: z.string().trim().min(2).max(200),
  frame: z.string().trim().min(2).max(200),
  complexity: z.string().trim().min(2).max(500),
  priority: z.string().trim().min(2).max(200),
  dimensions: z.string().trim().max(120),
  colors: z.string().trim().max(200),
  budget: z.string().trim(),
  delivery_date: z.string().trim(),
  instructions: z.string().trim().max(5000),
});

export async function POST(request: NextRequest) {
  const db = await serverDb();
  if (!db) return NextResponse.json({ error: 'Store is not connected.' }, { status: 503 });

  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in before submitting your request.' }, { status: 401 });

  const service = serviceDb();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service || !serviceKey) return NextResponse.json({ error: 'Store is not connected.' }, { status: 503 });
  const userKey = createHmac('sha256', serviceKey).update(`custom-art:${auth.user.id}`).digest('hex');
  const { data: allowed, error: limitError } = await service.rpc('consume_submission_rate_limit', { p_key_hash: userKey });
  if (limitError) return NextResponse.json({ error: 'Store is temporarily unavailable.' }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: 'Please wait a few minutes before sending another custom artwork request.' }, { status: 429, headers: { 'Retry-After': '600' } });

  const body = await readBoundedBody(request, 16_000_000);
  if (!body) return NextResponse.json({ error: 'The request must be under 16 MB, including reference images.' }, { status: 413 });

  let form: FormData;
  const formBytes = new ArrayBuffer(body.byteLength);
  new Uint8Array(formBytes).set(body);
  try { form = await new Response(formBytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { return NextResponse.json({ error: 'We could not read this form. Please try again.' }, { status: 400 }); }

  const raw = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string'));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Please complete every required field and check the information entered.' }, { status: 400 });

  const files = form.getAll('references').filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 3 || files.some(file => file.size > 5_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
    return NextResponse.json({ error: 'Use up to three JPG, PNG, or WebP images of 5 MB each.' }, { status: 400 });
  }

  const details = parsed.data;
  const budget = details.budget ? Number(details.budget) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return NextResponse.json({ error: 'Please enter a valid budget.' }, { status: 400 });

  const { data: order, error } = await db.from('custom_orders').insert({
    user_id: auth.user.id,
    ...details,
    budget,
    delivery_date: details.delivery_date || null,
    estimated_price: 0,
    pricing_snapshot: { status: 'quote_pending', submitted_at: new Date().toISOString() },
    production_status: 'submitted',
    payment_status: 'unpaid',
  }).select('id').single();

  if (error || !order) return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 });

  for (const file of files) {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${auth.user.id}/${order.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await db.storage.from('custom-references').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) return NextResponse.json({ error: `Request ${order.id.slice(0, 8).toUpperCase()} was saved, but a reference image failed to upload.`, id: order.id }, { status: 500 });
    const image = await db.from('custom_order_images').insert({ custom_order_id: order.id, storage_path: path, content_type: file.type, byte_size: file.size, kind: 'reference' });
    if (image.error) return NextResponse.json({ error: `Request ${order.id.slice(0, 8).toUpperCase()} was saved, but its image record could not be completed.`, id: order.id }, { status: 500 });
  }

  return NextResponse.json({ id: order.id, quote_status: 'pending' }, { status: 201 });
}
