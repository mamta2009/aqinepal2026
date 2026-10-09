/**
 * Standard Next.js server via PM2 (same pattern as other Intelladapt Next apps).
 *
 * On the server (set build-time env before build — not here):
 *   cd frontend
 *   # .env.production or export:
 *   #   NEXT_PUBLIC_SITE_URL=https://ews.intelladapt.ai
 *   #   BACKEND_PROXY_TARGET=http://127.0.0.1:8010
 *   npm install && npm run build
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *
 * Leave NEXT_PUBLIC_API_BASE unset so the browser uses same-origin /api.
 */
module.exports = {
  apps: [
    {
      name: "climate-compass-nextjs",
      cwd: "/home/intelladapt/aqinepal2026/climate-compass/frontend",
      script: "npm",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3012,
      },
    },
  ],
};
