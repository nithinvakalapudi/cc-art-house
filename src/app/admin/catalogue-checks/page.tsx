import Link from 'next/link';
import { requireAdminDb } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function CatalogueChecksPage() {
  const db = await requireAdminDb();
  const { data: products, error } = await db.from('products').select('id,title,slug,price,image_url,description,dimensions,medium,category_id,published,archived').order('title');
  const checks = (products ?? []).map((product) => {
    const missing = [!product.image_url && 'main photo', !product.description && 'description', !product.dimensions && 'dimensions', !product.medium && 'medium', !product.category_id && 'category', Number(product.price) <= 0 && 'confirmed price'].filter(Boolean) as string[];
    return { ...product, missing };
  });
  const incomplete = checks.filter((product) => product.missing.length > 0);
  const liveIncomplete = incomplete.filter((product) => product.published && !product.archived).length;
  return <div className="admin-feature-page">
    <header className="admin-feature-heading"><div><span className="admin-eyebrow">PUBLISHING QUALITY</span><h1>Catalogue checks</h1><p>Catch incomplete listings before collectors see them in the shop.</p></div><span className="admin-readonly-tag">{incomplete.length} incomplete · {liveIncomplete} live</span></header>
    <section className="admin-feature-stats"><article><span>Total paintings</span><strong>{checks.length}</strong></article><article className={incomplete.length ? 'warning' : ''}><span>Need details</span><strong>{incomplete.length}</strong></article><article className={liveIncomplete ? 'danger' : ''}><span>Live and incomplete</span><strong>{liveIncomplete}</strong></article></section>
    {error && <p className="notice">Catalogue checks could not be loaded.</p>}
    <section className="panel admin-data-panel"><h2>Listing quality</h2>{checks.length ? <div className="admin-table-scroll"><table className="table"><thead><tr><th>Painting</th><th>Listing status</th><th>Missing details</th><th>Action</th></tr></thead><tbody>{checks.map((product) => <tr key={product.id}><td><strong>{product.title}</strong></td><td>{product.archived ? 'Archived' : product.published ? 'Published' : 'Draft'}</td><td>{product.missing.length ? product.missing.join(', ') : <span className="admin-stock-pill ready">Complete</span>}</td><td><Link href={`/admin/products/${product.id}`}>Review listing →</Link></td></tr>)}</tbody></table></div> : <p className="admin-empty-state">Add your first painting to run catalogue checks.</p>}</section>
  </div>;
}
