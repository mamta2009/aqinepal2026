# Implementation snapshot (Living reference)

Concise technical truth for **Climate Compass** (`early-warning-system/`) backends, env, and public API behaviour. Prefer this over older marketing summaries when wording registrations or integrations. **Rendered on site:** **`/guides/md/IMPLEMENTATION_SNAPSHOT.md`** (Markdown → HTML).

**Last aligned with codebase:** backend `main.py`, `admin_panel.py`, `cities_config.py`, `notification_auth.py`, `external_integrations.py`, `aq_snapshot_sync.py`, `notifications_api.py`, `twilio_notify.py`, Next.js `frontend/`, Expo `mobile-app/` (Sep 2026).

---

## Notifications & alerts (`notifications_api.py`, `twilio_notify.py`, `notification_auth.py`, `db_state.py`)

| Item                      | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Diagram**               | [`NOTIFICATION_FLOW_DIAGRAM.svg`](/guides/media/tech/NOTIFICATION_FLOW_DIAGRAM.svg) — implementation flow (registration, MongoDB, Twilio, Resend, webhooks). Shown on **`/guides`** under _Notification & alert flow_.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **MongoDB**               | **`MONGODB_URL`** (**`DATABASE_URL`** accepted as fallback). Database **`early_warning`**: collections **`contacts`**, **`notification_logs`**, **`consent_records`**, **`inbound_messages`**, **`alert_broadcasts`**, **`alert_evaluation_cooldown`** (last evaluate-triggered broadcast per city). Operational: **`air_quality_snapshots`** (latest AQ per municipality when sync enabled), **`action_logs`** (facility audit rows). Daily facility rows: **`respiratory_daily_reports`** (separate pipeline; optional spike→broadcast hook). Indexes ensured at startup via **`ensure_notification_indexes()`** and **`ensure_operational_data_indexes()`**. |
| **Registration**          | **`GET /registration`** (static) → **`POST /api/contacts/register`**; **`POST /api/contacts/verify`**. **`city`** should be one of **`CITIES_CONFIG`** keys (validated when sent). One shared verification code for email / SMS / WhatsApp when channels are configured.                                                                                                                                                                                                                                                                                                                                                                                        |
| **Outbound**              | **`POST /api/notifications/send`** (single contact); **`POST /api/alerts/broadcast`**; **`POST /api/alerts/evaluate`** (fetches live AQ for a configured city, applies **`min_level`** + optional cooldown, then schedules same broadcast path). Verified + consented contacts only; **`BackgroundTasks`**. Channels: **Twilio** SMS & WhatsApp (`twilio_notify`, per-channel), **Resend** email (optional **`RESEND_API_KEY`**).                                                                                                                                                                                                                               |
| **Admin auth (optional)** | When **`NOTIFICATION_API_KEY`** is set, protected routes require **`Authorization: Bearer <key>`** or header **`X-API-Key`**. Applies to send, broadcast, evaluate, Twilio test, contact list/get, preferences, analytics — **not** to public register/verify, webhooks, or **`GET /registration`**.                                                                                                                                                                                                                                                                                                                                                            |
| **Inbound**               | **`POST /api/webhooks/sms`**, **`/api/webhooks/whatsapp`**, **`/api/webhooks/message-status`** — log inbound, optional auto-reply, delivery status on logs. Optional **`TWILIO_WEBHOOK_VALIDATE`** (signature check; set **`TWILIO_WEBHOOK_PUBLIC_URL`** to the exact public URL if behind a proxy).                                                                                                                                                                                                                                                                                                                                                            |
| **Health / config**       | **`GET /api/health`** → **`notification_registry`** when MongoDB is connected. **`GET /api/runtime-config`** → **`resend_configured`** under **`integrations`**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Automation**            | **`POST /api/alerts/evaluate`** — server-side AQ fetch + thresholding; **`ALERT_EVAL_COOLDOWN_MINUTES`** dedupes repeat broadcasts (Mongo **`alert_evaluation_cooldown`**). Cron may call evaluate or **`/api/air-quality/current`** + **`POST /api/alerts/broadcast`**. **`POST /api/health/cases/daily-report`** can trigger a **respiratory surge** broadcast when **`DAILY_REPORT_NOTIFY_ENABLED`** and case counts exceed a multiple of the rolling average (**`DAILY_SPIKE_*`** env vars).                                                                                                                                                                |

---

## Runtime & configuration

| Item                                           | Behaviour                                                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env load order                                 | **`backend/.env`** first, then **`config/.env`** (fills only unset vars). Template: **`backend/.env.example`**, **`config/.env.example`**. Mongo connection accepts **`DATABASE_URL`** if **`MONGODB_URL`** is unset. |
| **`DEPLOYMENT_MODE`**                          | Default **`REGIONAL`**. Surfaced as `deployment_mode` / `current_mode` in payloads (see `/api/cases/all-cities`, `/api/deployment-status`).                                                                           |
| **`PUBLIC_API_ORIGIN`**, **`API_PATH_PREFIX`** | Shown via **`GET /api/runtime-config`** for dashboards hosted off-origin.                                                                                                                                             |

