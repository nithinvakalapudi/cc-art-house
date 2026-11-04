import Link from 'next/link';
import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function Orders() {
  const db = await requireAdminDb();
  const { data, error } = await db!.from('orders').select('id,customer_name,customer_email,phone,status,payment_status,total,created_at,cancelled_by').order('created_at', { ascending: false }).limit(100);
  return <><h1>Customer orders</h1><p className="muted">Delivery information and order status for your latest orders.</p>{error && <div className="notice">Orders aren’t available yet. Apply the store orders database migration to enable checkout.</div>}<div className="panel order-list-panel"><table className="table"><thead><tr><th>Order</th><th>Customer</th><th>Delivery contact</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th></tr></thead><tbody>{data?.map(o=><tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}><strong>#{o.id.slice(0,8).toUpperCase()}</strong></Link></td><td>{o.customer_name}</td><td>{o.customer_email && <>{o.customer_email}<br/></>}<a href={`tel:${o.phone}`}>{o.phone}</a></td><td>{o.status.replaceAll('_',' ')}{o.cancelled_by === 'customer' && <small className="customer-cancelled-label">Cancelled by customer</small>}</td><td>{o.payment_status}</td><td>₹{Number(o.total).toLocaleString('en-IN')}</td><td>{new Date(o.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table>{!error && !data?.length && <p>No customer orders yet. New orders will appear here.</p>}</div></>;
}
