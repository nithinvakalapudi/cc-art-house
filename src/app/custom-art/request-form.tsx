'use client';

import { useState } from 'react';
import Link from 'next/link';

const requestFields = [
  { name: 'size', label: 'Size and orientation', placeholder: 'Example: 18 × 24 inches, portrait orientation', help: 'Approximate is fine. The studio will confirm the final canvas size.' },
  { name: 'style', label: 'Art style you like', placeholder: 'Example: realistic, traditional, minimal, textured…', help: 'You can also mention an artwork from our gallery.' },
  { name: 'medium', label: 'Preferred medium', placeholder: 'Example: acrylic on canvas, watercolour, or open to advice', help: 'Write “open to advice” if you would like the artist to recommend one.' },
  { name: 'frame', label: 'Frame preference', placeholder: 'Example: simple wooden frame, unframed, or unsure', help: 'Framing and its final cost will be confirmed with your quote.' },
  { name: 'complexity', label: 'Details that matter', placeholder: 'Example: 3 people, detailed background, gold accents…', help: 'Mention faces, objects, lettering, background details, or anything essential.' },
  { name: 'priority', label: 'When do you need it?', placeholder: 'Example: before 15 December, flexible, birthday gift…', help: 'A preferred date helps the studio confirm availability.' },
] as const;

export default function CustomArtForm() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [referenceCount, setReferenceCount] = useState(0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = event.currentTarget;
    const response = await fetch('/api/custom-orders', { method: 'POST', body: new FormData(form) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok) {
      form.reset();
      setReferenceCount(0);
      setMessage(`Request submitted. Your request number is ${String(data.id).slice(0, 8).toUpperCase()}.`);
      return;
    }
    setMessage(data.error || 'We could not submit your request. Please try again.');
  }

  const submitted = message.startsWith('Request submitted');

  return <form className="custom-brief-form" onSubmit={submit}>
    <section className="custom-form-card">
      <div className="custom-form-card-heading"><span>01</span><div><h3>Your details</h3><p>So the studio can discuss your idea and quotation with you.</p></div></div>
      <div className="form-grid">
        <label className="field">Your name<input required name="customer_name" autoComplete="name" minLength={2} maxLength={120} placeholder="Enter your full name"/></label>
        <label className="field">Email address<input required type="email" name="email" autoComplete="email" placeholder="you@example.com"/></label>
        <label className="field">Mobile number<input required type="tel" name="phone" autoComplete="tel" minLength={7} maxLength={25} placeholder="+91 98765 43210"/></label>
        <label className="field">What would you like painted?<input required name="painting_type" minLength={2} maxLength={120} placeholder="Portrait, landscape, pet, memory…"/></label>
      </div>
    </section>

    <section className="custom-form-card">
      <div className="custom-form-card-heading"><span>02</span><div><h3>Describe your artwork</h3><p>Share the story, mood, people, place, and feeling you want the painting to hold.</p></div></div>
      <label className="field"><span>Your idea</span><textarea required name="description" minLength={10} maxLength={5000} rows={6} placeholder="Tell us what you imagine, who or what should appear, and what makes this artwork meaningful…"/></label>
      <div className="custom-text-grid">
        {requestFields.map(field => <label className="field custom-guided-field" key={field.name}>{field.label}<input required name={field.name} minLength={2} maxLength={field.name === 'complexity' ? 500 : 200} placeholder={field.placeholder}/><small>{field.help}</small></label>)}
      </div>
      <div className="form-grid custom-detail-grid">
        <label className="field">Exact measurements, if any<input name="dimensions" maxLength={120} placeholder="Wall space, canvas dimensions, or leave blank"/></label>
        <label className="field">Preferred colours<input name="colors" maxLength={200} placeholder="Warm earth tones, blues, match my room…"/></label>
        <label className="field">Budget range (optional)<input type="number" min="0" name="budget" inputMode="numeric" placeholder="₹"/></label>
        <label className="field">Preferred delivery date (optional)<input type="date" name="delivery_date"/></label>
      </div>
    </section>

    <section className="custom-form-card">
      <div className="custom-form-card-heading"><span>03</span><div><h3>Add visual references</h3><p>Upload photos, room colours, poses, or artwork references. Clear images help the artist quote accurately.</p></div></div>
      <label className="custom-upload-box">
        <input type="file" name="references" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setReferenceCount(Math.min(event.target.files?.length || 0, 3))}/>
        <strong>{referenceCount ? `${referenceCount} reference ${referenceCount === 1 ? 'image' : 'images'} selected` : 'Choose reference images'}</strong>
        <span>Up to 3 JPG, PNG, or WebP files · 5 MB each</span>
      </label>
      <label className="field custom-instructions">Anything else the artist should know?<textarea name="instructions" maxLength={5000} rows={4} placeholder="Framing notes, delivery details, elements to avoid, or any questions…"/></label>
    </section>

    <aside className="custom-quote-note"><div><span className="craft-eyebrow">PERSONAL QUOTATION</span><h3>Your request is reviewed by the artist</h3><p>Custom artwork is priced after the studio reviews the size, detail, medium, references, and timeline. You will receive the final quote before work begins.</p></div><ol><li>Submit your brief</li><li>Discuss and approve the quote</li><li>Track progress in your account</li></ol></aside>

    {message && <div role="status" className={submitted ? 'custom-form-success' : 'custom-form-error'}>{message}{submitted && <Link href="/account/custom-orders">View your custom requests →</Link>}</div>}
    <button className="button primary custom-submit" type="submit" disabled={busy}>{busy ? <><span className="loading-spinner" aria-hidden="true"/> Sending your request…</> : 'Send my custom art request'}</button>
    <p className="custom-submit-note">No payment is taken now. The studio confirms the quote, timeline, and payment plan with you first.</p>
  </form>;
}
