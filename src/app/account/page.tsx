'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;
type Mode = 'email' | 'phone';

function authErrorMessage(error: { code?: string; message: string }, mode: Mode) {
  const message = error.message.toLowerCase();

  if (error.code === 'otp_disabled' || message.includes('signups not allowed for otp') || message.includes('otp is disabled')) {
    return 'This email may not have a customer account yet. Choose “Create an account” below, then request a new code. If you already have an account, use the email you signed up with.';
  }
  if (mode === 'phone' && (message.includes('sms') || message.includes('phone'))) {
    return 'Mobile codes are not configured yet. Use Email code, or contact the studio to enable SMS delivery.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many code requests. Please wait a few minutes, then try again.';
  }

  return error.message;
}

export default function Account() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [intent, setIntent] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [resendUntil, setResendUntil] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(!!db);

  useEffect(() => {
    if (!db) return;
    db.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (user) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('returnTo') === 'checkout' || params.get('next') === '/cart/checkout') {
          window.location.replace('/cart/checkout');
          return;
        }
        setSignedInAs(user.email || user.phone || 'Your account');
        const { data: role } = await db.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'owner']).maybeSingle();
        setAdmin(!!role);
      }
    }).catch(() => {
      setMessage('We couldn’t check your sign-in session. You can still try signing in again.');
    }).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!resendUntil) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) window.clearInterval(interval);
    }, 250);
    return () => window.clearInterval(interval);
  }, [resendUntil]);

  async function sendCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || (otpSent && Date.now() < resendUntil)) return;
    if (!db) { setMessage('Account sign-in is temporarily unavailable.'); return; }
    setBusy(true); setMessage('');
    const value = identifier.trim();
    if (intent === 'sign-up' && name.trim().length < 2) { setBusy(false); setMessage('Enter your full name.'); return; }
    const isResend = otpSent;
    if (!isResend) setOtp('');
    setOtpSent(true);
    const options = { shouldCreateUser: intent === 'sign-up', ...(intent === 'sign-up' ? { data: { full_name: name.trim() } } : {}) };
    try {
      const { error } = mode === 'email'
        ? await db.auth.signInWithOtp({ email: value, options })
        : await db.auth.signInWithOtp({ phone: value, options });
      if (error) {
        if (!isResend) setOtpSent(false);
        setMessage(authErrorMessage(error, mode));
      }
      else { setResendUntil(Date.now() + 60_000); setSeconds(60); setMessage(mode === 'email' ? 'Check your inbox and spam folder for your one-time code.' : 'Check your phone for your one-time code.'); }
    } catch {
      if (!isResend) setOtpSent(false);
      setMessage('We couldn’t reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = mode === 'email'
        ? await db.auth.verifyOtp({ email: identifier.trim(), token: otp.trim(), type: 'email' })
        : await db.auth.verifyOtp({ phone: identifier.trim(), token: otp.trim(), type: 'sms' });
      if (error) setMessage(authErrorMessage(error, mode));
      else {
        const params = new URLSearchParams(window.location.search);
        if (data.session && (params.get('returnTo') === 'checkout' || params.get('next') === '/cart/checkout')) {
          window.location.replace('/cart/checkout');
          return;
        }
        setSignedInAs(data.user?.email || data.user?.phone || identifier);
        if (data.user) {
          const { data: role } = await db.from('user_roles').select('role').eq('user_id', data.user.id).in('role', ['admin', 'owner']).maybeSingle();
          setAdmin(!!role);
        }
        setOtp(''); setMessage('You are signed in.'); router.refresh();
      }
    } catch {
      setMessage('We couldn’t verify your code right now. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!db) return;
    setBusy(true);
    const { error } = await db.auth.signOut();
    setBusy(false);
    if (error) setMessage(error.message);
    else { setSignedInAs(null); setAdmin(false); setOtpSent(false); setMessage('You are signed out.'); router.refresh(); }
  }

  function changeMode(next: Mode) { setMode(next); setOtpSent(false); setOtp(''); setIdentifier(''); setMessage(''); }
  function changeIntent(next: 'sign-in' | 'sign-up') { setIntent(next); setOtpSent(false); setOtp(''); setMessage(''); }

  return <>
    <div className="page-header account-header"><div className="eyebrow">YOUR ACCOUNT</div><h1>{signedInAs ? 'Welcome back' : 'Sign in to your account'}</h1><p>Access your orders and custom artwork requests.</p></div>
    <div className="content account-content">
      {checking ? <div className="panel account-panel account-checking" role="status"><span className="loading-spinner" aria-hidden="true"/>Checking your account…</div> : signedInAs ? <div className="panel account-panel">
        <p className="account-kicker">SIGNED IN AS</p><h2>{signedInAs.includes('@') ? <>{signedInAs.slice(0, signedInAs.indexOf('@'))}@<wbr />{signedInAs.slice(signedInAs.indexOf('@') + 1)}</> : signedInAs}</h2><p>View your purchases and follow your custom artwork.</p>
        <div className="account-actions"><Link className="button primary" href="/account/orders">My orders</Link><Link className="button outline" href="/account/custom-orders">Custom requests</Link><Link className="button outline" href="/account/collection">My art collection</Link><Link className="button outline" href="/account/preferences">Update preferences</Link>{admin && <Link className="button outline" href="/admin">Admin dashboard</Link>}</div>
        <button className="account-signout" type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
      </div> : <div className="panel account-panel">
        <div className="account-methods"><button type="button" className={mode === 'email' ? 'selected' : ''} disabled={busy} aria-pressed={mode === 'email'} onClick={() => changeMode('email')}>Email code</button><button type="button" className={mode === 'phone' ? 'selected' : ''} disabled={busy} aria-pressed={mode === 'phone'} onClick={() => changeMode('phone')}>Mobile code</button></div>
        <h2>{otpSent ? 'Enter your code' : intent === 'sign-up' ? 'Create your account' : 'Welcome back'}</h2>
        <p>{otpSent ? `Enter your code when it arrives at ${identifier}.` : intent === 'sign-up' ? 'Tell us your name and we’ll send a one-time code.' : `We’ll send a one-time code to your ${mode === 'email' ? 'email' : 'mobile number'}.`}</p>
        {otpSent ? <form onSubmit={verifyCode} className="account-form">
          <label className="field">One-time code<input inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={e => setOtp(e.target.value)} /></label>
          <button className="button primary account-submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
          <button type="button" className="button outline" disabled={busy || seconds > 0} onClick={() => void sendCode()}>
            {seconds > 0 ? 'Resend code in ' + seconds + 's' : 'Resend code'}
          </button>
          <button type="button" className="account-signout" disabled={busy} onClick={() => setOtpSent(false)}>Change {mode === 'email' ? 'email' : 'number'}</button>
        </form> : <form onSubmit={sendCode} className="account-form">
          {intent === 'sign-up' && <label className="field">Full name<input type="text" autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label>}
          <label className="field">{mode === 'email' ? 'Email address' : 'Mobile number with country code'}<input type={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'} required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder={mode === 'email' ? 'you@example.com' : '+919876543210'} /></label>
          <button className="button primary account-submit" disabled={busy}>{intent === 'sign-up' ? 'Create account and send code' : 'Send one-time code'}</button>
        </form>}
        {!otpSent && <p className="account-switch">{intent === 'sign-in' ? 'New to CC Art Works?' : 'Already have an account?'} <button type="button" onClick={() => changeIntent(intent === 'sign-in' ? 'sign-up' : 'sign-in')}>{intent === 'sign-in' ? 'Create an account' : 'Sign in'}</button></p>}
        <p className="account-admin-link"><Link href="/account/admin">Studio admin sign in</Link></p>
      </div>}
      <p role="status" className="account-message">{message}</p>
    </div>
  </>;
}
