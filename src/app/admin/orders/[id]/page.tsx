import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminSubmitButton from '@/components/admin-submit-button';
import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { updateOrder } from '../order-actions';

export const dynamic = 'force-dynamic';
const statuses = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled'];
const payments = ['unpaid', 'pending', 'paid', 'refunded'];
const methods = ['to_be_arranged', 'cash_on_delivery', 'upi', 'bank_transfer', 'razorpay'];
const packaging = ['awaiting_artwork', 'quality_check', 'protective_wrap', 'framed', 'packed', 'dispatched', 'delivered'];
const label = (value: string) => value.replaceAll('_', ' ');
const money = (value: number | string) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await requireAdminDb();
  const canWrite = await isAdmin();
  const [{ data: order, error }, { data: items }] = await Promise.all([
    db.from('orders').select('*').eq('id', id).maybeSingle(),
    db.from('order_items').select('id,product_title,product_slug,image_url,unit_price,quantity,line_total').eq('order_id', id),
  ]);
  if (!order) notFound();

  return <>
    <p><Link href="/admin/orders">← All orders</Link></p>
    <p className="craft-eyebrow">CUSTOMER ORDER</p>
    <h1>Order #{id.slice(0, 8).toUpperCase()}</h1>
    {!canWrite && <p className="notice">Read access: order details are visible, updates are disabled.</p>}
    {error && <p className="error">Order could not be loaded.</p>}
    <p className="muted">Placed {new Date(order.created_at).toLocaleString('en-IN')}</p>
    {order.cancelled_by === 'customer' && <section className="notice customer-cancellation-notice"><strong>Customer cancellation received</strong><p>{order.cancellation_reason || 'No reason was provided.'}</p>{order.cancelled_at && <small>Cancelled {new Date(order.cancelled_at).toLocaleString('en-IN')}</small>}{order.payment_status === 'paid' && <p>Payment was paid when this order was cancelled. Review the payment and arrange a refund if appropriate.</p>}</section>}
    <div className="order-admin-grid">
      <section className="panel order-detail-panel">
        <h2>Customer and delivery</h2>
        <p><strong>{order.customer_name}</strong></p>
        <p>{order.customer_email ? <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a> : 'No email provided'}</p>
        <p><a href={`tel:${order.phone}`}>{order.phone}</a> · <a href={`https://wa.me/${String(order.phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></p>
        <p><strong>{order.delivery_method === 'pickup' ? 'Collection' : 'Home delivery'}</strong></p>
        {order.delivery_method === 'pickup' ? <p>Near Kundalahalli Gate, Bengaluru</p> : <address>{order.address_line1}{order.address_line2 && <><br />{order.address_line2}</>}<br />{order.city}, {order.state} {order.postal_code}<br />{order.country}</address>}
        {order.delivery_notes && <p><strong>Instructions:</strong> {order.delivery_notes}</p>}
        {order.scheduled_delivery_date && <p><strong>Preferred date:</strong> {new Date(order.scheduled_delivery_date).toLocaleDateString('en-IN')}</p>}
        <h3>Gift experience</h3>
        <p>{order.gift_wrap ? 'Gift wrapping requested' : 'No gift wrapping requested'}{order.handwritten_note ? ' · Handwritten card' : ''}{order.hide_price_in_package ? ' · Hide prices' : ''}</p>
        {order.gift_message && <p><strong>Gift message:</strong> {order.gift_message}</p>}
      </section>

      {canWrite ? <form action={updateOrder} className="panel order-update-form">
        <h2>Fulfillment and payment</h2>
        <input type="hidden" name="id" value={order.id} />
        <label className="field">Order status<select name="status" defaultValue={order.status}>{statuses.map((status) => <option key={status} value={status}>{status === 'ready_for_pickup' ? 'Ready for collection' : label(status)}</option>)}</select></label>
        <label className="field">Packaging progress<select name="packaging_status" defaultValue={order.packaging_status || 'awaiting_artwork'}>{packaging.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="field">Payment status<select name="payment_status" defaultValue={order.payment_status}>{payments.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label className="field">Payment method<select name="payment_method" defaultValue={order.payment_method}>{methods.map((method) => <option key={method} value={method}>{label(method)}</option>)}</select></label>
        <label className="field">Delivery charge (INR)<input type="number" name="delivery_fee" min="0" max="100000" step="0.01" defaultValue={order.delivery_fee} /></label>
        <label><input type="checkbox" name="delivery_priced" defaultChecked={order.delivery_priced} /> Confirm this delivery charge</label>
        <label className="field">Delivery carrier<input name="tracking_carrier" maxLength={120} defaultValue={order.tracking_carrier || ''} placeholder="India Post, Delhivery…" /></label>
        <label className="field">Tracking number<input name="tracking_number" maxLength={160} defaultValue={order.tracking_number || ''} /></label>
        <label className="field full">Tracking link<input type="url" name="tracking_url" maxLength={1000} defaultValue={order.tracking_url || ''} placeholder="https://…" /></label>
        <label className="field full">Internal fulfillment note<textarea name="fulfillment_note" maxLength={1000} rows={3} defaultValue={order.fulfillment_note || ''} placeholder="Internal note for the studio team" /></label>
        <p className="muted">Customers can see packaging progress and the tracking link in their order.</p>
        <AdminSubmitButton>Save order update</AdminSubmitButton>
      </form> : <section className="panel"><h2>Fulfillment and payment</h2><p>Status: {label(order.status)} · {label(order.payment_status)}</p><p>Packaging: {label(order.packaging_status || 'awaiting artwork')}</p>{order.tracking_url && <p><a href={order.tracking_url} target="_blank" rel="noreferrer">Track shipment ↗</a></p>}</section>}
    </div>

    <section className="panel order-lines">
      <h2>Items ordered</h2>
      {items?.map((item) => <div className="order-line" key={item.id}>{item.image_url && <Image width={96} height={96} src={item.image_url} alt="" />}<div><strong>{item.product_title}</strong><p className="muted">Original painting · Qty {item.quantity}</p></div><strong>{money(item.line_total)}</strong></div>)}
      <div className="cart-summary-row"><span>Artwork subtotal</span><strong>{money(order.subtotal)}</strong></div>
      {Number(order.discount_amount) > 0 && <div className="cart-summary-row"><span>Promotion {order.promotion_code && `(${order.promotion_code})`}</span><strong>−{money(order.discount_amount)}</strong></div>}
      <div className="cart-summary-row"><span>Delivery</span><strong>{order.delivery_priced ? money(order.delivery_fee) : 'To be confirmed'}</strong></div>
      <div className="cart-summary-row"><span>Order total</span><strong>{money(order.total)}</strong></div>
    </section>
  </>;
}
