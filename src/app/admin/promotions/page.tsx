import AdminSubmitButton from '@/components/admin-submit-button';
import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { savePromotion, setHomepagePromotion, togglePromotion } from './actions';

export const dynamic = 'force-dynamic';
const localDateTime = (value?: string | null) => {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export default async function PromotionsPage() {
  const db = await requireAdminDb();
  const canWrite = await isAdmin();
  const { data: promotions, error } = await db.from('store_promotions').select('*').order('created_at', { ascending: false });
  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">OFFERS AND LOYALTY</span><h1>Promotions</h1><p>Choose one active offer to feature on the homepage. Customers can also use valid coupon codes at checkout.</p></div><span className="admin-readonly-tag">One homepage feature</span></header>
    {canWrite && <section className="panel admin-editor-panel"><h2>Create a promotion</h2><form action={savePromotion} className="form-grid admin-promotion-form">
      <label className="field">Coupon code<input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder="WELCOME10"/></label>
      <label className="field">Customer-facing title<input name="title" required minLength={2} maxLength={120} placeholder="A little welcome gift"/></label>
      <label className="field">Discount type<select name="discount_type" defaultValue="percentage"><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label>
      <label className="field">Discount value<input name="discount_value" type="number" min="0.01" max="100000" step="0.01" required placeholder="10"/></label>
      <label className="field">Starts at (India time)<input name="starts_at" type="datetime-local"/></label>
      <label className="field">Ends at (India time, optional)<input name="ends_at" type="datetime-local"/></label>
      <label className="field">Maximum redemptions<input name="max_redemptions" type="number" min="1" placeholder="Unlimited"/></label>
      <label><input name="enabled" type="checkbox" defaultChecked/> Active</label>
      <AdminSubmitButton>Create coupon</AdminSubmitButton>
    </form><p className="muted">Percentage coupons may be up to 95%. The system validates active dates and redemption limits again when an order is placed.</p></section>}
    {error && <p className="notice">Promotion tools are unavailable until the latest store database migration is applied.</p>}
    <section className="admin-promotion-list">{promotions?.map((promotion) => <article className="panel admin-promotion-card" key={promotion.id}>
      <header><div><span className="admin-coupon-code">{promotion.code}</span><h2>{promotion.title}</h2><p>{promotion.discount_type === 'percentage' ? `${Number(promotion.discount_value)}% off` : `₹${Number(promotion.discount_value).toLocaleString('en-IN')} off`} · Used {promotion.redemption_count}{promotion.max_redemptions ? ` of ${promotion.max_redemptions}` : ' times'}</p></div><div className="admin-promotion-badges"><span className={`admin-stock-pill ${promotion.enabled ? 'ready' : 'empty'}`}>{promotion.enabled ? 'Active' : 'Paused'}</span>{promotion.homepage_featured&&<span className="admin-promotion-featured-pill">On homepage</span>}</div></header>
      <p className="muted">Starts {new Date(promotion.starts_at).toLocaleString('en-IN')}{promotion.ends_at ? ` · Ends ${new Date(promotion.ends_at).toLocaleString('en-IN')}` : ' · No end date'}</p>
      {canWrite && <div className="admin-promotion-actions"><form action={setHomepagePromotion}><input type="hidden" name="id" value={promotion.id}/><input type="hidden" name="featured" value={String(!promotion.homepage_featured)}/><AdminSubmitButton>{promotion.homepage_featured?'Remove from homepage':'Feature on homepage'}</AdminSubmitButton></form><details><summary>Edit promotion</summary><form action={savePromotion} className="form-grid admin-promotion-form"><input type="hidden" name="id" value={promotion.id}/><label className="field">Code<input name="code" defaultValue={promotion.code} required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+"/></label><label className="field">Title<input name="title" defaultValue={promotion.title} required minLength={2} maxLength={120}/></label><label className="field">Discount type<select name="discount_type" defaultValue={promotion.discount_type}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label><label className="field">Value<input name="discount_value" type="number" min="0.01" max="100000" step="0.01" defaultValue={promotion.discount_value}/></label><label className="field">Starts at<input name="starts_at" type="datetime-local" defaultValue={localDateTime(promotion.starts_at)} required/></label><label className="field">Ends at<input name="ends_at" type="datetime-local" defaultValue={localDateTime(promotion.ends_at)}/></label><label className="field">Maximum redemptions<input name="max_redemptions" type="number" min="1" defaultValue={promotion.max_redemptions ?? ''}/></label><label><input name="enabled" type="checkbox" defaultChecked={promotion.enabled}/> Active</label><AdminSubmitButton>Save changes</AdminSubmitButton></form></details><form action={togglePromotion}><input type="hidden" name="id" value={promotion.id}/><input type="hidden" name="enabled" value={String(promotion.enabled)}/><AdminSubmitButton>{promotion.enabled ? 'Pause coupon' : 'Activate coupon'}</AdminSubmitButton></form></div>}
    </article>)}</section>
    {!error && !promotions?.length && <section className="panel admin-empty-state">No coupons yet. Create a promotion, then choose Feature on homepage on the one you want customers to see. Only one active, in-date offer appears on the homepage at a time.</section>}
  </div>;
}