---

## Geography & demos

| Item                      | Behaviour                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configured cities**     | Eight municipalities in **`cities_config.py`** (`CITIES_CONFIG`, imported by `main.py` and notification routes). Bagmati-area plus Bharatpur/Narayanghad. **`GET /api/cities`** returns `mode: "regional"` and per-city **`status: "ACTIVE"`**. |
| **Synthetic health data** | Weekly case pattern from **`health_data_generator.py`** (WHO-style realism, not DHIS2-sourced unless you replace the pipeline).                                                                                                                 |
| **Forecast trend**        | **`GET /api/models/predict/week/{city}`** uses **`ai_models.predict_week_trend`** (sklearn regression when installed, else moving average).                                                                                                     |

---

## Air quality resolver (`GET /api/air-quality/current`)

Order (see **`air_quality_current_waqi_then_rapid`** in `external_integrations.py`):

1. **WAQI local stations** when **`WAQI_TOKEN`** / **`WAQI_API_TOKEN`** etc. are set — **map/bounds** median AQI of nearby live stations (default ~30 km), then **city search** if needed. Broken **`/feed/`** paths are skipped so clients are not delayed by `can not connect`.
2. **WeatherAPI.com direct** when **`WEATHERAPI_COM_API_KEY`** (alias **`WEATHERAPI_API_KEY`**) is set — model AQ estimate (`aqi=yes`); preferred for **heat/rain**, air **fallback** only.
3. **RapidAPI weather product** — credentials **`RAPIDAPI_WEATHER_API_KEY`**, **`RAPIDAPI_WEATHER_HOST`**, **`RAPIDAPI_WEATHER_PATH`**, **`RAPIDAPI_WEATHER_QUERY_MODE`**.

**Normalization:** WAQI **`iaqi.pm25`** is **not** treated as µg/m³ (it is typically AQI-like). Headline payloads may therefore have **`aqi`** with **`pm25_ug_m3: null`**. Web and mobile UIs seed charts / compare / forecast from **PM2.5 when present, otherwise station AQI**.

**Caching:** **`AIR_QUALITY_COORD_CACHE_SECONDS`** (default ~120s) deduplicates by rounded lat/lon on the canonical route.

### Station UID notes (optional)

Where **`cities_config.py`** sets **`aqicn_station_uid`** (numeric id, e.g. Kathmandu **`14868`**), the field is retained for reference/docs. Live **`GET /api/air-quality/current`** and **`aq_snapshot_sync`** use the same **map/bounds → WeatherAPI** path as above (not a blocking station `/feed/` first hop).

### Persisted AQ + audit + export

