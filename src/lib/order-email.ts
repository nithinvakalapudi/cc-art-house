import nodemailer from 'nodemailer';
import { isAdmin,serverDb } from '@/lib/supabase-server';
export async function sendOrderEmail(orderId:string,event:string){
 const host=process.env.SMTP_HOST,user=process.env.SMTP_USER,password=process.env.SMTP_PASSWORD,admin=process.env.ART_HOUSE_ADMIN_EMAIL;
 const port=Number(process.env.SMTP_PORT||587),from=process.env.SMTP_FROM||process.env.SMTP_USER;
 if(!host||!user||!password||!from)return false;
 const db=await serverDb();if(!db)return false;const {data:{user:viewer}}=await db.auth.getUser();if(!viewer)return false;
  const isStatus=event.startsWith('status:');if(isStatus&&!await isAdmin())return false;
 const {data:claim,error:claimError}=await db.rpc('claim_order_notification',{p_order_id:orderId,p_event:event});if(claimError||!claim)return false;
 try{
  const {data:order,error}=await db.from('orders').select('id,user_id,customer_name,customer_email,phone,address_line1,address_line2,city,state,postal_code,country,delivery_method,delivery_fee,delivery_priced,total,status,gift_wrap,gift_message,order_items(product_title,quantity,unit_price)').eq('id',orderId).single();
  if(error||!order)throw new Error('Order unavailable');
  if(event==='placed'&&order.user_id!==viewer.id)throw new Error('Order unavailable');
  const orderCode=order.id.slice(0,8).toUpperCase(),address=order.delivery_method==='pickup'?'Collection near Kundalahalli Gate, Bengaluru':`${order.address_line1}${order.address_line2?`, ${order.address_line2}`:''}, ${order.city}, ${order.state} ${order.postal_code}, ${order.country}`;
  const items=order.order_items.map(item=>`${item.product_title} × ${item.quantity} — ₹${Number(item.unit_price).toLocaleString('en-IN')}`).join('\n');
  const transporter=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass:password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  const subject=event==='placed'?`We received your art order #${orderCode}`:event==='payment:paid'?`Payment confirmed for order #${orderCode}`:`An update on art order #${orderCode}`;
  const customerText=event==='placed'?`Hello ${order.customer_name},\n\nWe received your order.\n\n${items}\n\nStatus: ${order.status.replaceAll('_',' ')}\nDelivery: ${address}\n${order.delivery_priced?`Delivery charge: ₹${Number(order.delivery_fee).toLocaleString('en-IN')}`:'Delivery charge: to be confirmed by the studio'}\nOrder total: ₹${Number(order.total).toLocaleString('en-IN')}\n\nThe studio will contact you before dispatch.`:event==='payment:paid'?`Hello ${order.customer_name},\n\nYour payment for order #${orderCode} has been confirmed.\nOrder total: ₹${Number(order.total).toLocaleString('en-IN')}\n\nThe studio will prepare your artwork and keep you updated.`:`Hello ${order.customer_name},\n\nYour order #${orderCode} is now: ${order.status.replaceAll('_',' ')}.\n\nView your order in Your account on The Art House.`;
  let sent=false;
  if(order.customer_email){await transporter.sendMail({from,to:order.customer_email,subject,text:customerText});sent=true;}
  if(admin){await transporter.sendMail({from,to:admin,subject:`${event==='placed'?'New order':'Order update'} #${orderCode}`,text:`${customerText}\n\nCustomer: ${order.customer_name}\nEmail: ${order.customer_email||'No verified email'}\nPhone: ${order.phone}\nDelivery address: ${address}\nGift wrap: ${order.gift_wrap?'requested':'no'}\nGift note: ${order.gift_message||'none'}`});sent=true;}
  if(!sent)throw new Error('No recipient configured');
  await db.rpc('finish_order_notification',{p_order_id:orderId,p_event:event,p_sent:true});return true;
 }catch{await db.rpc('finish_order_notification',{p_order_id:orderId,p_event:event,p_sent:false});return false;}
}
