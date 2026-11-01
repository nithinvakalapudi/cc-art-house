'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;

export default function AuthLinks() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(!!db);
  const [signingOut, setSigningOut] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setChecking(false);
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (!db) return;
    setSigningOut(true);
    const { error } = await db.auth.signOut();
    setSigningOut(false);
    if (!error) {
      setSignedIn(false);
      router.push('/account');
      router.refresh();
    }
  }

  if (checking) return <span className="footer-auth-loading" role="status">Checking account…</span>;
  return <>
    <Link href="/account">{signedIn ? 'My account' : 'Sign in or create account'}</Link>
    {signedIn && <button type="button" className="footer-signout" onClick={() => setConfirming(true)} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>}
    {confirming && <div className="confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(false); }}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title"><h2 id="signout-title">Sign out?</h2><p>You can sign in again whenever you’re ready.</p><div className="confirm-actions"><button type="button" onClick={() => setConfirming(false)}>Stay signed in</button><button type="button" onClick={() => { setConfirming(false); void signOut(); }}>Sign out</button></div></div></div>}
  </>;
}
