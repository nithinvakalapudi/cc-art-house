export default function Loading() {
  return <div className="route-loading" role="status" aria-live="polite">
    <span className="loading-spinner" aria-hidden="true" />
    <div><strong>Getting the studio ready</strong><p>Loading artwork and page details…</p></div>
  </div>;
}
