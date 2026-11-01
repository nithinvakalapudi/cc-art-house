'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import PasswordField from '@/components/password-field';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;

export default function AdminSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) { setMessage('Admin sign-in is temporarily unavailable.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setMessage(error.message); return; }
      const { data: role, error: roleError } = await db.from('user_roles').select('role').eq('user_id', data.user.id).in('role', ['admin', 'owner']).maybeSingle();
      if (roleError || !role) {
        await db.auth.signOut();
        setMessage('This email does not have studio admin access. Ask the owner to add it.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return <>
    <div className="page-header account-header"><div className="eyebrow">STUDIO ACCESS</div><h1>Admin sign in</h1><p>Manage paintings, requests and your studio team.</p></div>
    <div className="content account-content"><div className="panel account-panel">
      <p className="account-kicker">FOR INVITED ADMINS</p><h2>Welcome to your studio</h2>
      <p>Sign in with the email and password assigned to your admin account.</p>
      <form onSubmit={signIn} className="account-form">
        <label className="field">Admin email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="field">Password<PasswordField autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="button primary account-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to studio'}</button>
      </form>
      <p className="account-admin-link"><Link href="/account/reset-password">Forgot your password?</Link></p>
      <p role="status" className="account-message">{message}</p>
      <p className="account-admin-link"><Link href="/account">Customer sign in</Link></p>
    </div></div>
  </>;
}
