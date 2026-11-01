'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setSent(false);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (localStorage.getItem('art-house-cookie-choice') === 'accepted') {
      const campaign = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].map(key => [key, sessionStorage.getItem(key) || '']).filter(([, value]) => value));
      if (Object.keys(campaign).length) data.campaign = JSON.stringify(campaign);
    }
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || 'Unable to send your message. Please try again.'); return; }
      form.reset(); setSent(true); setMessage('Thank you. Your message has reached the studio.');
    } catch { setMessage('Unable to send your message. Please try again.'); }
    finally { setBusy(false); }
  }

  return <form className="contact-form" onSubmit={submit}>
    <div className="contact-form-grid">
      <label>Name <span>*</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name" /></label>
      <label>Email <span>*</span><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="Your phone number" /></label>
      <label>Address<input name="address" autoComplete="street-address" maxLength={250} placeholder="City or address (optional)" /></label>
      <label className="contact-field-wide">Subject <span>*</span><input name="subject" required minLength={3} maxLength={160} placeholder="What is your message about?" /></label>
      <label className="contact-field-wide">Message <span>*</span><textarea name="message" required minLength={10} maxLength={3000} rows={5} placeholder="Tell us a little about what you have in mind…" /></label>
      <label className="contact-honey" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    </div>
    <button type="submit" disabled={busy}>{busy ? 'Sending your note…' : 'Send your message'} <span aria-hidden="true">↗</span></button>
    {message && <p role={sent ? 'status' : 'alert'} className={`form-feedback ${sent ? 'success' : 'error'}`}>{message}</p>}
  </form>;
}
