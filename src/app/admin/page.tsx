import Link from 'next/link';
import { ArrowRight, BadgePercent, Boxes, ChartNoAxesCombined, ImagePlus, MessageSquareText, PackageCheck, ShoppingBag, Sparkles, UsersRound } from 'lucide-react';
import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const orderStatusLabel = (value: string) => value.replaceAll('_', ' ');
const inr = (value: number | string) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default async function Admin() {
  const db = await requireAdminDb();
  const [ordersCount, waitingCount, artworkCount, messageCount, recentOrders] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_confirmation'),
    db.from('products').select('id', { count: 'exact', head: true }).eq('available', true).eq('published', true),
    db.from('contact_messages').select('id', { count: 'exact', head: true }),
    db.from('orders').select('id,customer_name,status,total,created_at').order('created_at', { ascending: false }).limit(6),
  ]);

  const stats = [
    { label: 'Customer orders', value: ordersCount.count ?? '—', hint: 'All orders received', icon: ShoppingBag, tone: 'sand' },
    { label: 'Need your attention', value: waitingCount.count ?? '—', hint: 'Awaiting confirmation', icon: PackageCheck, tone: 'peach' },
    { label: 'Live paintings', value: artworkCount.count ?? '—', hint: 'Published and available', icon: Sparkles, tone: 'sage' },
    { label: 'Customer messages', value: messageCount.count ?? '—', hint: 'Messages in your inbox', icon: MessageSquareText, tone: 'blue' },
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-welcome">
        <div>
          <span className="admin-eyebrow">YOUR STUDIO AT A GLANCE</span>
          <h1>Good work starts here.</h1>
          <p>Keep your paintings, orders and customer requests moving smoothly.</p>
        </div>
        <Link className="admin-primary-action" href="/admin/products"><ImagePlus size={17} />Add a painting<ArrowRight size={16}/></Link>
      </section>

      {(ordersCount.error || artworkCount.error || messageCount.error || recentOrders.error) && (
        <div className="admin-data-notice" role="status">Some studio information is unavailable. Check your database connection and access permissions.</div>
      )}

      <section className="admin-stats-grid" aria-label="Store summary">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => (
          <article className="admin-stat-card" key={label}>
            <div className={`admin-stat-icon ${tone}`}><Icon size={19} strokeWidth={1.8}/></div>
            <span className="admin-stat-label">{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-card admin-recent-orders">
          <header className="admin-card-heading"><div><span className="admin-eyebrow">WHAT’S HAPPENING</span><h2>Recent orders</h2></div><Link href="/admin/orders">All orders<ArrowRight size={15}/></Link></header>
          {recentOrders.error ? <p className="admin-empty-state">Orders could not be loaded right now.</p> : recentOrders.data?.length ? (
            <div className="admin-recent-list">
              {recentOrders.data.map((order) => (
                <Link className="admin-recent-order" href={`/admin/orders/${order.id}`} key={order.id}>
                  <span className="admin-order-avatar">{order.customer_name?.trim().charAt(0).toUpperCase() || 'A'}</span>
                  <span className="admin-order-person"><strong>{order.customer_name || 'Customer'}</strong><small>#{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span>
                  <span className="admin-order-right"><strong>{inr(order.total)}</strong><small className={`admin-status-pill ${order.status}`}>{orderStatusLabel(order.status)}</small></span>
                </Link>
              ))}
            </div>
          ) : <p className="admin-empty-state">Your first customer order will appear here. In the meantime, make sure your paintings are ready to browse.</p>}
        </div>

        <aside className="admin-card admin-quick-actions">
          <span className="admin-eyebrow">QUICK SHORTCUTS</span>
          <h2>Make a change</h2>
          <Link href="/admin/products"><span className="admin-quick-icon"><ImagePlus size={17}/></span><span><strong>Manage paintings</strong><small>Photos, prices and discounts</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/content"><span className="admin-quick-icon"><Sparkles size={17}/></span><span><strong>Edit your storefront</strong><small>Homepage, story and contact details</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/custom-orders"><span className="admin-quick-icon"><MessageSquareText size={17}/></span><span><strong>Review custom requests</strong><small>Reply with a quote and timeline</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/inventory"><span className="admin-quick-icon"><Boxes size={17}/></span><span><strong>Check inventory</strong><small>Review low stock and sold artwork</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/promotions"><span className="admin-quick-icon"><BadgePercent size={17}/></span><span><strong>Create a coupon</strong><small>Set up a customer promotion</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/analytics"><span className="admin-quick-icon"><ChartNoAxesCombined size={17}/></span><span><strong>View sales</strong><small>Revenue and popular paintings</small></span><ArrowRight size={16}/></Link>
          <Link href="/admin/customers"><span className="admin-quick-icon"><UsersRound size={17}/></span><span><strong>Customer notes</strong><small>Keep follow-ups and preferences</small></span><ArrowRight size={16}/></Link>
          <div className="admin-dashboard-tip"><Sparkles size={16}/><p>Small updates keep your studio feeling fresh. Review prices and availability whenever a piece sells.</p></div>
        </aside>
      </section>

      <div className="admin-dashboard-footer"><span>Studio tools</span><Link href="/admin/delivery">Delivery rates</Link><Link href="/admin/pricing">Custom art pricing</Link><Link href="/admin/messages">Customer messages</Link></div>
    </div>
  );
}
