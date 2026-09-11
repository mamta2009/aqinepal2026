# Climate Compass — SMS, email, and WhatsApp alerts

This guide explains **when** Climate Compass sends outbound messages, **which live values** decide the alert level, and **who** receives them.

**Code:** `backend/notifications_api.py` (`_air_quality_index_and_level`, `_heat_temperature_and_level`, `evaluate_air_alert`, `evaluate_heat_alert`, `broadcast_to_recipients`)  
**Related:** [`DATA_FETCHING.md`](DATA_FETCHING.md) (how live air/heat is fetched), [`DASHBOARD_FEATURES.md`](DASHBOARD_FEATURES.md) (UI vs real sends), [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md)

---

## Important distinction

| Surface                                                | Sends SMS / email / WhatsApp?                           |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Refreshing web or mobile dashboard                     | **No**                                                  |
| Admin “Dashboard PM2.5 alert line” (default 150 µg/m³) | **No** — UI badge / compare only                        |
| Per-facility PM2.5 thresholds on `/users`              | **No** — account UX only                                |
| Client “Recent Alerts” panel                           | **No** — illustrative only                              |
| `POST /api/alerts/evaluate`                            | **Yes** (when gates pass)                               |
| `POST /api/alerts/evaluate-heat`                       | **Yes** (when gates pass)                               |
| `POST /api/alerts/broadcast`                           | **Yes** (operator-supplied level; no live evaluate)     |
| Registration / OTP / facility login codes              | **Yes** (verification / auth, not environmental alerts) |

Refreshing the dashboard **never** notifies users by itself. Cron or an operator must call evaluate/broadcast (usually with `NOTIFICATION_API_KEY`).

---

## Who can receive environmental broadcasts

Base filter: `eligible_broadcast_contact_clause()` plus topic and city coverage.

A contact must typically have:

- `consent_given: true`
- `verification_status: "verified"`
- Not `approval_status` in `revoked` / `pending`
- Not `active: false`
- Coverage for the alert municipality (`city` or `cities` list)
- Environmental topic matching the hazard (`air` or `heat`; missing topics field = legacy “both”)
- Preferred channels that include the send path (email / SMS / WhatsApp)

Channels:

- **Email** — Resend when configured (`RESEND_API_KEY` / related)
- **SMS** — Sparrow or Twilio per `SMS_PROVIDER` / `DEFAULT_SMS_PROVIDER`
- **WhatsApp** — Twilio when configured

---

## Air alerts — `POST /api/alerts/evaluate`

### Live data

Uses the same resolver as the dashboard: **`air_quality_current_waqi_then_rapid`** (WAQI stations first, then WeatherAPI, then RapidAPI). See [`DATA_FETCHING.md`](DATA_FETCHING.md).

### How the level is chosen — `_air_quality_index_and_level`

**Prefer PM2.5 µg/m³ when present**

| PM2.5 (µg/m³) | Alert level |
| ------------- | ----------- |
| ≤ 35          | LOW         |
| > 35          | MODERATE    |
| > 100         | HIGH        |
| > 150         | SEVERE      |

Headline number in the message: station `aqi` if present, else a rough index from `pm25 * 4` (capped).

**If PM2.5 is missing (typical WAQI path today)**

| Station AQI | Alert level |
| ----------- | ----------- |
| ≤ 100       | LOW         |
| ≥ 101       | MODERATE    |
| ≥ 151       | HIGH        |
| ≥ 201       | SEVERE      |

Headline number: the station **AQI**.

### When a broadcast is scheduled

1. Computed level rank ≥ `min_level`
   - Default **`min_level=MODERATE`**
   - Rank: LOW=0, MODERATE=1, HIGH=2, SEVERE=3
   - So **LOW alone does not send**
2. Cooldown allows it
   - Default **`ALERT_EVAL_COOLDOWN_MINUTES=60`** per city / hazard `air`
   - Stored in Mongo `alert_evaluation_cooldown`
   - Bypass with `force: true` (still respects `min_level`)
3. Eligible recipients for that city + topic `air` (+ optional `recipient_type` filter)

### Message content (air)

Includes location, level, **AQI / index** (`aqi_value`), source, and short recommended actions, plus a dashboard link (`NOTIFICATION_DASHBOARD_URL`). SMS may use a compacted body (`sms_length.sms_body_for_broadcast`) so it fits one segment.

### Practical example (WAQI-only)

Kathmandu ~AQI **58**, `pm25_ug_m3: null` → level **LOW** → with default `min_level=MODERATE` → response `skipped: "below_min_level"` → **no SMS/email**.

