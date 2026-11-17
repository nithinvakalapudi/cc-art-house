export default function ArtworkLoading() {
  return (
    <div className="artwork-route-loading" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>Opening the artwork</strong>
        <p>Loading the painting and its details…</p>
      </div>
    </div>
  );
}
