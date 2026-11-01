'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;

export default function AdminLogoutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    if (!db) {
      setError('Sign out is unavailable right now. Please refresh and try again.');
      return;
    }

    setSigningOut(true);
    setError('');
    const { error: signOutError } = await db.auth.signOut();
    setSigningOut(false);

    if (signOutError) {
      setError('We could not sign you out. Please try again.');
      return;
    }

    setConfirming(false);
    router.replace('/account/admin');
    router.refresh();
  }

  return (
    <>
      <button className="admin-logout-button" type="button" onClick={() => { setError(''); setConfirming(true); }}>
        <LogOut size={15} aria-hidden="true" />
        <span>Log out</span>
      </button>
      {confirming && (
        <div className="confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(false); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-logout-title">
            <h2 id="admin-logout-title">Leave the admin portal?</h2>
            <p>You’ll be signed out of this studio session and returned to admin sign-in.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" onClick={() => setConfirming(false)} disabled={signingOut}>Stay signed in</button>
              <button type="button" onClick={() => void signOut()} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
