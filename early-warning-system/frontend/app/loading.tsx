export default function Loading() {
  return (
    <div className="page-shell section-space" role="status">
      <div className="h-4 w-32 animate-pulse rounded bg-sky-soft" />
      <div className="mt-5 h-12 max-w-xl animate-pulse rounded-xl bg-sky-soft" />
      <div className="mt-4 h-6 max-w-2xl animate-pulse rounded bg-sky-soft" />
      <span className="sr-only">Loading Climate Compass…</span>
    </div>
  );
}
