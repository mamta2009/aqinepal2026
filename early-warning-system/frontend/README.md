# Climate Compass frontend

Next.js App Router UI, built as a **static export** and served by FastAPI.

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

## Auth

Registrant and facility sessions use HttpOnly cookie `cc_registrant_token` set by
`POST /api/auth/login` and `POST /api/auth/facility-token`. Admin PIN sessions use
`ew_admin_session`. Logout: `POST /api/auth/logout`.
