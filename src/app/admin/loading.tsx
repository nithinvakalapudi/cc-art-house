export default function AdminLoading() {
  return <div className="admin-layout">
    <aside className="admin-sidebar" aria-hidden="true" />
    <div className="admin-main">
      <div className="route-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <div><strong>Opening the admin portal</strong><p>Loading the latest studio information…</p></div>
      </div>
    </div>
  </div>;
}
