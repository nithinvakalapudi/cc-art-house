import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverDb } from '@/lib/supabase-server';
import OrderTimeline from '@/components/order-timeline';
import ReviewForm from '@/components/review-form';
import RazorpayPayButton from '@/components/razorpay-pay-button';
import OrderCancellationForm from '@/components/order-cancellation-form';

export const dynamic = 'force-dynamic';

export default async function MyOrders() {
  const db = await serverDb();
  if (!db) redirect('/account');
  const { data: user } = await db.auth.getUser();
  if (!user.user) redirect('/account');
  const { data: orders, error } = await db.from('orders').select('id,status,packaging_status,tracking_carrier,tracking_number,tracking_url,scheduled_delivery_date,hide_price_in_package,handwritten_note,whatsapp_opt_in,gift_wrap,gift_message,promotion_code,discount_amount,payment_status,payment_method,delivery_method,delivery_priced,total,delivery_fee,created_at,customer_name,address_line1,address_line2,city,state,postal_code,country,order_items(id,product_id,product_slug,product_title,quantity,unit_price)').eq('user_id', user.user.id).order('created_at', { ascending: false });
  return <><div className="page-header"><p className="craft-eyebrow">YOUR ACCOUNT</p><h1>Your orders</h1><p>Track your artwork and delivery with the studio.</p></div><div className="content customer-orders-content">
    {error && <div className="notice">Orders aren’t available yet. Please try again after the store checkout is enabled.</div>}
    {orders?.map(order => <article className="customer-order-card" key={order.id}>
      <header><div><span className="craft-eyebrow">ORDER #{order.id.slice(0, 8).toUpperCase()}</span><p>{new Date(order.created_at).toLocaleDateString('en-IN')}</p></div><span className="order-status-pill">{order.status.replaceAll('_', ' ')}</span></header>
      <OrderTimeline status={order.status} pickup={order.delivery_method === 'pickup'}/>
      <div className="packaging-progress"><strong>Studio preparation</strong><span>{String(order.packaging_status||'awaiting_artwork').replaceAll('_',' ')}</span><progress max="7" value={Math.max(1,['awaiting_artwork','quality_check','protective_wrap','framed','packed','dispatched','delivered'].indexOf(order.packaging_status)+1)}/></div>
      {order.tracking_url && <p className="order-tracking-link">{order.tracking_carrier && <strong>{order.tracking_carrier}{order.tracking_number ? ` · ${order.tracking_number}` : ''}: </strong>}<a href={order.tracking_url} target="_blank" rel="noreferrer">Track your artwork ↗</a></p>}
      <div className="customer-order-lines">{order.order_items?.map(item => <div className="customer-order-line" key={`${order.id}-${item.id}`}>
        <span><Link href={`/shop/${item.product_slug}`}>{item.product_title}</Link> <small>· Original painting</small></span><strong>₹{Number(item.unit_price).toLocaleString('en-IN')}</strong>
        {order.status === 'delivered' && item.product_id && <ReviewForm productId={item.product_id} itemId={item.id}/>}
      </div>)}</div>
      <div className="customer-order-address"><strong>{order.delivery_method === 'pickup' ? 'Collection' : 'Delivering to'}</strong><p>{order.customer_name}<br/>{order.delivery_method === 'pickup' ? 'Near Kundalahalli Gate, Bengaluru' : <>{order.address_line1}{order.address_line2 && `, ${order.address_line2}`}<br/>{order.city}, {order.state} {order.postal_code}, {order.country}</>}</p></div>
      <p className="muted">{order.delivery_priced ? `Delivery ₹${Number(order.delivery_fee).toLocaleString('en-IN')} confirmed` : 'Delivery charge will be confirmed by the studio'}{order.gift_wrap ? ' · Gift wrapping requested' : ''}</p>
      {order.gift_message && <p>Gift message: {order.gift_message}</p>}
      {(order.scheduled_delivery_date||order.handwritten_note||order.hide_price_in_package||order.whatsapp_opt_in)&&<p className="muted">{order.scheduled_delivery_date&&`Preferred date ${new Date(order.scheduled_delivery_date).toLocaleDateString('en-IN')} · `}{order.handwritten_note?'Handwritten card · ':''}{order.hide_price_in_package?'No price in package · ':''}{order.whatsapp_opt_in?'WhatsApp updates requested':''}</p>}
      <footer><span>Payment: {order.payment_status.replaceAll('_', ' ')} · {order.payment_method.replaceAll('_', ' ')}</span><strong>Total ₹{Number(order.total).toLocaleString('en-IN')}</strong></footer>
      {Number(order.discount_amount) > 0 && <p className="muted">{order.promotion_code ? `Promotion ${order.promotion_code} saved ` : 'Promotion saved ' }₹{Number(order.discount_amount).toLocaleString('en-IN')} on this order.</p>}
      {order.payment_method === 'razorpay' && order.payment_status !== 'paid' && order.status !== 'cancelled' && (order.delivery_priced && !order.gift_wrap
        ? <RazorpayPayButton orderId={order.id} canPay/>
        : <p className="muted">Online payment opens after the studio confirms delivery pricing and any gift service.</p>)}
      {order.status === 'pending_confirmation' && order.payment_status === 'unpaid' && <OrderCancellationForm orderId={order.id} />}
    </article>)}
    {!error && !orders?.length && <div className="empty-card">No orders yet. When you find a painting you love, add it to your cart and place an order here.<p><Link className="text-link" href="/shop">Browse paintings</Link></p></div>}
  </div></>;
}
