import Link from 'next/link';
import { ArrowUpRight, BadgeIndianRupee, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react';
import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export default async function AnalyticsPage() {
  const db = await requireAdminDb();
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  const { data: orders, error } = await db.from('orders').select('id,status,payment_status,total,subtotal,discount_amount,created_at,promotion_code').gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(1000);
  const safeOrders = orders ?? [];
  const paid = safeOrders.filter((order) => order.payment_status === 'paid' && order.status !== 'cancelled');
  const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const open = safeOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length;
  const discounts = safeOrders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
  const monthBuckets = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); date.setMonth(date.getMonth() - (5 - offset));
    const monthOrders = paid.filter((order) => { const created = new Date(order.created_at); return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth(); });
    return { label: date.toLocaleDateString('en-IN', { month: 'short' }), amount: monthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), count: monthOrders.length };
  });
  const maxMonth = Math.max(1, ...monthBuckets.map((month) => month.amount));
  const paidIds = paid.map((order) => order.id);
  const { data: lines } = paidIds.length ? await db.from('order_items').select('product_title,quantity,line_total').in('order_id', paidIds).limit(3000) : { data: [] };
  const productTotals = new Map<string, { qty: number; revenue: number }>();
  for (const line of lines ?? []) { const current = productTotals.get(line.product_title) ?? { qty: 0, revenue: 0 }; current.qty += Number(line.quantity || 0); current.revenue += Number(line.line_total || 0); productTotals.set(line.product_title, current); }
  const bestsellers = [...productTotals.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">STORE PERFORMANCE · LAST SIX MONTHS</span><h1>Sales overview</h1><p>Track confirmed payments, outstanding fulfillment, and popular artwork.</p></div><span className="admin-readonly-tag">Paid orders only count as revenue</span></header>
    {error && <p className="notice">Sales data could not be loaded.</p>}
    <section className="admin-feature-stats"><article><BadgeIndianRupee/><span>Paid revenue</span><strong>{inr(revenue)}</strong></article><article><ShoppingBag/><span>Paid orders</span><strong>{paid.length}</strong></article><article><PackageCheck/><span>Orders to fulfill</span><strong>{open}</strong></article><article><TrendingUp/><span>Discounts applied</span><strong>{inr(discounts)}</strong></article></section>
    <div className="admin-analytics-grid"><section className="panel admin-data-panel"><h2>Revenue by month</h2><p className="muted">Payment-confirmed orders, based on order date.</p><div className="admin-chart" role="img" aria-label="Paid revenue for the last six months">{monthBuckets.map((month) => <div className="admin-chart-column" key={month.label}><strong>{inr(month.amount)}</strong><div className="admin-chart-track"><span style={{ height: `${Math.max(4, month.amount / maxMonth * 100)}%` }} /></div><small>{month.label}</small></div>)}</div></section>
      <section className="panel admin-data-panel"><h2>Popular paintings</h2>{bestsellers.length ? <ol className="admin-ranking-list">{bestsellers.map(([title, stats]) => <li key={title}><span><strong>{title}</strong><small>{stats.qty} sold · {inr(stats.revenue)}</small></span><TrendingUp size={16}/></li>)}</ol> : <p className="admin-empty-state">Best-selling paintings will appear when paid orders come in.</p>}</section></div>
    <section className="panel admin-data-panel"><div className="admin-card-heading"><h2>Recent orders</h2><Link href="/admin/orders">Manage orders <ArrowUpRight size={15}/></Link></div><div className="admin-table-scroll"><table className="table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th>Promotion</th><th>Total</th></tr></thead><tbody>{safeOrders.slice(0, 12).map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}>#{order.id.slice(0, 8).toUpperCase()}</Link></td><td>{new Date(order.created_at).toLocaleDateString('en-IN')}</td><td>{order.status.replaceAll('_', ' ')}</td><td>{order.payment_status}</td><td>{order.promotion_code || '—'}</td><td>{inr(Number(order.total))}</td></tr>)}</tbody></table></div>{!error && !safeOrders.length && <p className="admin-empty-state">No orders have been placed in this period.</p>}</section>
  </div>;
}
