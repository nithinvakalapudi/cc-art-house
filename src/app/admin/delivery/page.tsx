import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { saveDeliveryRate } from './actions';

export const dynamic = 'force-dynamic';

export default async function DeliverySettings() {
  const db = await requireAdminDb();
  const canWrite=await isAdmin();
  const { data: rates } = await db!.from('delivery_rates').select('*').order('name');

  return <>
    <p className="craft-eyebrow">STORE SETTINGS</p>
    <h1>Delivery pricing</h1>
    <p className="muted">Only active areas receive a fixed delivery price at checkout. Orders with an artwork subtotal of ₹2,000 or more receive free delivery in supported areas. Collection near Kundalahalli Gate remains free.</p>
    {!canWrite&&<p className="notice">Read access: delivery areas are visible, but editing is disabled.</p>}
    <div className="delivery-rate-list">
      {rates?.map(rate => canWrite?<form action={saveDeliveryRate} className="panel delivery-rate-form" key={rate.id}>
        <h2>{rate.name}</h2>
        <label className="field">Area name<input name="name" defaultValue={rate.name} required maxLength={80}/></label>
        <label className="field">PIN code prefix<input name="postal_prefix" defaultValue={rate.postal_prefix} pattern="[0-9A-Za-z]{2,8}" required/><small>Example: 560 matches Bengaluru PIN codes beginning with 560.</small></label>
        <label className="field">Delivery charge in ₹<input name="fee" type="number" min="0" max="100000" step="1" defaultValue={rate.fee} required/></label>
        <label className="field">Estimated delivery days<input name="estimated_days" type="number" min="1" max="60" defaultValue={rate.estimated_days} required/></label>
        <label><input name="active" type="checkbox" defaultChecked={rate.active}/> Show this fixed rate at checkout</label>
        <button className="button primary">Save area</button>
        <span className={rate.active ? 'success' : 'muted'}>{rate.active ? 'Active' : 'Inactive — customers will confirm delivery with the studio'}</span>
      </form>:<section className="panel delivery-rate-form" key={rate.id}><h2>{rate.name}</h2><p><b>PIN prefix:</b> {rate.postal_prefix}</p><p><b>Charge:</b> ₹{Number(rate.fee).toLocaleString('en-IN')}</p><p><b>Estimated days:</b> {rate.estimated_days}</p><p>{rate.active?'Active':'Inactive'}</p></section>)}
    </div>
    {canWrite&&<form action={saveDeliveryRate} className="panel delivery-rate-form">
      <h2>Add a delivery area</h2>
      <label className="field">Area name<input name="name" placeholder="e.g. Bengaluru" required maxLength={80}/></label>
      <label className="field">PIN code prefix<input name="postal_prefix" placeholder="e.g. 560" required pattern="[0-9A-Za-z]{2,8}"/></label>
      <label className="field">Delivery charge in ₹<input name="fee" type="number" min="0" max="100000" step="1" defaultValue="0" required/></label>
      <label className="field">Estimated delivery days<input name="estimated_days" type="number" min="1" max="60" defaultValue="5" required/></label>
      <label><input name="active" type="checkbox"/> Activate at checkout</label>
      <button className="button primary">Add area</button>
    </form>}
  </>;
}
