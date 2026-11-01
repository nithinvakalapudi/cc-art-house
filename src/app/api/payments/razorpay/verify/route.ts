import { createHmac,timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase-server';
import { sendOrderEmail } from '@/lib/order-email';
export const runtime='nodejs';
const schema=z.object({razorpay_order_id:z.string().regex(/^order_[A-Za-z0-9]+$/),razorpay_payment_id:z.string().regex(/^pay_[A-Za-z0-9]+$/),razorpay_signature:z.string().regex(/^[a-f0-9]{64}$/i),store_order_id:z.string().uuid()});
export async function POST(request:Request){
 const secret=process.env.RAZORPAY_KEY_SECRET,url=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret||!url||!serviceKey)return NextResponse.json({error:'Payment confirmation is being configured. Please contact the studio before retrying.'},{status:503});
 const db=await serverDb();if(!db)return NextResponse.json({error:'Please sign in again.'},{status:401});const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 let raw:unknown;try{raw=await request.json();}catch{return NextResponse.json({error:'Invalid payment response.'},{status:400});}const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:'Invalid payment response.'},{status:400});const body=parsed.data;
 const digest=createHmac('sha256',secret).update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest();const received=Buffer.from(body.razorpay_signature,'hex');if(digest.length!==received.length||!timingSafeEqual(digest,received))return NextResponse.json({error:'Razorpay could not verify this payment.'},{status:400});
 const {data:owned}=await db.from('orders').select('id,razorpay_order_id').eq('id',body.store_order_id).eq('user_id',user.id).maybeSingle();if(!owned||owned.razorpay_order_id!==body.razorpay_order_id)return NextResponse.json({error:'The payment does not match this order.'},{status:403});
 const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await service.rpc('confirm_razorpay_payment',{p_order_id:body.store_order_id,p_provider_order_id:body.razorpay_order_id,p_payment_id:body.razorpay_payment_id});if(error)return NextResponse.json({error:'The gateway received your payment; please contact the studio with this order number.'},{status:502});after(()=>sendOrderEmail(body.store_order_id,'payment:paid'));return NextResponse.json({ok:true});
}
