# Vercel production (static site + API proxy)

This repository is set up so **Vercel** can host the **HTML, JS, and static assets** from the repo while **FastAPI stays on your API host** (for example **`early-warning-system/render.yaml`** → Render).

The root [`vercel.json`](../../../vercel.json) does three things:

1. **Serves** landing, dashboard, guides, users, admin, and registration **from files in this repo** (no `npm` build).
2. **Rewrites** `/api/*` (and a few other backend-only routes) to your **`YOUR_FASTAPI_BACKEND_HOST`** origin so the browser still calls **`/api/...` on the Vercel domain** (same-origin cookies and `fetch` URLs keep working).
3. **Redirects** legacy `/documentation` → `/guides`.

## One-time: point rewrites at your API

In [`vercel.json`](../../../vercel.json), replace every:

`https://YOUR_FASTAPI_BACKEND_HOST`

with your real API **origin** (no path), for example:

`https://early-warning-nepal-api.onrender.com`

(no trailing slash).

You can do that in the editor, or from the repo root:

```bash
export VERCEL_BACKEND_URL='https://YOUR-API_HOST.example.com'   # no trailing slash
node scripts/patch-vercel-backend.js
```

Review `git diff vercel.json` before committing that change if the URL is not meant to be public.

## Vercel project settings

| Setting | Suggested value |
|--------|------------------|
| **Framework preset** | Other |
| **Root directory** | `.` (repository root) |
| **Production branch** | `prodvercel1` (or `main` after merge) |
| **Build command** | *(none)* — leave empty |
| **Output directory** | *(none)* — leave empty |

Install command: leave empty (not required).

## API host (Render / elsewhere)

- Deploy **`early-warning-system/backend`** with **`uvicorn`** per [`render.yaml`](../../render.yaml).
- With the **Vercel `/api` proxy**, you usually leave **`PUBLIC_API_ORIGIN`** **unset** on the API so [`GET /api/runtime-config`](../../backend/main.py) does not force a different API origin; the dashboard then uses the **current page origin** and still hits `/api` on Vercel, which proxies to the backend.
- Ensure **HTTPS** on both Vercel and the API URL you embed in `vercel.json`.

## Routes handled on Vercel (static)

| Path | File |
|------|------|
| `/` | `early-warning-system/landing/landing.html` |
| `/guides` | `early-warning-system/landing/guides.html` |
| `/users` | `early-warning-system/landing/users.html` |
| `/admin/dashboard` | `early-warning-system/landing/admin_dashboard.html` |
| `/registration` | `early-warning-system/landing/registration_portal.html` |
| `/frontend/*` | `early-warning-system/frontend/*` |
| `/landing-assets/*` | `early-warning-system/landing/assets/*` |
| `/guides/media/tech/*` | `early-warning-system/docs/tech/*` |

## Proxied to the FastAPI host

These need a working **`YOUR_FASTAPI_BACKEND_HOST`** in `vercel.json`:

- `/api/*` — all JSON APIs, auth, admin, webhooks, etc.
- `/guides/md/*` — server-rendered Markdown from `docs/guides/`
- `/registration/contacts-directory`
- `/docs`, `/openapi.json`, `/redoc` — Swagger / OpenAPI

## Optional: `intelladapt-logo.png`

Several pages reference **`/landing-assets/intelladapt-logo.png`**. If that file is missing from `landing/assets`, add it or the favicon rewrite may return 404 until fixed.
