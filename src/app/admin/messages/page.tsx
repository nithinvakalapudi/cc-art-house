import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AdminMessages() {
  const db = await requireAdminDb();
  const { data, error } = await db.from('contact_messages').select('id,name,email,phone,address,subject,message,created_at').order('created_at', { ascending: false }).limit(100);
  return <><h1>Contact messages</h1><p className="muted">Recent notes from the contact form.</p>
    {error ? <p className="error">Unable to load messages.</p> : data?.length ? <div className="contact-admin-list">{data.map(item => <article className="panel" key={item.id}><small>{new Date(item.created_at).toLocaleString('en-IN')}</small><h2>{item.subject}</h2><p><strong>{item.name}</strong> · <a href={`mailto:${item.email}`}>{item.email}</a>{item.phone && <> · {item.phone}</>}</p>{item.address && <p>{item.address}</p>}<p className="contact-admin-message">{item.message}</p></article>)}</div> : <div className="panel"><p>No contact messages yet.</p></div>}
  </>;
}
