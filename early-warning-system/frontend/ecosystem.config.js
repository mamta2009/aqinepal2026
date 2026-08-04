/**
 * Standard Next.js server via PM2 (same pattern as other Intelladapt Next apps).
 *
 * On the server (set build-time env before build — not here):
 *   cd frontend
 *   # .env.production or export:
 *   #   NEXT_PUBLIC_SITE_URL=https://ews.intelladapt.ai
 *   #   BACKEND_PROXY_TARGET=http://127.0.0.1:8010
 *   npm install && npm run build
 *   pm2 startOrReload ecosystem.config.js --env production
 *   pm2 save
 *
 * Leave NEXT_PUBLIC_API_BASE unset so the browser uses same-origin /api.
 */
module.exports = {
  apps: [
    {
      name: "climate-compass-nextjs",
      cwd: "/home/intelladapt/aqinepal2026/early-warning-system/frontend",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3012,
      },
    },
  ],
};
