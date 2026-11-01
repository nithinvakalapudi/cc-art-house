'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import PasswordField from '@/components/password-field';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;
type Step = 'email' | 'code' | 'password' | 'complete';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function sendCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!db) { setError(true); setMessage('Password recovery is temporarily unavailable.'); return; }
    setBusy(true); setMessage(''); setError(false);
    try {
      const { error: sendError } = await db.auth.resetPasswordForEmail(email.trim());
      if (sendError) { setError(true); setMessage(sendError.message); return; }
      setStep('code');
      setMessage('Check your email for a one-time reset code.');
    } catch { setError(true); setMessage('Unable to send a code right now. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    setBusy(true); setMessage(''); setError(false);
    try {
      const { error: verifyError } = await db.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
      if (verifyError) { setError(true); setMessage('That code is invalid or expired. Check the email and try again.'); return; }
      setStep('password'); setCode('');
    } catch { setError(true); setMessage('Unable to verify the code. Please try again.'); }
    finally { setBusy(false); }
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) return;
    if (password.length < 8) { setError(true); setMessage('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError(true); setMessage('The passwords do not match.'); return; }
    setBusy(true); setMessage(''); setError(false);
    try {
      const { error: updateError } = await db.auth.updateUser({ password });
      if (updateError) { setError(true); setMessage(updateError.message); return; }
      setStep('complete'); setMessage('Your password has been changed.');
    } catch { setError(true); setMessage('Unable to update your password. Please try again.'); }
    finally { setPassword(''); setConfirm(''); setBusy(false); }
  }

  return <>
    <div className="page-header account-header"><div className="eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password</h1><p>Use a one-time email code to protect your studio account.</p></div>
    <div className="content account-content"><div className="panel account-panel">
      {step === 'complete' && <><h2>Password updated</h2><p>You can now sign in to your studio account.</p><Link className="button primary" href="/account/admin">Go to admin sign in</Link></>}
      {step === 'email' && <><h2>Get a reset code</h2><p>We’ll send a one-time code to the email on your account. Check your inbox and spam folder.</p><form className="account-form" onSubmit={sendCode}><label className="field">Account email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="button primary account-submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button></form></>}
      {step === 'code' && <><h2>Enter your code</h2><p>Enter the code sent to <strong>{email}</strong>.</p><form className="account-form" onSubmit={verifyCode}><label className="field">Reset code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]+" maxLength={12} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Enter your code" /></label><button className="button primary account-submit" disabled={busy || code.length === 0}>{busy ? 'Verifying…' : 'Verify code'}</button></form><button type="button" className="account-text-action" onClick={() => void sendCode()} disabled={busy}>Send a new code</button><button type="button" className="account-text-action" onClick={() => { setStep('email'); setMessage(''); }}>Use a different email</button></>}
      {step === 'password' && <><h2>Choose a new password</h2><p>Your code is verified. Use at least 8 characters.</p><form className="account-form" onSubmit={updatePassword}><label className="field">New password<PasswordField autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field">Confirm password<PasswordField autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label><button className="button primary account-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></>}
      {message && <p role={error ? 'alert' : 'status'} className={`form-feedback ${error ? 'error' : 'success'}`}>{message}</p>}
      <p className="account-admin-link"><Link href="/account/admin">Back to admin sign in</Link></p>
    </div></div>
  </>;
}
