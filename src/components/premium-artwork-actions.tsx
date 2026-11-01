'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

export default function PremiumArtworkActions({productId,title,reservationEnabled}:{productId:string;title:string;reservationEnabled:boolean}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 function addCompare(){const current=JSON.parse(localStorage.getItem('art-compare')||'[]') as string[];localStorage.setItem('art-compare',JSON.stringify([...new Set([...current,productId])].slice(-3)));setMessage(`${title} added to comparison.`);}
 async function reserve(){setBusy(true);setMessage('');const {data:{user}}=await db.auth.getUser();if(!user){setBusy(false);setMessage('Sign in to reserve this artwork.');return}const {data,error}=await db.rpc('reserve_artwork',{p_product_id:productId});setBusy(false);setMessage(error?'This artwork is already reserved or unavailable.':`Reserved for you until ${new Date((data as {expires_at:string}).expires_at).toLocaleString('en-IN')}.`)}
 async function alerts(){setBusy(true);const {data:{user}}=await db.auth.getUser();if(!user){setBusy(false);setMessage('Sign in to enable wishlist alerts.');return}const {error}=await db.from('wishlist_alerts').upsert({product_id:productId,user_id:user.id,similar_art:true,availability:true,price_changes:true});setBusy(false);setMessage(error?'Alerts could not be enabled.':'Alerts enabled for similar art, availability, and price changes.')}
 return <div className="premium-art-actions">{reservationEnabled&&<button type="button" className="button outline" disabled={busy} onClick={reserve}>Reserve for 24 hours</button>}<button type="button" className="button outline" onClick={addCompare}>Add to comparison</button><button type="button" className="text-link" disabled={busy} onClick={alerts}>Enable artwork alerts</button><Link className="text-link" href="/compare">View comparison</Link>{message&&<p role="status" className="premium-action-message">{message}</p>}</div>;
}
