import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function ActivityPage() {
  const db = await requireAdminDb();
  const { data: entries, error } = await db.from('admin_activity_log').select('id,actor_email,action,entity_type,entity_id,summary,created_at').order('created_at', { ascending: false }).limit(150);
  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">STUDIO AUDIT TRAIL</span><h1>Admin activity</h1><p>Recent changes to paintings, orders, offers, and site settings.</p></div><span className="admin-readonly-tag">Latest 150 changes</span></header>
    {error && <p className="notice">Activity history could not be loaded. The admin database migration may still be running.</p>}
    <section className="admin-activity-list">{entries?.map((entry) => <article className="admin-activity-entry" key={entry.id}><span className={`admin-activity-dot ${entry.action}`}/><div><p><strong>{titleCase(entry.action)} {titleCase(entry.entity_type.replaceAll('_', ' '))}</strong><span>{entry.actor_email || 'System'}</span></p><small>{new Date(entry.created_at).toLocaleString('en-IN')} · {entry.entity_id.slice(0, 14)}</small>{Object.keys(entry.summary || {}).length > 0 && <div className="admin-activity-summary">{Object.entries(entry.summary as Record<string, unknown>).filter(([, value]) => value !== null && value !== '').map(([key, value]) => <span key={key}><b>{titleCase(key)}:</b> {String(value)}</span>)}</div>}</div></article>)}</section>
    {!entries?.length && !error && <section className="panel admin-empty-state">Admin changes will be recorded here as your store is managed.</section>}
  </div>;
}
