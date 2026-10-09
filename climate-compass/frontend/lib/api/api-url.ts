/** Resolve FastAPI URL for browser calls. */
export function apiUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  const normalized = path.replace(/^\/+/, "");
  // Prefer same-origin `/api/...` (next-dev rewrite or FastAPI static host).
  // Only use an absolute base when explicitly set (cross-origin deploys).
  return base ? `${base}/${normalized}` : `/${normalized}`;
}
