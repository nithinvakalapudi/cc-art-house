import Link from 'next/link';
import CheckoutForm from '@/components/checkout-form';
import { serverDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const db = await serverDb();
  if (!db) return <><div className="page-header"><h1>Delivery details</h1></div><div className="content"><div className="notice">Checkout is temporarily unavailable. Please try again shortly.</div><Link className="text-link" href="/cart">Back to cart</Link></div></>;
  const { data } = await db.auth.getUser();
  if (!data.user) return <><div className="page-header"><h1>Sign in to place your order</h1></div><div className="content"><div className="checkout-login panel"><p>Sign in or create an account to continue. We’ll bring you back to checkout.</p><Link className="button primary" href="/account?returnTo=checkout">Continue to sign in</Link><Link className="text-link" href="/cart">Back to cart</Link></div></div></>;
  const razorpayReady = Boolean(
    /^rzp_(test|live)_[A-Za-z0-9]+$/.test(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '') &&
    process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const identity = { name: String(data.user.user_metadata?.full_name || ''), email: data.user.email || '' };
  return <><div className="page-header"><div className="checkout-progress" aria-label="Checkout progress"><span><b>✓</b> Your cart</span><span aria-current="step"><b>2</b> Delivery details</span><span><b>3</b> Confirmation</span></div><h1>Delivery and payment</h1><p>We deliver artwork to your address. Choose how you’d like to pay.</p></div><div className="content checkout-content"><CheckoutForm identity={identity} razorpayReady={razorpayReady}/></div></>;
}

