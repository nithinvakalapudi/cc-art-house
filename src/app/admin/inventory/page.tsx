import Link from 'next/link';
import { AlertTriangle, Boxes, CircleOff } from 'lucide-react';
import AdminSubmitButton from '@/components/admin-submit-button';
import { isAdmin, requireAdminDb } from '@/lib/supabase-server';
import { updateInventory } from './actions';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const db = await requireAdminDb();
  const canWrite = await isAdmin();
  const { data: products, error } = await db.from('products').select('id,title,slug,image_url,stock_quantity,low_stock_threshold,available,published,archived').order('title');
  const out = products?.filter((product) => Number(product.stock_quantity ?? 0) === 0).length ?? 0;
  const low = products?.filter((product) => Number(product.stock_quantity ?? 0) > 0 && Number(product.stock_quantity) <= Number(product.low_stock_threshold ?? 1)).length ?? 0;
  const tracked = products?.filter((product) => product.stock_quantity !== null).length ?? 0;

  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">STOCK CONTROL</span><h1>Inventory</h1><p>Keep availability accurate as paintings sell or new pieces are added.</p></div><Link className="admin-primary-action" href="/admin/products">Manage paintings</Link></header>
    <section className="admin-feature-stats"><article><Boxes/><span>Tracked paintings</span><strong>{tracked}</strong></article><article className={low ? 'warning' : ''}><AlertTriangle/><span>Running low</span><strong>{low}</strong></article><article className={out ? 'danger' : ''}><CircleOff/><span>Out of stock</span><strong>{out}</strong></article></section>
    {error && <p className="notice">Inventory could not be loaded. Confirm the admin migration has completed.</p>}
    <section className="panel admin-data-panel"><h2>Stock by painting</h2><div className="admin-table-scroll"><table className="table"><thead><tr><th>Painting</th><th>Availability</th><th>Quantity</th><th>Low stock alert</th><th>Save</th></tr></thead><tbody>{products?.map((product) => {
      const quantity = Number(product.stock_quantity ?? 0);
      const isLow = quantity > 0 && quantity <= Number(product.low_stock_threshold ?? 1);
      return <tr key={product.id}><td><Link href={`/admin/products/${product.id}`}><strong>{product.title}</strong></Link><small className="admin-row-hint">{product.published && !product.archived ? 'Live in shop' : product.archived ? 'Archived' : 'Draft'}</small></td><td><span className={`admin-stock-pill ${quantity === 0 ? 'empty' : isLow ? 'low' : 'ready'}`}>{quantity === 0 ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}</span></td><td>{canWrite ? <><label className="sr-only" htmlFor={`stock-${product.id}`}>Stock quantity for {product.title}</label><input form={`inventory-${product.id}`} id={`stock-${product.id}`} type="number" name="stock_quantity" min="0" max="100000" defaultValue={quantity}/></> : quantity}</td><td>{canWrite ? <input form={`inventory-${product.id}`} id={`threshold-${product.id}`} type="number" name="low_stock_threshold" min="0" max="100000" defaultValue={product.low_stock_threshold ?? 1} aria-label={`Low stock alert for ${product.title}`}/> : product.low_stock_threshold}</td><td>{canWrite ? <form id={`inventory-${product.id}`} action={updateInventory}><input type="hidden" name="id" value={product.id}/><AdminSubmitButton>Save</AdminSubmitButton></form> : <span className="muted">Read only</span>}</td></tr>;
    })}</tbody></table></div>{!products?.length && !error && <p className="admin-empty-state">Add paintings to the catalogue to track their stock here.</p>}<p className="muted">Saving a quantity of zero removes the painting from checkout. One-off works can be set to one; numbered editions can use their available quantity.</p></section>
  </div>;
}
