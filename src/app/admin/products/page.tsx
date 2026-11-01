import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { saveProduct } from './product-action';
import Link from 'next/link';
import AdminSubmitButton from '@/components/admin-submit-button';

export default async function Products() {
  const db = await requireAdminDb();
  const canWrite=await isAdmin();
  const [{ data: items, error }, { data: categories }] = await Promise.all([
    db.from('products').select('id,title,slug,price,original_price,available,published,archived').order('created_at', { ascending: false }),
    db.from('categories').select('id,name').order('name'),
  ]);
  return <>
    <h1>Paintings</h1>
    {error && <p className="error">Unable to load paintings.</p>}
    {canWrite&&<div className="panel"><h2>Add a painting</h2><p className="muted">Start with one clear artwork photo. Enter 0 when the price is not confirmed; the shop will say “Price on request.” You can edit every listing after saving it.</p>
      <form action={saveProduct} className="form-grid">
        <label className="field">Title<input name="title" required /></label>
        <label className="field">Slug<input name="slug" required pattern="[a-z0-9-]+" /></label>
        <label className="field">Price (INR; 0 = on request)<input name="price" type="number" min="0" step="0.01" required /></label>
        <label className="field">Discount percentage<input name="discount_percent" type="number" min="0" max="95" step="1" defaultValue="0" /><small>Enter 0 for no discount. Checkout uses the reduced price.</small></label>
        <label className="field">Category<select name="category_id"><option value="">No category</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Medium and materials<input name="medium" placeholder="Acrylic on canvas" /></label>
        <label className="field">Dimensions<input name="dimensions" placeholder="40 × 50 cm, unframed" /></label>
        <label className="field full">Artwork story and maker’s note<textarea name="description" rows={5} placeholder="What inspired this piece? Describe its colours, texture, and the feeling it brings to a space." /></label>
        <label className="field full">Main artwork image URL or gallery path<input name="image_url" placeholder="https://… or /artist-gallery/image.jpg" /></label>
        {(['Detail view', 'Framed view', 'In a room for scale'] as const).map((label, index) => <div className="admin-gallery-pair" key={label}>
          <label className="field">{label} image URL<input name={`gallery_url_${index + 1}`} placeholder="https://… or /artist-gallery/image.jpg" /></label>
          <label className="field">Image description<input name={`gallery_alt_${index + 1}`} maxLength={180} placeholder={`Describe the ${label.toLowerCase()}`} /></label>
        </div>)}
        <label className="field">Availability<select name="available"><option value="true">Available</option><option value="false">Sold</option></select></label>
        <label><input type="checkbox" name="published" /> Publish</label>
        <label><input type="checkbox" name="featured" /> Featured</label>
        <AdminSubmitButton>Save painting</AdminSubmitButton>
      </form>
    </div>}
    <div className="panel"><h2>Catalogue</h2><table className="table"><thead><tr><th>Painting</th><th>Price</th><th>Availability</th><th>Visibility</th><th>Manage</th></tr></thead><tbody>{items?.map(p => <tr key={p.id}><td>{p.title}</td><td>{Number(p.price) === 0 ? 'On request' : <>{p.original_price&&<><s>₹{Number(p.original_price).toLocaleString('en-IN')}</s><br/></>}₹{Number(p.price).toLocaleString('en-IN')}</>}</td><td>{Number(p.price) === 0 ? 'Confirm with studio' : p.available ? 'Available' : 'Sold'}</td><td>{p.archived ? 'Archived' : p.published ? 'Published' : 'Draft'}</td><td><Link href={`/admin/products/${p.id}`}>{canWrite?'Edit painting':'View painting'}</Link></td></tr>)}</tbody></table></div>
  </>;
}
