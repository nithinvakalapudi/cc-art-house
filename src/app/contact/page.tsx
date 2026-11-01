import Link from 'next/link';
import ContactForm from '@/components/contact-form';
import CopyButton from '@/components/copy-button';
import { getSiteSettings } from '@/lib/site-settings';

export const metadata = { title: 'Contact | The Art House', description: 'Contact The Art House about handmade paintings and custom artwork in Bengaluru.' };

export default async function ContactPage() {
  const settings=await getSiteSettings();
  const mapQuery=encodeURIComponent(settings.map_query);
  return <section className="contact-page">
    <div className="contact-page-inner">
      <div className="contact-top">
        <div className="contact-details">
          <span className="contact-overline">THE ART HOUSE · BENGALURU</span>
          <h1>{settings.contact_heading}</h1>
          <p className="contact-lead">{settings.contact_intro}</p>
          <div className="contact-detail-list">
            <div><span>VISIT & COLLECT</span><strong>{settings.contact_address}</strong><CopyButton value={settings.contact_address} label="Copy location"/><small>Collection is available by appointment. We’ll share the exact meeting point after confirming your visit.</small></div>
            <div><span>FOLLOW THE STUDIO</span><a href={settings.instagram_url} target="_blank" rel="noopener noreferrer">{settings.instagram_handle} ↗</a><CopyButton value={settings.instagram_handle} label="Copy Instagram"/><small>See recent artwork and send us a direct message.</small></div>
            {settings.contact_email&&<div><span>EMAIL</span><a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a><CopyButton value={settings.contact_email} label="Copy email"/></div>}
            {settings.contact_phone&&<div><span>CALL</span><a href={`tel:${settings.contact_phone}`}>{settings.contact_phone}</a></div>}
            {settings.whatsapp_number&&<div><span>WHATSAPP</span><a href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer">Message the studio ↗</a></div>}
          </div>
          <p className="contact-direct">Planning a custom piece? <Link href="/custom-art">Start an artwork request ↗</Link></p>
        </div>
        <div className="contact-form-wrap"><span className="contact-overline">SEND A NOTE</span><h2>Tell us your idea.</h2><ContactForm /></div>
      </div>
      <div className="contact-map"><div className="contact-map-heading"><div><span className="contact-overline">FIND US</span><h2>{settings.map_query}</h2></div><a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">Open directions ↗</a></div><iframe title={`Map of ${settings.map_query}`} src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
    </div>
  </section>;
}
