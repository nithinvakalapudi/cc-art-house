import Link from 'next/link';
import CheckoutForm from '@/components/checkout-form';
import { serverDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const db = await serverDb();
  if (!db) return <><div className="page-header"><h1>Delivery details</h1></div><div className="content"><div className="notice">Checkout is temporarily unavailable. Please try again shortly.</div><Link className="text-link" href="/cart">Back to cart</Link></div></>;
  const { data } = await db.auth.getUser();
  if (!data.user) return <><div className="page-header"><p className="craft-eyebrow">ALMOST YOURS</p><h1>Sign in to place your order</h1><p>Your account keeps your order details together.</p></div><div className="content"><div className="checkout-login panel"><p>Please sign in or create a customer account, and we’ll bring you back to delivery details.</p><Link className="button primary" href="/account?returnTo=checkout">Continue to sign in</Link><Link className="text-link" href="/cart">Back to cart</Link></div></div></>;
  const razorpayReady = Boolean(
    /^rzp_(test|live)_[A-Za-z0-9]+$/.test(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '') &&
    process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const identity = { name: String(data.user.user_metadata?.full_name || ''), email: data.user.email || '' };
  return <><div className="page-header"><div className="checkout-progress" aria-label="Checkout progress"><span><b>✓</b> Your cart</span><span aria-current="step"><b>2</b> Delivery details</span><span><b>3</b> Confirmation</span></div><h1>Where should we send your art?</h1><p>Your delivery details will be shared with our studio team for this order.</p></div><div className="content checkout-content"><CheckoutForm identity={identity} razorpayReady={razorpayReady}/></div></>;
}