| Env                            | Behaviour                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AQ_SNAPSHOT_SYNC_ENABLED`** | When **`true`/`1`** and Mongo connected, **`APScheduler`** runs **`sync_all_air_quality_snapshots`** every **`AQ_SNAPSHOT_SYNC_HOURS`** (default **`6`**). Upserts one doc per city into **`air_quality_snapshots`**. |

| Route                                         | Purpose                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`GET /api/air-quality/snapshots`**          | Read latest persisted rows (**503** without MongoDB). Optional **`?city=`**.                                               |
| **`POST /api/air-quality/snapshots/refresh`** | Background full refresh (**`BackgroundTasks`**).                                                                           |
| **`POST /api/action-log`**                    | Append **`action_logs`** (facility audit). **`city`** must be in **`CITIES_CONFIG`** when set.                             |
| **`GET /api/action-log/{facility_id}`**       | Recent **`action_logs`** for one facility (**`timestamp`** descending).                                                    |
| **`GET /api/data/export`**                    | **`kind=air_snapshots`** \| **`action_logs`**, **`format=json`** \| **`csv`**, optional **`facility_id`** filter for logs. |

---

## Weather routes

| Route                                            | Purpose                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **`GET /api/weather/current`**                   | Current conditions: **WeatherAPI.com direct** if `WEATHERAPI_COM_API_KEY` set, else **RapidAPI** (`rapidapi_weather_current`). |
| **`GET /api/weather/open-weather13/fiveday`**    | RapidAPI “Open Weather 13” five-day aggregate.                                                                                 |
| **`GET /api/weather/meteostat/monthly`**         | Meteostat monthly series via RapidAPI.                                                                                         |
| **`GET /api/weather/openweather/current`**       | **OpenWeatherMap** Current Weather 2.5 (**supplementary**; own key **`OPENWEATHER_API_KEY`**).                                 |
| **`GET /api/weather/openweather/air-pollution`** | **OpenWeatherMap** Air Pollution 2.5 — **cross-check only**; not merged into headline AQ resolver unless you change code.      |

**OpenWeatherMap base URL:** override with **`OPENWEATHERMAP_API_BASE_URL`** if needed.

---

## Provenance / A2A

Responses that expose integration data frequently include **`source`** plus **`provenance`** (from **`integration_provenance_for_source`**):

- **`provenance.deployment_role`** — routing stance (replacing deprecated `pilot_role`).
- **`provenance.confidence`** — heuristic **`score`** / **`tier`** / **`basis`** (policy-weighted, **not** formal measurement CIs).
- **`provenance.a2a`** — **`usable_as_primary_measurement`** and **`recommended_use`** for agent workflows.

Configured sources include: `weatherapi_com`, `waqi`, `rapidapi_weather_air_quality`, `rapidapi_weather`, `rapidapi_open_weather13`, `rapidapi_meteostat_monthly`, `openweathermap_current`, `openweathermap_air_pollution`.

---

## Deployment / roadmap JSON shapes

**`GET /api/deployment-status`** includes **`current_mode`** from env (default REGIONAL), **`regional_phase`**, **`phase_2`**, **`national_scale`**.

**`GET /api/statistics`** uses **`phase_1_regional`** (population/hospital rollup for demo config).

---

## Other notable endpoints

| Area             | Routes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health & anchors | **`GET /api/health`** (`mongodb_persistence`, `notification_registry`), case routes with **`verification`** objects                                                                                                                                                                                                                                                                                                                             |
| LLM proxy        | **`POST /api/ai/openrouter`** — **`OPENROUTER_API_KEY`**, **`OPENROUTER_MODEL`**, optional referer/app title headers                                                                                                                                                                                                                                                                                                                            |
| DHIS2            | **`GET /api/dhis2/system-check`**                                                                                                                                                                                                                                                                                                                                                                                                               |
| Persistence      | **`POST /api/health/cases/daily-report`** → MongoDB **`respiratory_daily_reports`** when **`MONGODB_URL`** / **`DATABASE_URL`** valid; optional **`DAILY_REPORT_NOTIFY_ENABLED`** surge messaging (see snapshot **Automation** row); persisted AQ + audit: **`GET /api/air-quality/snapshots`**, **`POST /api/air-quality/snapshots/refresh`**, **`POST /api/action-log`**, **`GET /api/action-log/{facility_id}`**, **`GET /api/data/export`** |
| Notifications    | **`POST /api/contacts/register`**, **`POST /api/contacts/verify`**; list / get / preferences; **`POST /api/notifications/send`**, **`POST /api/alerts/broadcast`**, **`POST /api/alerts/evaluate`**; webhooks; **`GET /api/analytics/*`** — see **Notifications & alerts** (optional **`NOTIFICATION_API_KEY`**)                                                                                                                                |
| Operator admin   | **`GET /admin/dashboard`** (HTML); **`POST /api/admin/console-unlock-pin`**; **`/api/admin/*`** JSON — see section **Operator admin** below (**`NOTIFICATION_API_KEY`** on JSON routes).                                                                                                                                                                                                                                                        |
| Index            | **`GET /api/system-discovery`** — canonical endpoint map (+ OpenAPI **`/docs`**)                                                                                                                                                                                                                                                                                                                                                                |

---

## Operator admin (`admin_panel.py`, `GET /admin/dashboard`)

Browser UI: **`GET /admin/dashboard`** serves **`landing/admin_dashboard.html`** (enrollee table, system status including Mongo + integration flags, **24-hour** activity summary, recent **`action_logs`**, Polygon network overview, **on-chain anchor audit** + optional **smoke-touch** test). **`GET /guides`** is linked from that page so non-engineering operators can open diagrams and markdown guides (**`/guides/md/…`**). **Partner-restricted** markdown under **`docs-private/`** is listed only inside the admin console (**Private documentation** panel).

**PIN vs API key**

- **`POST /api/admin/console-unlock-pin`** — validates operator PIN only for the dashboard UX shell. Env: **`ADMIN_CONSOLE_PIN`** or **`REGISTRATION_DIRECTORY_SECRET`**, otherwise the dev fallback documented in **`admin_panel.py`**. Incorrect PIN yields **401** with delay hardening.
- All JSON routes in the table below use **`Depends(require_strict_notification_api_key)`**: callers must send **`Authorization: Bearer <NOTIFICATION_API_KEY>`** or **`X-API-Key: <NOTIFICATION_API_KEY>`**.

The HTML console stores that API key in **`sessionStorage`** (per browser tab).

| Route                                                 | Purpose                                                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`GET /api/admin/system-status`**                    | Mongo reachable + boolean “key present” hints for integrations.                                                                                                                               |
| **`GET /api/admin/activity/summary`**                 | Approximate counters for roughly the past **24 hours** (pulse check for operators).                                                                                                           |
| **`GET /api/admin/activity/recent-action-logs`**      | Latest facility / preparedness **`action_logs`** rows for review.                                                                                                                             |
| **`GET /api/admin/registrants`**                      | Listed enrollees (filters/query per handler).                                                                                                                                                 |
| **`POST /api/admin/registrants`**                     | Operator-side create (aligned with **`ContactRegistration`** persistence).                                                                                                                    |
| **`PATCH /api/admin/registrants/{contact_id}`**       | Update enrollee lifecycle fields as implemented in **`admin_panel.py`**.                                                                                                                      |
| **`DELETE /api/admin/registrants/{contact_id}`**      | Archive/delete semantics as implemented in **`admin_panel.py`**.                                                                                                                              |
| **`PATCH /api/admin/contacts/{contact_id}/password`** | Set password for enrollee auth where configured.                                                                                                                                              |
| **`GET /api/admin/blockchain/overview`**              | Polygon / on-chain logger readiness summary (signer, RPC, balance, `POLYGON_ONCHAIN_LOG`).                                                                                                    |
| **`PATCH /api/admin/blockchain/runtime-network`**     | Temporary network switch until process restart (**set `.env` for durable production**).                                                                                                       |
| **`GET /api/admin/blockchain/anchors`**               | Recent rows from MongoDB **`onchain_anchor_log`** (optional `event_type=` filter: `ALERT`, `ACTION`, `OUTCOME`, `HEAT_ALERT`, `SMOKE_TEST`). **Operator-only** — not a public ledger browser. |
| **`POST /api/admin/blockchain/smoke-touch`**          | Sends one minimal **`log_action`** (“smoke test”) to verify signer + RPC; **uses gas** on the effective network (test POL on Amoy, **real POL on mainnet**).                                  |
| **`POST /api/admin/blockchain/log-outcome`**          | Operator-submitted outcome snapshot → **`log_outcome`** when logging is enabled (+ Mongo row).                                                                                                |
| **`GET /api/admin/private-documentation/md-files`**   | List **`docs-private/**/\*.md`\*\* (operator preview only).                                                                                                                                   |
| **`GET /api/admin/private-documentation/md`**         | **`?path=`** — render Markdown → HTML fragment for the admin dashboard.                                                                                                                       |

**Polygon on-chain audit trail (product wiring)**

- **Runtime:** [`backend/onchain_logger.py`](../../backend/onchain_logger.py) (`BlockchainLogger`) — optional txs when **`POLYGON_ONCHAIN_LOG=true`** and **`POLYGON_PRIVATE_KEY`** is set; network from **`BLOCKCHAIN_ONCHAIN_NETWORK`** (`amoy` \| `mumbai` \| `mainnet`).
- **Bridge:** [`backend/onchain_hooks.py`](../../backend/onchain_hooks.py) — calls `log_alert` / `log_action` / `log_outcome` from real flows and persists every attempt (success, skip, or error) to MongoDB **`onchain_anchor_log`**.
- **Triggers (examples):** air **`POST /api/alerts/broadcast`**, **`POST /api/alerts/evaluate`**, heat **`POST /api/alerts/evaluate-heat`**, facility **`POST /api/action-log`**, plus admin outcome + smoke endpoints above.
- **Verification:** use **Admin → Polygon** (overview + **Load recent anchors** + **Send test on-chain touch**). On mainnet, smoke tests spend **real POL**; use **Amoy** first (`BLOCKCHAIN_ONCHAIN_NETWORK=amoy`, faucet-funded signer).

---

## Frontend dashboard

**Next.js `frontend/`** (static export) and **Expo `mobile-app/`**: dashboard / home use **`/api/air-quality/current`** (with **`provenance`** when present). Headline messaging prefers **WAQI station AQI**; compare bars, 24h chart, 5-day forecast, alerts, and stress sandbox remain usable when only AQI is returned.

**`landing/admin_dashboard.html`**: operator console (tables, modals, Guides links + **Private documentation** panel); **Polygon** section includes network overview, **recent `onchain_anchor_log`**, optional **outcome** posting, and a **smoke-touch** button for ledger verification. Consumes **`/api/admin/*`** after unlock.

---

## Private / strategy docs (`docs-private/`)

Internal UNICEF workbook and strategy live under **`docs-private/`**. **`GET /guides` and `/guides/md/…` never link these files.** Operators open sanitized Markdown previews from **`GET /admin/dashboard`** (API endpoints in the operator admin table). When strategy text conflicts this file, treat **repository behaviour + this snapshot** as enforceable truth for demos and filings unless partners sign off differently.
