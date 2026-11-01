'use client';



import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { createBrowserClient } from '@supabase/ssr';

import Link from 'next/link';

import { useCart } from './cart-store';
import RazorpayPayButton from './razorpay-pay-button';
import CheckoutPromotionCode from './checkout-promotion-code';



const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const db = url && key ? createBrowserClient(url, key) : null;

const FREE_DELIVERY_MINIMUM = 2000;



export default function CheckoutForm({ identity }: { identity: { name: string; email: string } }) {

  const router = useRouter();

  const { items, clear } = useCart();

  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');

  const [orderId, setOrderId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('to_be_arranged');
  const [orderTotal, setOrderTotal] = useState(0);
  const [deliveryQuote, setDeliveryQuote] = useState<{priced:boolean;zone?:string;fee?:number;estimated_days?:number}|null>(null);
  const [giftWrap, setGiftWrap] = useState(false);
  const [promotion, setPromotion] = useState<{code:string;title:string;discount:number}|null>(null);



  async function submit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault(); setBusy(true); setError('');

    if (!db) { setBusy(false); setError('Ordering is temporarily unavailable. Please try again.'); return; }

    if (!items.length) { setBusy(false); setError('Your cart is empty.'); return; }

    const { data: auth, error: authError } = await db.auth.getUser();

    if (authError || !auth.user) { setBusy(false); router.push('/account?next=/cart/checkout'); return; }

    const form = new FormData(event.currentTarget);

    const submittedPaymentMethod = String(form.get('payment_method') || 'to_be_arranged');
    if (submittedPaymentMethod === 'razorpay' && deliveryMethod === 'shipping' && !deliveryQuote?.priced) { setBusy(false); setError('Enter a supported Bengaluru PIN code to confirm delivery pricing before paying online.'); return; }
    if (submittedPaymentMethod === 'razorpay' && giftWrap) { setBusy(false); setError('The studio must confirm gift wrapping before online payment. Choose another payment preference for now.'); return; }
    const details: Record<string,string|boolean> = Object.fromEntries(['customer_name','customer_email','phone','address_line1','address_line2','city','state','postal_code','country','delivery_method','delivery_notes','payment_method','scheduled_delivery_date'].map(name => [name, String(form.get(name) || '').trim()]));
    Object.assign(details,{hide_price_in_package:form.get('hide_price_in_package')==='on',handwritten_note:form.get('handwritten_note')==='on',whatsapp_opt_in:form.get('whatsapp_opt_in')==='on'});

    const { data, error: orderError } = await db.rpc('create_gift_order_with_promo', {

      p_details: details,

      p_gift_wrap: form.get('gift_wrap') === 'on',

      p_gift_message: String(form.get('gift_message') || '').trim(),

      p_items: items.map(item => ({ product_id: item.id, quantity: item.quantity })),
      p_promo_code: promotion?.code || null,

    });

    setBusy(false);

    if (orderError) { setError(orderError.message.includes('SOLD') ? 'One of these paintings is no longer available. Refresh your cart and try again.' : orderError.message.includes('PRICE_ON_REQUEST') ? 'A painting in your cart needs a custom quote. Please remove it and contact the studio.' : orderError.message.includes('PROMO_') ? 'That coupon is no longer available. Review the code and try again.' : 'We could not place your order. Please check your details and try again.'); return; }

    const id = typeof data === 'string' ? data : (data as { id?: string } | null)?.id;

    if (!id) { setError('The order was received but we could not confirm its number. Check Your orders before trying again.'); router.refresh(); return; }

    const {data:placedOrder}=await db.from('orders').select('total,delivery_fee,delivery_priced').eq('id',id).maybeSingle();
    setOrderTotal(Number(placedOrder?.total||total));
    setDeliveryQuote({priced:!!placedOrder?.delivery_priced,fee:Number(placedOrder?.delivery_fee||0)});
    setPaymentMethod(submittedPaymentMethod);
    void fetch('/api/order-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:id,event:'placed'})});
    clear(); setOrderId(id); router.refresh();

  }



  if (orderId) return <div className="checkout-success" role="status"><span aria-hidden="true">✓</span><p className="craft-eyebrow">ORDER RECEIVED</p><h2>Thank you. We have your order.</h2><p>Order <strong>#{orderId.slice(0, 8).toUpperCase()}</strong> · Order total ₹{orderTotal.toLocaleString('en-IN')} {deliveryQuote?.priced?'including confirmed delivery':'with delivery to be confirmed by the studio'}.</p>{paymentMethod==='razorpay'?<RazorpayPayButton orderId={orderId} canPay={!!deliveryQuote?.priced}/>:<p>The studio will contact you about delivery and payment before dispatch.</p>}<Link className="button primary" href="/account/orders">View your order</Link></div>;

  if (!items.length) return <div className="empty-card checkout-empty">Your cart is empty. Choose a painting before entering delivery details.<p><Link className="text-link" href="/shop">Browse paintings</Link></p></div>;



  const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return <><section className="checkout-order-review"><h2>Your order</h2>{items.map(item=><div className="checkout-review-item" key={item.id}><span>{item.title}<small> · Qty {item.quantity}</small></span><strong>₹{(Number(item.price)*item.quantity).toLocaleString('en-IN')}</strong></div>)}<div className="checkout-review-total"><span>Artwork subtotal</span><strong>₹{total.toLocaleString('en-IN')}</strong></div><CheckoutPromotionCode subtotal={total} onApplied={setPromotion}/>{promotion&&<><div className="checkout-review-total checkout-discount-row"><span>{promotion.code} discount</span><strong>−₹{promotion.discount.toLocaleString('en-IN')}</strong></div><div className="checkout-review-total"><span>After coupon (delivery not included)</span><strong>₹{Math.max(0,total-promotion.discount).toLocaleString('en-IN')}</strong></div></>}<p>{total >= FREE_DELIVERY_MINIMUM ? 'You qualify for free delivery to supported Bengaluru PIN codes.' : `Bengaluru delivery is ₹45. Add ₹${(FREE_DELIVERY_MINIMUM-total).toLocaleString('en-IN')} more for free delivery.`}</p></section><form className="checkout-form" onSubmit={submit}>

    <h2>Delivery details</h2><p className="muted">Please share where we should deliver your artwork. Your email is tied to your signed-in account.</p>

    <div className="form-grid">

      <label className="field">Full name<input autoComplete="name" name="customer_name" minLength={2} maxLength={120} required defaultValue={identity.name}/></label>

      <label className="field">Email address<input type="email" name="customer_email" value={identity.email || undefined} readOnly={!!identity.email} autoComplete="email" placeholder={identity.email ? undefined : 'Optional email for order updates'}/></label>

      <label className="field">Mobile number<input autoComplete="tel" name="phone" type="tel" inputMode="tel" minLength={7} maxLength={24} required placeholder="+91 98765 43210"/></label>

      <label className="field full">How would you like to receive your painting?<select name="delivery_method" value={deliveryMethod} onChange={event => {const method=event.target.value as 'shipping'|'pickup';setDeliveryMethod(method);setDeliveryQuote(method==='pickup'?{priced:true,fee:0,zone:'Studio collection'}:null);if(method==='pickup'&&paymentMethod==='razorpay'&&!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)setPaymentMethod('to_be_arranged');}}><option value="shipping">Deliver to my address</option><option value="pickup">Collect near Kundalahalli Gate, Bengaluru</option></select></label>

      {deliveryMethod === 'shipping' ? <>

        <label className="field full">Address line 1<input autoComplete="address-line1" name="address_line1" minLength={4} maxLength={180} required placeholder="House / flat, building, street"/></label>

        <label className="field full">Address line 2 (optional)<input autoComplete="address-line2" name="address_line2" maxLength={180} placeholder="Area, landmark, apartment"/></label>

        <label className="field">City<input autoComplete="address-level2" name="city" minLength={2} maxLength={100} required/></label>

        <label className="field">State<input autoComplete="address-level1" name="state" minLength={2} maxLength={100} required/></label>

        <label className="field">PIN / postal code<input autoComplete="postal-code" name="postal_code" inputMode="numeric" minLength={4} maxLength={12} required onChange={()=>setDeliveryQuote(null)} onBlur={async event=>{const code=event.currentTarget.value.trim();if(!code||!db)return;const {data}=await db.rpc('get_delivery_quote',{p_postal_code:code});const quote=data as {priced:boolean;zone?:string;fee?:number;estimated_days?:number}|null;setDeliveryQuote(quote?.priced&&total>=FREE_DELIVERY_MINIMUM?{...quote,fee:0}:quote);}}/></label>

        <label className="field">Country<input autoComplete="country-name" name="country" defaultValue="India" minLength={2} maxLength={80} required/></label>

      </> : <div className="checkout-pickup-note full"><strong>Collection point</strong><span>Near Kundalahalli Gate, Bengaluru. The studio will contact you to agree a convenient collection time.</span></div>}

      <label className="field full">{deliveryMethod === 'pickup' ? 'Collection notes (optional)' : 'Delivery instructions (optional)'}<textarea name="delivery_notes" rows={3} maxLength={1000} placeholder={deliveryMethod === 'pickup' ? 'A preferred day or time' : 'A helpful landmark or delivery timing'}/></label>

      {deliveryMethod==='shipping'&&deliveryQuote&&<p className="delivery-quote full" role="status">{deliveryQuote.priced?(Number(deliveryQuote.fee||0)===0?`Free delivery to ${deliveryQuote.zone||'your area'} · estimated ${deliveryQuote.estimated_days||'several'} days.`:`Delivery to ${deliveryQuote.zone||'your area'}: ₹${Number(deliveryQuote.fee||0).toLocaleString('en-IN')} · estimated ${deliveryQuote.estimated_days||'several'} days.`):'No fixed rate yet for this PIN code. The studio will confirm delivery before payment.'}</p>}
      <label className="field full">Preferred payment method<select name="payment_method" value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="to_be_arranged">Discuss with the studio</option><option value="upi">UPI (after order confirmation)</option><option value="bank_transfer">Bank transfer (after confirmation)</option><option value="cash_on_delivery">Cash on delivery (if available)</option><option value="razorpay" disabled={!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID||giftWrap}>Pay online with Razorpay{giftWrap?' (gift wrapping must be confirmed first)':!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?' (being configured)':''}</option></select></label>

    </div>

    <fieldset className="gift-options"><legend>Delivery and updates</legend><label className="field">Preferred delivery date (optional)<input type="date" name="scheduled_delivery_date" min={new Date().toISOString().slice(0,10)}/></label><label><input type="checkbox" name="whatsapp_opt_in"/> Send order and packaging updates on WhatsApp</label></fieldset><fieldset className="gift-options"><legend>Make it a gift</legend><label><input type="checkbox" name="gift_wrap" checked={giftWrap} onChange={event=>{setGiftWrap(event.target.checked);if(event.target.checked&&paymentMethod==='razorpay')setPaymentMethod('to_be_arranged');}}/> Request gift wrapping</label><p className="muted">The studio will confirm wrapping availability and any charge before payment.</p><label><input type="checkbox" name="handwritten_note"/> Handwrite the message on a studio card</label><label><input type="checkbox" name="hide_price_in_package"/> Keep prices out of the package</label><label className="field">Personal message (optional)<textarea name="gift_message" maxLength={500} rows={3} placeholder="A little note for someone special…"/></label></fieldset><div className="checkout-payment-note"><strong>{paymentMethod==='razorpay'?'Secure online payment':'Payment preference only'}</strong><span>{paymentMethod==='razorpay'?'Your order total is calculated from the store record. Razorpay will process the payment securely; the store only marks it paid after verifying the provider signature.':'This does not charge you online. The studio will confirm availability, delivery charges and your chosen payment method before you pay.'}</span></div>

    {error && <p role="alert" className="error">{error}</p>}

    <button className="button primary" type="submit" disabled={busy || items.length === 0}>{busy ? <><span className="loading-spinner" aria-hidden="true"/> Placing order…</> : 'Place order'}</button>

  </form></>;

}

