'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;
type AppliedPromotion = { code: string; title: string; discount: number };

export default function CheckoutPromotionCode({ subtotal, onApplied }: { subtotal: number; onApplied: (promotion: AppliedPromotion | null) => void }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function apply() {
    if (!db || !code.trim()) { setMessage('Enter a coupon code first.'); setSuccess(false); return; }
    setBusy(true); setMessage('');
    const { data, error } = await db.rpc('quote_store_promotion', { p_code: code.trim().toUpperCase(), p_subtotal: subtotal });
    setBusy(false);
    if (error) { onApplied(null); setSuccess(false); setMessage('Coupons are temporarily unavailable. Please try again.'); return; }
    const quote = data as { valid?: boolean; code?: string; title?: string; discount_amount?: number; message?: string };
    if (!quote.valid || !quote.code) { onApplied(null); setSuccess(false); setMessage(quote.message || 'That coupon could not be applied.'); return; }
    onApplied({ code: quote.code, title: quote.title || quote.code, discount: Number(quote.discount_amount || 0) });
    setSuccess(true); setMessage(`${quote.title || quote.code} applied. You save ₹${Number(quote.discount_amount || 0).toLocaleString('en-IN')}.`);
  }

  return <div className="checkout-coupon">
    <label className="field">Coupon code<div className="checkout-coupon-control"><input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); onApplied(null); setSuccess(false); setMessage(''); }} maxLength={32} placeholder="Enter your code" autoCapitalize="characters"/><button type="button" className="button secondary" onClick={apply} disabled={busy || subtotal <= 0}>{busy ? 'Checking…' : 'Apply'}</button></div></label>
    {message && <p className={success ? 'checkout-coupon-message success' : 'checkout-coupon-message'} role="status">{message}</p>}
  </div>;
}
