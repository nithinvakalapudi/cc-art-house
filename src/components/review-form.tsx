'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
export default function ReviewForm({productId,itemId}:{productId:string;itemId:string}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [done,setDone]=useState(false);const router=useRouter();
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');let photoPath:string|null=null;
 const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
 try{const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Please sign in again.');
 const photo=form.get('photo') as File|null;
 if(photo?.size){if(photo.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(photo.type))throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');
 // Re-encode to JPEG to remove camera metadata and cap the published resolution.
 const bitmap=await createImageBitmap(photo);const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo processing is unavailable.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw new Error('Please try another photo.');photoPath=`${user.id}/${itemId}.jpg`;const {error}=await db.storage.from('review-photos').upload(photoPath,blob,{contentType:'image/jpeg'});if(error)throw new Error('Photo upload failed. Try without a photo, or choose another image.');}
 const {error}=await db.from('product_reviews').insert({product_id:productId,order_item_id:itemId,user_id:user.id,display_name:String(form.get('display_name')).trim(),rating:Number(form.get('rating')),body:String(form.get('body')).trim(),photo_path:photoPath});
 if(error){if(photoPath)await db.storage.from('review-photos').remove([photoPath]);throw new Error(error.code==='23505'?'You have already reviewed this painting.':'Only delivered purchases can be reviewed. Please check your details and try again.');}
 setDone(true);setMessage('Thank you — your verified review is published.');router.refresh();
 }catch(error){setMessage(error instanceof Error?error.message:'Review could not be saved.');}finally{setBusy(false);}}
 return <details className="review-form"><summary>Review this painting</summary>{done?<p role="status">{message}</p>:<form onSubmit={submit}><p>Your display name, review and optional photo will be public. Please avoid personal details in your photo.</p><label className="field">Public display name<input name="display_name" required minLength={2} maxLength={60}/></label><label className="field">Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label><label className="field">Your experience<textarea name="body" required minLength={10} maxLength={1500}/></label><label className="field">Photo (optional, up to 5 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label><button disabled={busy} className="button primary">{busy?'Publishing…':'Publish verified review'}</button>{message&&<p role="alert">{message}</p>}</form>}</details>;
}
