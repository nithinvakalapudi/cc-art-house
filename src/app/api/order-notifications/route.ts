import { NextResponse } from 'next/server';
import {z} from 'zod';
import {sendOrderEmail} from '@/lib/order-email';
const input=z.object({orderId:z.string().uuid(),event:z.string().regex(/^(placed|payment:paid|status:[a-z0-9_:-]{3,60})$/)});
export async function POST(request:Request){let value:unknown;try{value=await request.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}const parsed=input.safeParse(value);if(!parsed.success)return NextResponse.json({error:'Invalid request.'},{status:400});const sent=await sendOrderEmail(parsed.data.orderId,parsed.data.event);return NextResponse.json({sent});}


