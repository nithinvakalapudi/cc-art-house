import AdminSubmitButton from '@/components/admin-submit-button';
import { ClipboardList, ContactRound, IndianRupee, UsersRound } from 'lucide-react';
import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { saveCustomerNote } from './actions';
import AdminCustomerSearch from '@/components/admin-customer-search';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const db = await requireAdminDb();
  const canWrite = await isAdmin();
  const [{ data: orders, error }, { data: notes, error: notesError }] = await Promise.all([
    db.from('orders').select('customer_email,customer_name,phone,total,status,payment_status,created_at').not('customer_email', 'is', null).order('created_at', { ascending: false }).limit(1000),
    db.from('admin_customer_notes').select('*').order('follow_up_on', { ascending: true, nullsFirst: false }),
  ]);
  const customers = new Map<string, { email: string; name: string; phone: string; count: number; spent: number; lastOrder: string; statuses: string[] }>();
  for (const order of orders ?? []) {
    const email = String(order.customer_email || '').toLowerCase();
    if (!email) continue;
    const current = customers.get(email) ?? { email, name: order.customer_name || 'Customer', phone: order.phone || '', count: 0, spent: 0, lastOrder: order.created_at, statuses: [] as string[] };
    current.count += 1; if (order.payment_status === 'paid' && order.status !== 'cancelled') current.spent += Number(order.total || 0); current.statuses.push(order.status);
    customers.set(email, current);
  }
  const notesByEmail = new Map((notes ?? []).map((note) => [note.customer_email.toLowerCase(), note]));
  const allEmails = new Set([...customers.keys(), ...notesByEmail.keys()]);
  const items = [...allEmails].map((email) => ({ customer: customers.get(email) ?? { email, name: notesByEmail.get(email)?.customer_name || 'Customer', phone: '', count: 0, spent: 0, lastOrder: '', statuses: [] }, note: notesByEmail.get(email) })).sort((a, b) => {
    const aFollow = a.note?.follow_up_on || '';
    const bFollow = b.note?.follow_up_on || '';
    if (aFollow && bFollow) return aFollow.localeCompare(bFollow);
    if (aFollow) return -1;
    if (bFollow) return 1;
    return (b.customer.lastOrder || '').localeCompare(a.customer.lastOrder || '');
  });

  const paidOrders = [...customers.values()].reduce((sum, customer) => sum + customer.spent, 0);
  const repeatCustomers = [...customers.values()].filter((customer) => customer.count > 1).length;

  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">PEOPLE & RELATIONSHIPS</span><h1>Users & customers</h1><p>Find shoppers, review their order history, and keep private studio notes in one place.</p></div><span className="admin-readonly-tag">Customer accounts · order records</span></header>
    {(error || notesError) && <p className="notice">Customer data could not be fully loaded. Check the latest migration and access permissions.</p>}
    <section className="admin-feature-stats admin-user-stats"><article><ContactRound/><span>Customers</span><strong>{customers.size.toLocaleString('en-IN')}</strong></article><article><ClipboardList/><span>Orders placed</span><strong>{[...customers.values()].reduce((sum, customer) => sum + customer.count, 0).toLocaleString('en-IN')}</strong></article><article><UsersRound/><span>Returning customers</span><strong>{repeatCustomers.toLocaleString('en-IN')}</strong></article><article><IndianRupee/><span>Paid order value</span><strong>₹{Math.round(paidOrders).toLocaleString('en-IN')}</strong></article></section>
    <AdminCustomerSearch total={items.length}>{items.map(({ customer, note }) => <article className="panel admin-customer-card" key={customer.email} data-search={`${customer.name} ${customer.email} ${customer.phone}`.toLocaleLowerCase()}>
      <header><div><span className="admin-order-avatar">{customer.name.trim().charAt(0).toUpperCase() || 'C'}</span><div><h2>{customer.name}</h2><a href={`mailto:${customer.email}`}>{customer.email}</a>{customer.phone && <p><a href={`tel:${customer.phone}`}>{customer.phone}</a></p>}</div></div><span className="admin-customer-count">{customer.count} {customer.count === 1 ? 'order' : 'orders'}<strong>₹{Math.round(customer.spent).toLocaleString('en-IN')} paid</strong></span></header>
      {note?.tags?.length ? <div className="admin-tag-list">{note.tags.map((tag: string) => <span key={tag}>{tag}</span>)}</div> : null}
      {note?.follow_up_on && <p className={`admin-follow-up${note.follow_up_on < new Date().toISOString().slice(0, 10) ? ' overdue' : ''}`}>Follow up {note.follow_up_on < new Date().toISOString().slice(0, 10) ? 'was due' : 'scheduled'} {new Date(`${note.follow_up_on}T00:00:00`).toLocaleDateString('en-IN')}</p>}
      {canWrite ? <form action={saveCustomerNote} className="admin-customer-note-form"><input type="hidden" name="customer_email" value={customer.email}/><input type="hidden" name="customer_name" value={customer.name}/><label className="field">Studio note<textarea name="note" rows={3} maxLength={4000} defaultValue={note?.note || ''} placeholder="Preferences, previous conversations, or a personal detail to remember…"/></label><div className="admin-customer-note-meta"><label className="field">Tags<input name="tags" defaultValue={(note?.tags || []).join(', ')} placeholder="Repeat collector, gift, follow up"/></label><label className="field">Follow up on<input name="follow_up_on" type="date" defaultValue={note?.follow_up_on || ''}/></label><AdminSubmitButton>Save note</AdminSubmitButton></div></form> : note?.note ? <p className="admin-customer-private-note">{note.note}</p> : <p className="muted">No private studio note.</p>}
    </article>)}</AdminCustomerSearch>
    {!items.length && !error && <section className="panel admin-empty-state">Customer profiles appear here after an order is placed.</section>}
  </div>;
}
