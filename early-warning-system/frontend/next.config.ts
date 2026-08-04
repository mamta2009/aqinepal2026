import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Allow opening `next dev` via either hostname (localhost vs 127.0.0.1).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

/**
 * In `next dev`, proxy /api → FastAPI so session cookies are same-origin on :3000.
 * Static export (production) talks to FastAPI on the same host — no rewrite needed.
 */
export default function createNextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const apiBase = (
      process.env.BACKEND_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_API_BASE ||
      "http://localhost:8000"
    ).replace(/\/$/, "");

    // Drop output:export in dev so rewrites can proxy /api → FastAPI.
    const { output: _export, ...devConfig } = baseConfig;
    return {
      ...devConfig,
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

  return baseConfig;
}
