export default function ShopLoading() {
  return <div className="shop-loading" role="status" aria-live="polite">
    <div className="shop-loading-intro"><span className="loading-spinner" aria-hidden="true" /><div><strong>Finding your next favourite piece</strong><p>Loading paintings and categories…</p></div></div>
    <div className="shop-loading-grid" aria-hidden="true"><div/><div/><div/></div>
  </div>;
}
