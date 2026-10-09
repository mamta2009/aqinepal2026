# Climate Compass frontend

Next.js App Router UI for **Climate Compass**, built as a **static export** and served by FastAPI.

Includes the public landing, guides, registration surfaces, and the situational dashboard (live WAQI-first air scores with AQI fallbacks when PM2.5 µg/m³ is missing, heat/rain context, compare cities, illustrative 24h / 5-day views, stress sandbox).

## Build (served by FastAPI)

```bash
cp .env.example .env.local
npm install
npm run build
```

Output: `out/`. Start FastAPI from `../backend` and open `http://127.0.0.1:8000/`.

Set `NEXT_PUBLIC_SITE_URL` to the public site URL before building (used for sitemap/metadata).

## Local Next.js dev (optional)

```bash
# .env.local
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run dev
```

Browser calls go straight to FastAPI `/api/*` with cookies (`credentials: "include"`).

## Server (PM2)

`ecosystem.config.js` runs `npm start` as the `climate-compass-nextjs` process. Production listens on port **3012**.

Set build-time env before the build (`.env.production` or the shell). Leave `NEXT_PUBLIC_API_BASE` unset so the browser uses same-origin `/api`.

```bash
cd /home/intelladapt/aqinepal2026/climate-compass/frontend

# .env.production
# NEXT_PUBLIC_SITE_URL=https://ews.intelladapt.ai
# BACKEND_PROXY_TARGET=http://127.0.0.1:8010

npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Useful follow-ups:

```bash
pm2 status climate-compass-nextjs
pm2 logs climate-compass-nextjs
pm2 restart climate-compass-nextjs
```

## Auth

Registrant and facility sessions use HttpOnly cookie `cc_registrant_token` set by
`POST /api/auth/login` and `POST /api/auth/facility-token`. Admin PIN sessions use
`ew_admin_session`. Logout: `POST /api/auth/logout`.
