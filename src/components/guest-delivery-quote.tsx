'use client';

import { useState, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useCart } from './cart-store';

type Quote = { priced: boolean; zone: string; fee: number; estimated_days: number };

export default function GuestDeliveryQuote() {
  const { items } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [quote, setQuote] = useState<(Quote & { checkedAt: number }) | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const postalCode = String(new FormData(event.currentTarget).get('postalCode') ?? '').trim();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    setPending(true);
    setQuote(null);
    setError('');
    try {
      if (!url || !key) throw new Error();
      const { data, error } = await createBrowserClient(url, key).rpc('get_delivery_quote', { p_postal_code: postalCode });
      if (error || !data) throw new Error();
      setQuote({ ...data, checkedAt: Date.now() });
    } catch {
      setError('Delivery estimates are temporarily unavailable. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const arrival = quote?.priced && Number.isFinite(quote.estimated_days)
    ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(quote.checkedAt + quote.estimated_days * 86_400_000)
    : null;

  if (!items.length) return null;

  return <section className="panel guest-delivery-quote">
    <h2>Check delivery or pickup</h2>
    <form onSubmit={check}>
      <label className="field">PIN code
        <input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required disabled={pending} onChange={() => { setQuote(null); setError(''); }} />
      </label>
      <button className="button outline" disabled={pending}>{pending ? 'Checking…' : 'Check delivery'}</button>
    </form>
    <div role="status">
      {error && <p>{error}</p>}
      {quote && (quote.priced
        ? <p><strong>{subtotal >= 2000 || !quote.fee ? 'Free delivery' : '₹' + Number(quote.fee).toLocaleString('en-IN')}</strong> to {quote.zone}{arrival && <> · Estimated arrival {arrival}</>}.</p>
        : <p>The studio will confirm the delivery charge and timing for this PIN code before payment.</p>)}
    </div>
    <p><strong>Free studio pickup</strong> near Kundalahalli Gate, Bengaluru. Choose pickup at checkout to arrange a collection time.</p>
  </section>;
}
