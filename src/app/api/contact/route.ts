import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { serviceDb } from '@/lib/supabase-service';
import { readBoundedBody } from '@/lib/request-body';

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().max(30).optional().default(''),
  address: z.string().trim().max(250).optional().default(''),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(3000),
  website: z.string().optional().default(''),
  campaign: z.string().max(1200).optional(),
});

export async function POST(request: NextRequest) {
  const body = await readBoundedBody(request, 16_384);
  if (!body) return NextResponse.json({ error: 'Your message is too large. Please shorten it and try again.' }, { status: 413 });

  let input: unknown;
  try { input = JSON.parse(new TextDecoder().decode(body)); } catch { return NextResponse.json({ error: 'Please check your message and try again.' }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: 'Please complete the required fields.' }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const db = serviceDb();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!db || !serviceKey) return NextResponse.json({ error: 'The studio inbox is temporarily unavailable.' }, { status: 503 });

  const clientIp = request.headers.get('x-nf-client-connection-ip')
    ?? request.headers.get('x-real-ip')
    ?? 'unavailable';
  const ipKey = createHmac('sha256', serviceKey).update(clientIp).digest('hex');
  const { data: allowed, error: limitError } = await db.rpc('consume_submission_rate_limit', { p_key_hash: ipKey });
  if (limitError) return NextResponse.json({ error: 'The studio inbox is temporarily unavailable.' }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: 'Please wait a few minutes before sending another message.' }, { status: 429, headers: { 'Retry-After': '600' } });

  const { name, email, phone, address, subject, message, campaign } = parsed.data;
  const campaignNote = campaign ? `\n\nCampaign: ${campaign}` : '';
  const savedMessage = message.length + campaignNote.length <= 3000 ? `${message}${campaignNote}` : message;
  const { error } = await db.from('contact_messages').insert({ name, email, phone: phone || null, address: address || null, subject, message: savedMessage });
  if (error) return NextResponse.json({ error: 'Unable to send your message right now.' }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
