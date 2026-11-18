'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

export default function PremiumArtworkActions({productId}:{productId:string}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function alerts(){setBusy(true);const {data:{user}}=await db.auth.getUser();if(!user){setBusy(false);setMessage('Sign in to enable wishlist alerts.');return}const {error}=await db.from('wishlist_alerts').upsert({product_id:productId,user_id:user.id,similar_art:true,availability:true,price_changes:true});setBusy(false);setMessage(error?'Alerts could not be enabled.':'Alerts enabled for similar art, availability, and price changes.')}
 return <div className="premium-art-actions"><button type="button" className="text-link" disabled={busy} onClick={alerts}>Enable artwork alerts</button>{message&&<p role="status" className="premium-action-message">{message}</p>}</div>;
}
