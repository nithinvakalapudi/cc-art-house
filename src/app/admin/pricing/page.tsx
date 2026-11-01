import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { saveRule, updateRule } from './pricing-action';
import AdminSubmitButton from '@/components/admin-submit-button';

const kinds = [
  { key: 'size', title: 'Painting size', help: 'Small, medium, large, or your own size labels.' },
  { key: 'style', title: 'Preferred art style', help: 'The styles customers can choose.' },
  { key: 'medium', title: 'Painting medium', help: 'For example, acrylic or watercolour.' },
  { key: 'frame', title: 'Frame preference', help: 'Include an unframed option if offered.' },
  { key: 'complexity', title: 'Complexity level', help: 'Set the price for detail and effort.' },
  { key: 'priority', title: 'Production priority', help: 'Include standard timing and any rush option you offer.' },
] as const;

export default async function Pricing() {
  const db = await requireAdminDb();
  const canWrite=await isAdmin();
  const { data: rules, error } = await db.from('custom_pricing_rules').select('id,kind,option_key,label,amount,active,sort_order').order('kind').order('sort_order');
  return <>
    <h1>Custom art options & prices</h1>
    <p className="muted">These are studio reference options for preparing a personal quote. Customer briefs stay open text, and these prices do not automatically calculate or charge a customer. Review each request and send the final quote from its request page.</p>
    {!canWrite&&<p className="notice">Read access: pricing options are visible, but editing is disabled.</p>}
    {error && <p className="error">Unable to load pricing options. Check the database permissions.</p>}
    <div className="pricing-admin-grid">{kinds.map(kind => {
      const items = (rules || []).filter(rule => rule.kind === kind.key);
      return <section className="panel pricing-admin-group" key={kind.key}>
        <div className="pricing-admin-heading"><div><h2>{kind.title}</h2><p>{kind.help}</p></div><span>{items.filter(item => item.active).length} active</span></div>
        {items.length ? <div className="pricing-admin-list">{items.map(item => canWrite?<form action={updateRule} className="pricing-admin-row" key={item.id}>
          <input type="hidden" name="id" value={item.id} />
          <span className="pricing-admin-key">{item.option_key}</span>
          <label className="field">Customer label<input name="label" defaultValue={item.label} required maxLength={120} /></label>
          <label className="field">Price (₹)<input type="number" name="amount" defaultValue={Number(item.amount)} min="0" step="0.01" required /></label>
          <label className="field pricing-order">Order<input type="number" name="sort_order" defaultValue={item.sort_order || 0} min="0" max="9999" required /></label>
          <label className="pricing-active"><input type="checkbox" name="active" defaultChecked={item.active} /> Show to customers</label>
          <AdminSubmitButton className="button outline">Save changes</AdminSubmitButton>
        </form>:<div className="pricing-admin-row" key={item.id}><span>{item.label}</span><span>{Number(item.amount)===0?'Included':`₹${Number(item.amount).toLocaleString('en-IN')}`}</span><span>{item.active?'Active':'Hidden'}</span></div>)}</div> : <p className="pricing-empty">No options yet. Add one below so customers can complete this step.</p>}
        {canWrite&&<form action={saveRule} className="pricing-add-form">
          <input type="hidden" name="kind" value={kind.key} />
          <label className="field">New option label<input name="label" placeholder={kind.key === 'size' ? 'Medium • 40 × 50 cm' : 'Option name'} maxLength={120} required /></label>
          <label className="field">Unique key<input name="option_key" placeholder="medium" pattern="[a-z0-9_-]+" required /></label>
          <label className="field">Price (₹)<input type="number" name="amount" min="0" step="0.01" defaultValue="0" required /></label>
          <label className="field pricing-order">Order<input type="number" name="sort_order" min="0" max="9999" defaultValue={items.length + 1} required /></label>
          <AdminSubmitButton>Add option</AdminSubmitButton>
        </form>}
      </section>;
    })}</div>
  </>;
}
