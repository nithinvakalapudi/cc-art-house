'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
declare global{interface Window{Razorpay?:new(options:Record<string,unknown>)=>{open:()=>void}}}
export default function RazorpayPayButton({orderId,canPay}:{orderId:string;canPay:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[paid,setPaid]=useState(false);const router=useRouter();
 async function pay(){setBusy(true);setError('');try{
  if(!window.Razorpay){await new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Secure payment could not load. Please try again.'));document.body.appendChild(script);});}
  const response=await fetch('/api/payments/razorpay/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId})});const details=await response.json();if(!response.ok)throw new Error(details.error||'Payment could not start.');
  const checkout=new window.Razorpay!({key:details.keyId,amount:details.amount,currency:details.currency,name:'The Art House',description:'Original artwork order',order_id:details.providerOrderId,theme:{color:'#203d40'},modal:{ondismiss:()=>setBusy(false)},handler:async(result:{razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string})=>{try{const verified=await fetch('/api/payments/razorpay/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...result,store_order_id:orderId})});const outcome=await verified.json();if(!verified.ok)throw new Error(outcome.error||'Payment needs confirmation.');setPaid(true);router.refresh();}catch(caught){setError(caught instanceof Error?caught.message:'Payment needs confirmation.');}finally{setBusy(false);}}});checkout.open();
 }catch(caught){setError(caught instanceof Error?caught.message:'Payment could not start.');setBusy(false);}}
 return <div className="razorpay-action">{paid?<p role="status" className="success">Payment confirmed securely. Your order is paid.</p>:<><button type="button" className="button primary" onClick={pay} disabled={busy||!canPay}>{busy?'Opening secure payment…':canPay?'Pay securely with Razorpay':'Delivery charge must be confirmed before payment'}</button>{error&&<p className="error" role="alert">{error}</p>}</>}</div>;
}