Sends start when:

- Station AQI reaches **≥ 101**, or
- A fallback provider supplies PM2.5 **> 35** µg/m³ and evaluate runs.

---

## Heat alerts — `POST /api/alerts/evaluate-heat`

### Live data

`heat_current_preferred` → `effective_temp_c` (typically `max(temp_c, feelslike_c)`).

### Levels — `_heat_temperature_and_level`

Defaults (overridable by env):

| Effective °C | Env key                           | Alert level |
| ------------ | --------------------------------- | ----------- |
| < 30         | below `HEAT_THRESHOLD_MODERATE_C` | LOW         |
| ≥ 30         | `HEAT_THRESHOLD_MODERATE_C`       | MODERATE    |
| ≥ 35         | `HEAT_THRESHOLD_HIGH_C`           | HIGH        |
| ≥ 40         | `HEAT_THRESHOLD_SEVERE_C`         | SEVERE      |

Same `min_level` default (**MODERATE**) and cooldown pattern (`HEAT_EVAL_COOLDOWN_MINUTES`, else air cooldown). Topic filter: `heat`.

---

## Manual broadcast — `POST /api/alerts/broadcast`

Operator supplies city, index, and level. **No** live evaluate and **no** cooldown gate on this path. Eligibility (verified / consent / city / topics / channels) still applies.

---

## Optional respiratory surge notify

`POST /api/health/cases/daily-report` can trigger a surge-style broadcast when:

- `DAILY_REPORT_NOTIFY_ENABLED` is on
- Today’s cases exceed a multiple of the recent average (`DAILY_SPIKE_CASE_MULTIPLIER`, default **1.5**)
- Enough prior reports exist (`DAILY_SPIKE_MIN_PRIOR_REPORTS`)

This path is about **case counts**, not WAQI AQI. Typical target: eligible `health_worker` contacts for that city.

---

## Env keys (alerts)

| Variable                                              | Role                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `NOTIFICATION_API_KEY`                                | Protects evaluate / broadcast / many operator notification routes |
| `ALERT_EVAL_COOLDOWN_MINUTES`                         | Air evaluate dedupe (default 60)                                  |
| `HEAT_EVAL_COOLDOWN_MINUTES`                          | Heat evaluate dedupe (optional; falls back to air)                |
| `HEAT_THRESHOLD_MODERATE_C` / `_HIGH_C` / `_SEVERE_C` | Heat tier cutoffs (30 / 35 / 40)                                  |
| `NOTIFICATION_DASHBOARD_URL`                          | Link in message bodies                                            |
| `RESEND_API_KEY` (and from-address vars)              | Email                                                             |
| `SMS_PROVIDER` / `DEFAULT_SMS_PROVIDER`               | `sparrow`, `twilio`, or `auto`                                    |
| Twilio / Sparrow credentials                          | SMS / WhatsApp                                                    |
| `DAILY_REPORT_NOTIFY_ENABLED`, `DAILY_SPIKE_*`        | Optional case-surge notify                                        |

Templates: `backend/.env.example`.

---

## Quick checks

```bash
# Requires NOTIFICATION_API_KEY when configured
curl -X POST "http://127.0.0.1:8000/api/alerts/evaluate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"city":"Kathmandu","min_level":"MODERATE"}'
```

Inspect JSON:

- `aqi_value` / `aqi_level` — computed from live air
- `skipped: "below_min_level"` or `"cooldown"` — no send
- `recipients_count` — scheduled when gates pass

Latest stored broadcast summary (not the client Recent Alerts panel):

```bash
curl "http://127.0.0.1:8000/api/alerts/latest?city=Kathmandu"
```

---

## Related docs

| Doc                                                          | Use when                                         |
| ------------------------------------------------------------ | ------------------------------------------------ |
| [`DATA_FETCHING.md`](DATA_FETCHING.md)                       | Where AQI / PM2.5 / heat numbers come from       |
| [`ALERTS_AND_NOTIFICATIONS.md`](ALERTS_AND_NOTIFICATIONS.md) | When those values trigger SMS / email / WhatsApp |
| [`DASHBOARD_FEATURES.md`](DASHBOARD_FEATURES.md)             | UI panels vs real outbound history               |
| [`IMPLEMENTATION_SNAPSHOT.md`](IMPLEMENTATION_SNAPSHOT.md)   | Mongo collections, auth, route map               |

**Last aligned:** Sep 2026 — WAQI-first air evaluate; PM2.5 preferred when present; default send gate `min_level=MODERATE`.
