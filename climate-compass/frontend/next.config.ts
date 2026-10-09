import type { NextConfig } from "next";
import path from "node:path";

const baseConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Avoid picking up a yarn.lock from the home directory (/home/intelladapt).
  outputFileTracingRoot: path.resolve(process.cwd()),
  // Allow opening `next dev` via either hostname (localhost vs 127.0.0.1).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

/**
 * Proxy /api → FastAPI so the browser can use same-origin /api (cookies work).
 * Set BACKEND_PROXY_TARGET on the server (e.g. http://127.0.0.1:8010).
 * Leave NEXT_PUBLIC_API_BASE empty unless you intentionally call the API host directly.
 *
 * skipTrailingSlashRedirect avoids 308 /api/foo → /api/foo/, which breaks some
 * mobile/axios clients (followed POST can become Method Not Allowed on FastAPI).
 * Page links still use trailingSlash via next/link.
 */
export default function createNextConfig(): NextConfig {
  const apiBase = (
    process.env.BACKEND_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:8000"
  ).replace(/\/$/, "");

  return {
    ...baseConfig,
    skipTrailingSlashRedirect: true,
    async redirects() {
      return [
        {
          source: "/admin/dashboard",
          destination: "/admin/",
          permanent: false,
        },
        {
          source: "/admin/dashboard/",
          destination: "/admin/",
          permanent: false,
        },
      ];
    },
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ];
    },
  };
}
