import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { updateProduct } from '../product-action';
import AdminSubmitButton from '@/components/admin-submit-button';

export default async function EditPainting({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const db = await requireAdminDb();
  const canWrite=await isAdmin();
  const [{ data: painting }, { data: categories }, { data: images }] = await Promise.all([
    db.from('products').select('*').eq('id', id).single(),
    db.from('categories').select('id,name').order('name'),
    db.from('product_images').select('id,url,alt_text,sort_order').eq('product_id', id).order('sort_order'),
  ]);
  if (!painting) notFound();
  if(!canWrite)return <><p><Link href="/admin/products">← All paintings</Link></p><h1>{painting.title}</h1><p className="muted">Read access · editing is disabled for this account.</p><div className="panel">{painting.image_url&&<img src={painting.image_url} alt={painting.title} className="admin-product-preview"/>}<p><b>Price:</b> ₹{Number(painting.price).toLocaleString('en-IN')}{painting.original_price?` (original ₹${Number(painting.original_price).toLocaleString('en-IN')})`:''}</p><p><b>Availability:</b> {painting.available?'Available':'Sold'}</p><p><b>Visibility:</b> {painting.archived?'Archived':painting.published?'Published':'Draft'}</p><p><b>Medium:</b> {painting.medium||'—'}</p><p><b>Dimensions:</b> {painting.dimensions||'—'}</p><p>{painting.description||'No description.'}</p>{painting.published&&<Link href={`/shop/${painting.slug}`}>View in shop ↗</Link>}</div></>;
  const action = updateProduct.bind(null, id);
  return <>
    <p><Link href="/admin/products">← All paintings</Link></p>
    <h1>Edit {painting.title}</h1>
    {saved === '1' && <p className="form-feedback success" role="status">Painting saved. Published changes are now visible in the shop.</p>}
    <p className="muted">Changes to a published painting appear in the shop. Use price 0 for “Price on request.”</p>
    <div className="panel">
      {painting.image_url && <img src={painting.image_url} alt={painting.title} className="admin-product-preview" />}
      <form action={action} className="form-grid">
        <label className="field">Title<input name="title" defaultValue={painting.title} required /></label>
        <label className="field">Slug<input name="slug" defaultValue={painting.slug} required pattern="[a-z0-9-]+" /></label>
        <label className="field">Original price (INR; 0 = on request)<input name="price" type="number" min="0" step="0.01" defaultValue={painting.original_price || painting.price} required /></label>
        <label className="field">Discount percentage<input name="discount_percent" type="number" min="0" max="95" step="1" defaultValue={painting.original_price ? Math.round((1 - Number(painting.price) / Number(painting.original_price)) * 100) : 0} /><small>Enter 0 to remove the offer.</small></label>
        <label className="field">Category<select name="category_id" defaultValue={painting.category_id || ''}><option value="">No category</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Medium and materials<input name="medium" defaultValue={painting.medium || ''} placeholder="Add only when confirmed" /></label>
        <label className="field">Dimensions<input name="dimensions" defaultValue={painting.dimensions || ''} placeholder="Add only when confirmed" /></label>
        <label className="field full">Artwork story and maker’s note<textarea name="description" rows={5} defaultValue={painting.description || ''} /></label>
        <label className="field full">Artist inspiration<textarea name="inspiration" rows={3} defaultValue={painting.inspiration || ''} placeholder="The memory, place, or idea behind this piece"/></label>
        <label className="field full">Care instructions<textarea name="care_instructions" rows={3} defaultValue={painting.care_instructions || ''} placeholder="How the collector should protect and clean the artwork"/></label>
        <label className="field">Creation time in hours<input name="creation_hours" type="number" min="1" max="10000" defaultValue={painting.creation_hours || ''}/></label>
        <label className="field">Edition number<input name="edition_number" type="number" min="1" defaultValue={painting.edition_number || ''} placeholder="1"/></label>
        <label className="field">Edition total<input name="edition_total" type="number" min="1" defaultValue={painting.edition_total || ''} placeholder="Blank means original 1 of 1"/></label>
        <label className="field">Colour palette<input name="palette" defaultValue={(painting.palette || []).join(', ')} placeholder="terracotta, indigo, gold"/></label>
        <label className="field">Suggested rooms<input name="room_tags" defaultValue={(painting.room_tags || []).join(', ')} placeholder="living room, entryway, bedroom"/></label>
        <label className="field full">Artist video URL<input type="url" name="artist_video_url" defaultValue={painting.artist_video_url || ''} placeholder="https://…"/></label>
        <label className="field">Before/reference image URL<input name="reference_image_url" defaultValue={painting.reference_image_url || ''} placeholder="Use only with customer permission"/></label>
        <label className="field">Finished artwork image URL<input name="completed_image_url" defaultValue={painting.completed_image_url || ''}/></label>
        <label><input type="checkbox" name="reservation_enabled" defaultChecked={painting.reservation_enabled}/> Allow temporary reservation</label>
        <label className="field">Reservation hours<input type="number" name="reservation_hours" min="1" max="72" defaultValue={painting.reservation_hours || 24}/></label>
        <label className="field full">Main artwork image URL or gallery path<input name="image_url" defaultValue={painting.image_url || ''} placeholder="https://… or /artist-gallery/image.jpg" /></label>
        {(['Detail view', 'Framed view', 'In a room for scale'] as const).map((label, index) => {
          const image = images?.find(item => item.sort_order === index + 1);
          return <div className="admin-gallery-pair" key={label}><label className="field">{label} image URL<input name={`gallery_url_${index + 1}`} defaultValue={image?.url || ''} placeholder="https://… or /artist-gallery/image.jpg" /></label><label className="field">Image description<input name={`gallery_alt_${index + 1}`} defaultValue={image?.alt_text || ''} maxLength={180} /></label></div>;
        })}
        <label className="field">Availability<select name="available" defaultValue={painting.available ? 'true' : 'false'}><option value="true">Available</option><option value="false">Sold</option></select></label>
        <label><input type="checkbox" name="published" defaultChecked={painting.published} /> Publish in shop</label>
        <label><input type="checkbox" name="featured" defaultChecked={painting.featured} /> Featured</label>
        <label><input type="checkbox" name="archived" defaultChecked={painting.archived} /> Archive</label>
        <AdminSubmitButton>Save changes</AdminSubmitButton>
      </form>
    </div>
    {painting.published && <p><Link href={`/shop/${painting.slug}`}>View painting in shop ↗</Link></p>}
  </>;
}
