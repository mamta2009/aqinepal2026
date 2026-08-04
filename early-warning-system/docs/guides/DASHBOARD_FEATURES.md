# Dashboard and registration features guide

This guide covers:

1. What each panel on the public **Dashboard** (`/dashboard`) shows, and how that relates to real email / SMS alerts.
2. What users must fill on **Registration** (`/registration`), what each section means, and how it affects alerts and sign-in.
3. The passphrase-protected **Registrant directory** at `/registration/contacts-directory`.
4. Signed-in tools on **Users** (`/users`) after login: facility actions, inbox, friends & family, channels, delete account.
5. The PIN-locked **Operator console** at `/admin/dashboard`.
6. A short **conclusion** on what the system is really about and what each audience gets.

Open the live pages while the backend is running.

---

## Geographic Mode & City Selection

### Cities available

Both **Regional (8 Cities)** and **National Scale** currently use the same eight Phase-1 municipalities (Bagmati focus):

| City        | Elevation (approx.) | Role in the app                                  |
| ----------- | ------------------- | ------------------------------------------------ |
| Kathmandu   | 1337 m              | Default city; densest monitoring / case baseline |
| Lalitpur    | 1290 m              | Kathmandu Valley city                            |
| Bhaktapur   | 1401 m              | Kathmandu Valley city                            |
| Banepa      | 1220 m              | Valley-adjacent                                  |
| Dhulikhel   | 1550 m              | Higher elevation Valley-adjacent                 |
| Hetauda     | 610 m               | Lower elevation / corridor                       |
| Bharatpur   | 234 m               | Plains / Chitwan corridor                        |
| Narayanghad | 300 m               | Plains corridor                                  |

City metadata shown under the selector (elevation, province, population, hospitals, phase, status) comes from the dashboard city config, aligned with `backend/cities_config.py`.

### What Regional vs National does today

- The toggle updates UI mode labels only.
- It does **not** expand the city list yet. National / Phase-2 city counts described elsewhere are architectural targets, not live dropdown data.
- Switching mode resets the selected city to Kathmandu and refreshes all panels.

### What happens when you pick a city

1. City metadata updates (elevation, population, hospitals, phase, status).
2. The dashboard refreshes in parallel for that city:
   - Current air quality
   - Heat
   - Cases this week
   - 5-day forecast strip
   - Local Recent Alerts list
   - Optional Compare cities refresh (if cities are checked)
   - Header “latest broadcast” strip

---

## Live status cards (top metrics)

These cards update for the **selected city**. Air and heat come from live provider APIs when configured; cases/forecast panels may still be illustrative (see below).

### Current PM2.5

| Item           | Detail                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| Meaning        | Fine particulate matter (PM2.5) concentration in **µg/m³** for the selected city |
| Source         | `GET /api/air-quality/current?city=…`                                            |
| Provider order | WeatherAPI.com → WAQI → RapidAPI (first successful route wins)                   |
| Unit           | Micrograms per cubic metre (µg/m³)                                               |

Higher values mean denser fine particles in the air. The dashboard also uses this reading for Alert Level, Recent Alerts (UI), the 24H chart seed, trajectory, and compare-city bars.

### US EPA index (air index card)

The middle “index” card label changes with the air provider:

| When the reading comes from        | Card shows       | What it means                                                               |
| ---------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| WAQI                               | **AQI**          | Station AQI from WAQI                                                       |
| WeatherAPI.com or RapidAPI Weather | **US EPA index** | Provider US EPA category bucket (typically 1–6 style scale from WeatherAPI) |
| Only PM2.5 available               | **PM2.5 score**  | Rough 0–100 score vs 150 µg/m³ (`min(100, round(pm25/150*100))`)            |

A **routing confidence** line may show how confidently the backend chose that provider path.

### Alert Level (dashboard UI)

This is the **on-screen** air alert badge for operators browsing the dashboard. It uses the **admin dashboard PM2.5 threshold** (default **150** µg/m³; configurable in Admin → Settings / `GET /api/runtime-config`).

| Condition              | Level shown  |
| ---------------------- | ------------ |
| No PM2.5 reading       | `NO DATA`    |
| PM2.5 ≤ threshold      | **LOW**      |
| PM2.5 > threshold      | **MODERATE** |
| PM2.5 > threshold + 35 | **HIGH**     |

Notes:

- This UI scale does **not** show SEVERE.
- It is **not** identical to the server evaluate scale used for outbound notifications (see [What triggers email / SMS](#what-triggers-email--sms-to-registered-users)).

### Heat (effective °C)

| Item    | Detail                                                              |
| ------- | ------------------------------------------------------------------- |
| Meaning | Effective outdoor heat used for heat stress signalling              |
| Formula | `max(ambient temperature °C, feels-like °C)` from the heat provider |
| Source  | `GET /api/heat/current?city=…`                                      |
| Display | Effective temperature plus a heat **level** label                   |

Server heat levels (defaults; env-overridable):

| Level    | Effective °C                       |
| -------- | ---------------------------------- |
| LOW      | below 30                           |
| MODERATE | ≥ 30 (`HEAT_THRESHOLD_MODERATE_C`) |
| HIGH     | ≥ 35 (`HEAT_THRESHOLD_HIGH_C`)     |
| SEVERE   | ≥ 40 (`HEAT_THRESHOLD_SEVERE_C`)   |

A compound note may appear when both air and heat are elevated at the same time.

### PM2.5 trajectory

| Item    | Detail                                                                      |
| ------- | --------------------------------------------------------------------------- |
| Display | About **90% of current PM2.5** (`round(current × 0.9)`)                     |
| Meaning | A simple visual scalar — **not** a forecast and **not** observed trend data |

---

## What triggers email / SMS to registered users

**Important:** refreshing the dashboard does **not** send messages. Outbound alerts are started by API / operator workflows.

### Who can receive broadcasts

A contact must typically meet all of:

- Consent given
- Verification status `verified`
- Not revoked / not pending approval
- Account active
- Coverage matches the alert city (`city` or multi-city `cities`)
- Environmental topic interest matches the hazard (`air`, `heat`, or legacy “both”)

Channels follow each contact’s preferred channels (email via Resend, SMS / WhatsApp via Twilio when configured).

### Air alerts — `POST /api/alerts/evaluate`

The server fetches / uses air quality for a city and maps PM2.5 (preferred) to a level:

| PM2.5 (µg/m³) | Server alert level |
| ------------- | ------------------ |
| ≤ 35          | LOW                |
| > 35          | MODERATE           |
| > 100         | HIGH               |
| > 150         | SEVERE             |

If PM2.5 is missing, AQI number fallbacks are used (≥101 MODERATE, ≥151 HIGH, ≥201 SEVERE).

**Dispatch gates:**

1. Level must be at least `min_level` (default **MODERATE** — LOW alone does not broadcast).
2. Cooldown per city / hazard (default **60 minutes**, `ALERT_EVAL_COOLDOWN_MINUTES`) unless `force` is set.
3. Then messages go to eligible contacts for that city / `air` topic.

### Heat alerts — `POST /api/alerts/evaluate-heat`

Same eligibility + cooldown pattern using heat effective °C tiers above. Topic filter: `heat`.

### Manual broadcast — `POST /api/alerts/broadcast`

Operator supplies city, index, and level. No live evaluate / cooldown path; eligibility still applies.

### Respiratory surge (cases)

Optional path via daily case reporting (`POST /api/health/cases/daily-report`) when env flags enable spike notify: today’s respiratory cases vs recent average (default **1.5×** with enough prior reports). Targets eligible **health_worker** contacts for that city.

### What the dashboard “Recent Alerts” list is

The **Recent Alerts** panel is a **client-side illustration** from the current city’s PM2.5 vs the dashboard threshold. It is **not** the Mongo broadcast log.

The header **Alerts** strip uses real stored broadcasts: `GET /api/alerts/latest`.

Facility-specific PM2.5 thresholds on a user profile are for account / facility UX and are **not** the evaluate/broadcast dispatch thresholds.

---

## Air Quality 24H chart

| Item            | Detail                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| What you see    | Line chart of 24 hourly-looking points                                                          |
| How it is built | Deterministic “wobble” around the **latest** PM2.5 (± about 38%), seeded by city + calendar day |
| What it is not  | Observed hourly station history                                                                 |

Use it to visualise how a day _might_ vary around the current reading. The chart caption on the page also states it is not observed hourly AQ.

---

## 5-Day Forecast

| Item        | Detail                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Source      | `GET /api/models/predict/week/{city}`                                                                                                    |
| Model input | Synthetic week case series (until DHIS2 / real case feeds are connected)                                                                 |
| UI days 1–5 | Estimated **cases** grown gently from `next_day_estimate`; **PM2.5** grown from the live PM2.5 baseline (or derived if baseline missing) |

Treat this strip as a discussion / demo forecast, not clinical prediction.

---

## Recent Alerts

Built in the browser from current PM2.5 and the dashboard threshold:

| Condition              | Row level                |
| ---------------------- | ------------------------ |
| No PM2.5               | INFO (API / config hint) |
| PM2.5 ≤ threshold      | LOW                      |
| PM2.5 > threshold      | MODERATE                 |
| PM2.5 > threshold + 35 | HIGH                     |

Extra INFO rows remind operators about facility login and that the threshold is set server-side.

For real outbound history, use admin tools / Mongo `alert_broadcasts` and the header latest-alert strip.

---

## Cases This Week

| Item      | Detail                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------- |
| Source    | `GET /api/cases/week/{city}`                                                                      |
| Generator | Synthetic seasonal pattern (`HealthDataGenerator`) — city base load × seasonality × weekday noise |
| Chart     | Bar chart of daily respiratory case counts for the week series                                    |
| Status    | Placeholder until DHIS2 / partner case feeds are wired                                            |

This series also feeds the **Scenario A** baseline (average daily cases).

---

## Scenario A · Stress sandbox

Illustrative only. Moving the sliders does **not** call APIs, does **not** change live readings, and does **not** send alerts.

### Controls

| Control                       | Range       | Meaning                                                   |
| ----------------------------- | ----------- | --------------------------------------------------------- |
| Simulated PM2.5 burden        | 5–320 µg/m³ | Dialled pollution stress                                  |
| Simulated heat (effective °C) | 22–46 °C    | Dialled heat stress                                       |
| **Use live readings**         | button      | Snaps both sliders to the latest dashboard PM2.5 and heat |

### What happens when you drag the sliders

1. **Pollution multiplier** rises as dialled PM2.5 moves above a low reference (~12 µg/m³).
2. **Heat multiplier** rises as dialled effective °C moves above a mild reference (~26 °C).
3. **Combined multiplier** = pollution × heat.
4. That combined factor is applied to the city’s **synthetic average daily cases** from Cases This Week.
5. Outputs update live:
   - Baseline avg / day
   - Load index 0–100 (composite of dialled air + heat strain)
   - Pollution / heat / combined multipliers
   - Illustrative daily cases and 7-day scale, plus delta vs the synthetic week total

Use this for “what if pollution and heat stayed this high?” conversations — not for operational forecasting.

---

## Compare cities · air snapshot

Side-by-side live air check across the eight cities.

| Behaviour     | Detail                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Selection     | Check one or more cities (no fetch until at least one is checked)                                                  |
| Fetch         | Sequential `GET /api/air-quality/current?city=…` with a short pause between cities                                 |
| Table columns | City, PM2.5, air index (WAQI AQI or EPA-style), source / confidence, vs threshold                                  |
| Vs threshold  | Below / Alert (above threshold) / High (above threshold + 35) — same bands as the dashboard Alert Level card       |
| Chart         | Bar chart of PM2.5 with a dashed threshold line; the currently selected dashboard city is highlighted when present |

---

## Quick map: panel → data character

| Panel                            | Live provider data           | Synthetic / illustrative      | Can send email/SMS by itself |
| -------------------------------- | ---------------------------- | ----------------------------- | ---------------------------- |
| Current PM2.5 / air index / heat | Yes (when APIs configured)   | —                             | No                           |
| Alert Level (card)               | Derived from live PM2.5      | Threshold from admin settings | No                           |
| PM2.5 trajectory                 | Derived from live PM2.5      | Simple ×0.9 scalar            | No                           |
| Air Quality 24H                  | Seeded by live PM2.5         | Synthetic hourly shape        | No                           |
| 5-Day Forecast                   | Optional live PM2.5 baseline | Model on synthetic cases      | No                           |
| Recent Alerts (panel)            | Live PM2.5                   | Client-built rows             | No                           |
| Cases This Week                  | —                            | Synthetic                     | No                           |
| Scenario A sandbox               | Optional “use live” seed     | Purely local math             | No                           |
| Compare cities                   | Live per city                | —                             | No                           |
| Header Alerts strip              | Latest stored broadcast      | —                             | Reflects prior sends         |
| Evaluate / broadcast APIs        | Live or operator input       | —                             | **Yes** (eligible contacts)  |

---

## Registration (`/registration`)

Registration is **optional** for browsing the dashboard and guides. It is required if you want municipality environmental alerts and (after verification / approval) facility dashboard tools.

API: `POST /api/contacts/register` → then verify with the code sent to your channels (`POST /api/contacts/verify-with-email` or the form’s verify panel).

### Required vs optional checklist

| Field                          | Required?                | Notes                                                                   |
| ------------------------------ | ------------------------ | ----------------------------------------------------------------------- |
| Full name                      | Yes                      | Display name on the account                                             |
| Email                          | Yes                      | Login identity + often verification delivery                            |
| Phone (E.164 with leading `+`) | Yes                      | SMS / WhatsApp routing; must start with `+`                             |
| WhatsApp number                | No                       | Defaults to the phone number if left blank                              |
| Dashboard password + confirm   | Yes                      | Min 8 characters; used after verification to sign in at `/users`        |
| Your role (`contact_type`)     | Yes                      | Who you are in the program                                              |
| Facility name(s)               | No on form               | Recommended for health workers / sites; used later for facility actions |
| Municipality / coverage        | Yes                      | At least one city checkbox                                              |
| Preferred language             | No                       | Defaults to English (`en`)                                              |
| Notification channels          | At least one recommended | SMS / WhatsApp / email (form defaults all on)                           |
| Environmental hazards          | Yes (client)             | At least one of Air / Heat; clearing both is blocked in the browser     |
| Consent to alerts              | Yes                      | Must be checked                                                         |
| Privacy Policy agreement       | Yes                      | Must be checked                                                         |
| Research data-use              | No                       | Optional UI checkbox; **not currently sent** by the web form to the API |

After submit you must **verify** with the code sent on your selected channels before password login works.

---

### Personal Information

| Field                  | Meaning                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **Full name**          | How you appear in admin / profile views                                                      |
| **Email**              | Unique account key; dashboard login; verification / alerts if email channel is on            |
| **Phone**              | International format with country code (e.g. `+977…`). Used for SMS and as WhatsApp fallback |
| **WhatsApp**           | Optional separate WhatsApp destination                                                       |
| **Dashboard password** | Stored hashed server-side; unlocks `/users` after verification                               |

---

### Facility Information: Roles and facility names

#### Your Role (`contact_type`) — required

| Value           | Label on form          | Why it matters                                                                                                                                                 |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health_worker` | Health Worker / Doctor | Typical clinical enrollee; may receive respiratory-surge style notices when those workflows are enabled; facility preparedness is aimed at site-linked workers |
| `parent`        | Parent / Guardian      | Family / caregiver enrollee for municipality alerts                                                                                                            |
| `admin`         | Administrator          | Program / facility admin-style enrollee                                                                                                                        |
| `government`    | Government Official    | Government stakeholder enrollee                                                                                                                                |

Role is stored on the contact and can be used when operators filter broadcasts (e.g. by `contact_type`).

#### Facility name(s) — optional but important for site work

| Item                | Detail                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What to enter       | Real workplace / clinic / hospital / ward names — **one site per line**                                                                                         |
| Why it matters      | Links your enrolment to workplaces for profile display, per-site PM2.5 thresholds, and facility preparedness actions after operator approval / facility linking |
| Optional for        | Some roles (e.g. parents) may leave this blank and still get municipality alerts                                                                                |
| Strongly useful for | Health workers and anyone who will log facility actions on `/users`                                                                                             |

Examples on the form (Kathmandu / Lalitpur hospitals, ward clinics, PHCs) are guidance only — use your real site names.

---

### Municipality / coverage area — required

Same eight Phase-1 cities as the dashboard:

Kathmandu, Lalitpur, Bhaktapur, Banepa, Dhulikhel, Hetauda, Bharatpur, Narayanghad.

| Item    | Detail                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------- |
| Meaning | Municipalities you “cover” for **readiness alerts**                                                |
| Rule    | Select **at least one**                                                                            |
| Effect  | Evaluate / broadcast targeting matches contacts whose `city` or `cities` include that municipality |

#### What appears after selecting a municipality (“name ideas”)

When you check one or more municipalities, the form loads illustrative **facility name chips** from `GET /api/cities` → `facility_presets_by_city` (`backend/facility_presets.py`).

| Behaviour       | Detail                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| When shown      | After at least one coverage city is checked **and** that city has presets                         |
| What they are   | Example hospital / clinic / ward names for that city (e.g. TUTH for Kathmandu, PAHS for Lalitpur) |
| What a tap does | Appends that name as a new line in **Facility name(s)** (skips duplicates)                        |
| Authority       | **Illustrative only** — not an official directory; edit or replace freely                         |

Unchecking all cities hides the suggestion panel again.

---

### Preferred Language

| Value | Meaning           |
| ----- | ----------------- |
| `en`  | English (default) |
| `ne`  | Nepali (नेपाली)   |

Stored on the contact as `language` for localized messaging when channel templates support it. Not required to submit (defaults to English).

---

### Notification Channels

Check how you want to receive outbound alerts:

| Channel  | Typical use                                        |
| -------- | -------------------------------------------------- |
| SMS      | Twilio SMS to `phone_number`                       |
| WhatsApp | Twilio WhatsApp to WhatsApp / phone                |
| Email    | Resend (or configured email) to registration email |

Defaults: all three checked. Verification codes are sent on the channels you selected. Later evaluate / broadcast uses the same preferred channels.

---

### Environmental hazards

Municipality-level readiness topics on the channels above:

| Topic value | Label       | Meaning                                                                        |
| ----------- | ----------- | ------------------------------------------------------------------------------ |
| `air`       | Air quality | Include this contact in **air** evaluate / broadcast pushes for covered cities |
| `heat`      | Heat        | Include this contact in **heat** evaluate / broadcast pushes                   |

| Rule              | Detail                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Form default      | Both checked                                                                                       |
| Client validation | At least one must stay checked to submit                                                           |
| Empty topics      | Would decline environmental SMS/email pushes (legacy contacts with no topics field still get both) |

Together with coverage cities, this is how the system decides **which hazards** you hear about for **which municipalities**.

---

### Consent & Preferences

| Checkbox              | Required? | Meaning                                                                                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consent to alerts** | Yes       | You agree to receive air / heat readiness alerts on the channels and topics you selected. Required for `consent_given: true` (broadcast eligibility) |
| **Privacy Policy**    | Yes       | Agree to `/privacy-policy` (GDPR / healthcare privacy framing on the form). Blocks HTML submit if unchecked                                          |
| **Research data use** | No        | Optional wording about respiratory case data for research. On the **web** form this is UI-only today (not posted in the register JSON)               |

Without alert consent + verification (+ approval rules), users will not be eligible for environmental broadcasts even if other fields are filled.

---

### What happens after Register & Verify

1. Contact is stored (pending verification).
2. A verification code is sent on selected channels.
3. User enters the code on the registration page (or API).
4. Account becomes `verified`; approval may be auto-approved or stay `pending` for partner operators.
5. User signs in at `/users` with email + password (or OTP when facility reporting is enabled).
6. Municipality alerts follow coverage + topics + channels once eligibility is met; facility action buttons need approval and facility linking as described on `/users`.

---

### Tools below the registration form

Three collapsible / helper panels sit under the main form on `/registration`.

#### Development tools — clear registration database (testing only)

Local **QA wipe** for developers — not for public users.

| Item          | Detail                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate          | Only active when `ALLOW_DEV_REGISTRATION_DB_RESET=true` in `backend/.env` **and** Uvicorn has been fully restarted                                                        |
| When disabled | Shows setup hints and the value the running process actually sees for that env var (helps catch typos / wrong file / no restart)                                          |
| When enabled  | Type the confirmation phrase exactly (`DELETE ALL CONTACTS`), optionally send `NOTIFICATION_API_KEY` if the server requires it, then **Clear contacts & consent records** |
| Effect        | `POST /api/contacts/dev/reset-registration-test-data` deletes **all** Mongo documents in `contacts` and `consent_records` so the same email can register again            |
| Safety        | Never enable on a public or production host; turn the flag off when finished testing                                                                                      |

Availability check: `GET /api/contacts/dev/reset-registration-available`.

#### Enter your verification code

Finishes signup after a successful **Register & Verify**.

| Item                 | Detail                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Purpose              | Submit the one-time code so `verification_status` becomes `verified`                                                   |
| Same code everywhere | Email, SMS, and WhatsApp carry the **same** code when those channels are selected and working                          |
| Recommended input    | Registration **email** + code → `POST /api/contacts/verify-with-email`                                                 |
| Alternate input      | Mongo **reference ID** (contact id from the success box / sessionStorage) + code → `POST /api/contacts/verify`         |
| After success        | Sign in at `/users` (or account flows linked from the dashboard) with the **same email and password** used on the form |

The page may pre-fill email / reference ID from `sessionStorage` keys set right after register (`ew_reg_email`, `ew_reg_contact_id`).

#### Didn’t receive the verification email?

**Resend** helper when the code did not arrive (especially by email).

| Item                   | Detail                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action                 | Enter the registration email and request another code → `POST /api/contacts/resend-verification`                                                                  |
| Tips shown on the form | Check spam/junk; confirm **Email** is selected under channels; ensure mail is configured (`SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` or your deployed mail stack) |
| Other channels         | SMS / WhatsApp can deliver the same code when those providers work — this panel is mainly for the email path                                                      |
| Rate limit             | Server may return HTTP 429 if you request too soon                                                                                                                |

---

### Registrant directory (`/registration/contacts-directory`)

Passphrase-protected **operator / coordinator viewer** of everyone who registered. Linked from the bottom of `/registration` as “View registrant list”.

It is **not** part of public signup. Ordinary registrants do not need this page. Use it to review enrolments (name, email, coverage, verification, approval) without opening the full Admin console.

| Item               | Detail                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who it is for      | Trusted operators who know `REGISTRATION_DIRECTORY_SECRET` from `backend/.env`                                                                                                             |
| Auth               | Enter that shared passphrase → **Load list**. Sent as `X-Registration-Directory-Secret` (and Bearer) to `GET /api/contacts/directory`                                                      |
| If secret unset    | API returns 404; the page reports that the directory feature is not configured                                                                                                             |
| What you see       | Table of contacts (up to 5000, newest first): name, email, phone, WhatsApp, role type, environmental topics, coverage municipalities, facility names, verification status, approval status |
| Phone privacy      | Numbers are **masked** by default (last four digits). Check **Show full phone / WhatsApp numbers** only on a trusted device (`unmasked_phones=true`)                                       |
| Not shown          | Passwords, verification codes, facility login OTPs (stripped server-side)                                                                                                                  |
| Passphrase storage | The page does **not** store the passphrase in the browser after load                                                                                                                       |

Compared with Admin:

- Directory = quick shared-list view behind one passphrase.
- Admin dashboard = broader operator tools (approvals, settings, etc.), often behind a different PIN / API key.

---

## Signed-in Users page (`/users`)

After registration and verification, sign in on **`/users`** with the same **email + password** (or OTP when facility reporting is enabled). New panels unlock for your account.

Preparedness buttons and the facility audit trail need more than password login alone: the account must be **verified**, **operator-approved**, and linked to a **facility / site** (admin). The banner under Facility Actions explains when actions stay locked.

---

### Facility Actions

Central place to sign in, manage sites you cover, set per-site PM2.5 lines, log preparedness steps, and see your recent facility audit entries.

#### Add facility

| Item         | Detail                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| What it does | Appends a facility / site name to your enrolment (`PATCH /api/auth/preferences` with `add_facility_name`) |
| Why          | Each named site gets its own card for a PM2.5 threshold and preparedness buttons                          |
| Tip          | Use real workplace names (same idea as registration facility lines). You can add more than one            |

#### PM2.5 alert (µg/m³) per facility

| Item        | Detail                                                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is  | Optional number (about 5–600) stored per site name in `facility_site_pm25_thresholds`                                                                                                                                             |
| How to save | Edit the field on each site card → **Save PM2.5 thresholds**                                                                                                                                                                      |
| Meaning     | Your personal / site-level line for when that workplace should treat air as elevated                                                                                                                                              |
| Important   | This is **not** what drives municipality email/SMS evaluate broadcasts. Those use the server evaluate thresholds and your coverage cities / topics. Per-site lines are for account / facility UX and future site-specific tooling |

#### Preparedness buttons (per facility card)

Each requires an approved, facility-linked session. Pressing a button posts to `POST /api/action-log` with that site, then shows up in the audit list (`GET /api/action-log/me`). Optional Polygon anchoring may run when on-chain logging is enabled.

| Button           | Internal `action_type` | What it records                                                                                                            |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Stocked O₂**   | `stocked_oxygen`       | You confirmed oxygen stock / cylinders readiness for that site (audit text: “Stocked O₂ cylinders”)                        |
| **Staff Called** | `staff_called`         | You confirmed pediatric / surge staff were briefed or called (audit text: “Pediatric staff briefed”)                       |
| **Protocol OK**  | `protocol_reviewed`    | You confirmed rapid triage / escalation protocol was reviewed for that site (audit text: “Rapid triage protocol reviewed”) |

These are **operational check-offs** for facility preparedness during poor air / surge readiness — not automatic alerts to the public. Operators can review the same action logs in Admin activity views.

Below the cards, **Facility action history** lists your recent Mongo-backed audit rows for the linked facility.

---

### Notifications sent to you

Inbox of **outbound delivery attempts** the server logged for your contact (`GET /api/auth/notification-inbox` → `notification_logs`).

| Item         | Detail                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| What appears | SMS, WhatsApp, and email attempts (alert broadcasts, verification, OTPs, etc.) with channel, status, time, and message text when stored |
| Refresh      | Reloads a short preview                                                                                                                 |
| Show more    | Opens a modal with a longer list                                                                                                        |
| Use          | Confirm whether the system tried to reach you when a phone/email seemed quiet                                                           |

This is delivery history **to you**, not the friends-and-family send tool.

---

### Friends & family alerts

Your private list of people you may message in an emergency — **you** initiate sends; they are not auto-subscribed to municipality evaluate broadcasts.

| Item       | Detail                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Add / edit | Display name + channel (SMS / WhatsApp / email) + E.164 phone or email                                                         |
| Limits     | Cap on saved contacts (`SHARED_ALERT_CONTACTS_MAX`, default 50) and daily sends (`SHARED_ALERT_NOTIFY_DAILY_MAX`, default 100) |
| Send       | Pick contacts, write a short message, confirm they agreed to receive this one-off message, then **Send to selected**           |
| Consent    | Checkbox required: you affirm each selected person agreed to be contacted via this app                                         |
| Rate limit | Server enforces the daily max; excess returns an error                                                                         |

APIs under `/api/auth/shared-contacts` and the shared-notify send endpoint (signed-in session).

---

### Notification channels

Update how the program may reach **you** for alerts (same options as registration).

| Item    | Detail                                                                                     |
| ------- | ------------------------------------------------------------------------------------------ |
| Options | SMS, WhatsApp, Email — at least one required to save                                       |
| Save    | Writes `preferred_channels` via preferences patch                                          |
| Effect  | Future evaluate / broadcast / verification-style sends use these channels for your contact |

Does not change friends-and-family destinations; those are separate.

---

### Delete account

Self-serve permanent removal of your registration and personal data.

| Item         | Detail                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Where        | Bottom of `/users` (also public page `/delete-account`)                                                                 |
| Requirements | Signed in with **email + password** (not OTP-only session); type current password; type **DELETE** to confirm           |
| API          | `POST /api/auth/delete-account`                                                                                         |
| Effect       | Deletes the contact and related personal records; anonymizes facility `action_logs` so they are no longer linked to you |
| Warning      | Irreversible. You can register again later with the same email if needed                                                |

---

### My registration (related)

Read-only profile dump after sign-in: coverage cities, channels, verification, approval, facility linkage, and whether facility reporting is ready. Use **Refresh my details** to reload from `GET /api/auth/profile`.

---

## Operator console (`/admin/dashboard`)

PIN-locked **operator / partner console** for running the early-warning programme — not for public registrants.

Use it to manage enrollees, set the public dashboard PM2.5 alert line, check integrations, review preparedness logs, read private partner docs, and operate optional Polygon / blockchain tooling.

### Who it is for and how you unlock

| Item       | Detail                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience   | Programme operators, IT counterparts, trusted partners                                                                                                                          |
| Unlock     | Enter the **Operator PIN** on the overlay → **Unlock**                                                                                                                          |
| PIN source | Prefer `ADMIN_CONSOLE_PIN` in `backend/.env`; if unset, falls back to `REGISTRATION_DIRECTORY_SECRET`; otherwise a local dev default may apply                                  |
| Session    | Successful unlock creates an **HttpOnly cookie** backed by a MongoDB row in `operator_console_sessions` (hashed token). Incorrect attempts are rate-limited                     |
| Lock       | **Lock (PIN)** revokes the server session and clears the cookie                                                                                                                 |
| Automation | Scripts can still call admin APIs with `Authorization: Bearer <NOTIFICATION_API_KEY>` when that key is configured — the browser console does not store that key in localStorage |

Ordinary users should use `/registration` and `/users`. The registrant directory (`/registration/contacts-directory`) is a lighter passphrase list view; Admin is the fuller console.

---

### Settings — dashboard display

| Control                                | Where stored                                   | Effect                                                                                                     |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Dark / light theme                     | This browser (`localStorage`)                  | Affects how the public dashboard looks on this workstation                                                 |
| Auto-refresh (30 min)                  | This browser                                   | Whether the public dashboard auto-refreshes data on this workstation                                       |
| **Dashboard PM2.5 alert line (µg/m³)** | **MongoDB** (via admin dashboard-settings API) | Shared threshold for everyone’s public dashboard Alert Level / Recent Alerts / compare bands (default 150) |

Changing the Mongo threshold updates the live dashboard for all visitors after they reload / pick up runtime config — it does **not** by itself send SMS/email.

---

### Guides and private documentation

| Section                                     | Purpose                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guides — help for operators**             | Links to the public `/guides` hub and the public registration form                                                                                                                 |
| **Private documentation (`docs-private/`)** | Partner-restricted Markdown (strategy / UNICEF-style material) that is **not** on the public Guides page. Requires an unlocked operator session; refresh list → pick a file → Open |

---

### Polygon — network, signer, anchors

Optional blockchain operations for demonstration / audit.

| Capability               | Purpose                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Network buttons          | Switch this API process to Amoy testnet, mainnet, or follow `.env` only (`PATCH /api/admin/blockchain/runtime-network`). Runtime switch is lost on restart unless mirrored in `.env` |
| Refresh overview         | Read-only view of network, signer address, balance / config hints                                                                                                                    |
| Send test on-chain touch | Smoke test that spends gas (test POL on Amoy; **real POL** on mainnet)                                                                                                               |
| Load recent anchors      | Browse recent on-chain / anchor log rows tied to facility actions                                                                                                                    |
| Submit outcome anchor    | Record a day of respiratory / severe case outcomes against a facility ID for ledger-style logging                                                                                    |

Turn off or harden these flows in production if you do not intend live chain spend.

---

### Registered enrollees (health workers & subscribers)

Main CRM-style table of everyone in Mongo `contacts`.

| Capability            | Purpose                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reload / filter       | List active or archived rows; filter by email; paginate with skip; optionally unmask phones                                                                                    |
| **Add new enrollee**  | Operator-created account (same fields family as public registration: name, email, phone, password, role, facilities, cities, channels, topics) with optional verification send |
| **Sites / area**      | Edit facility names, optional internal `facility_id`, and municipality coverage for alert targeting                                                                            |
| **Resend verify**     | When status is pending — send a fresh verification code on their preferred channels                                                                                            |
| **Archive / Restore** | Soft-deactivate or reactivate an enrollee (`active` flag)                                                                                                                      |
| **Password**          | Operator-assisted password reset for that contact                                                                                                                              |
| **Delete**            | Permanent removal of that enrollee (destructive)                                                                                                                               |

This is how operators fix coverage, unlock facility reporting linkage (`facility_id` / names), and support people who cannot finish self-serve verification.

Compared with `/registration/contacts-directory`: Admin can create, edit, archive, reset passwords, and delete; the directory is a passphrase-protected **read-mostly** list.

---

### MongoDB + integrations status

Read-only health panel (`GET /api/admin/system-status` style refresh):

- Whether MongoDB is connected (enrollee profiles, action logs, broadcasts, consent, sessions live here).
- Whether integrations look **configured** (not secret values): email (SendGrid), SMS/WhatsApp (Twilio), air-quality keys, Polygon wallet, DHIS hooks, etc.

Use after `.env` changes (usually requires API restart) to confirm what is plugged in. Footer pills also summarise Mongo / Weather connectivity.

---

### Activity overview (past 24 hours)

Coarse **pulse counters** since yesterday: enrolments, verifications, preparedness actions logged, outbound notification attempts. Use **Load activity** to spot bursts or drops — not a full analytics suite.

---

### Recent facility preparedness logs

Newest-first sample of facility **action logs** (Stocked O₂ / Staff Called / Protocol OK and related rows staff submitted from `/users`). Helps operators audit that sites are acknowledging readiness steps. **Load last 30 logs** for a quick investigation snapshot.

---

### What Admin is not

- It is **not** the public air-quality dashboard (that is `/dashboard`).
- It does **not** replace evaluate/broadcast cron or API workers — operators still use APIs / automation with `NOTIFICATION_API_KEY` for outbound alerts when configured.
- Theme / auto-refresh toggles here affect **this browser’s** dashboard prefs; only the PM2.5 threshold is global via Mongo.

---

## Conclusion — what this system is really about

### In one paragraph

The Climate Compass is a **Nepal-focused respiratory / environmental readiness platform**. It combines a **public situational dashboard** (live air and heat where APIs are configured, plus illustrative case and forecast views), **optional registration** so people can receive municipality air/heat alerts on SMS, WhatsApp, or email, and a **signed-in facility layer** so approved health workers can log preparedness steps at named sites. Operators run enrolment, thresholds, and audits from a **PIN-locked admin console**. Blockchain hooks are optional demonstration / audit tooling — not the core product.

### What problem it addresses

| Need                                              | How the app responds                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| See air / heat pressure by municipality           | Public `/dashboard` for eight Phase-1 cities                                                        |
| Warn people before respiratory load rises         | Register → verify → eligible contacts get evaluate/broadcast messages on chosen channels and topics |
| Prove clinics took readiness steps                | Signed-in facility action log (O₂ / staff / protocol) for approved, site-linked accounts            |
| Operate the programme without raw database access | Admin console + optional registrant directory                                                       |

### Who gets what (honest split)

| Audience                             | What they really get                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anyone (no account)**              | Full dashboard exploration, guides, aqiHelp (when configured), public registration and privacy pages. No personal alert inbox or facility buttons.                                                                                                                        |
| **Registered + verified subscriber** | Municipality **air / heat** alerts on preferred channels for selected coverage cities (when operators/APIs run evaluate or broadcast). Sign-in on `/users` for profile, channel prefs, notification delivery history, friends-and-family messaging, and account deletion. |
| **Approved facility reporter**       | Everything above, plus **unlocked** preparedness buttons and a Mongo audit trail per site — only after operator approval and facility linking. OTP facility login is gated the same way.                                                                                  |
| **Operator / partner**               | Admin console: enrollee CRM, global dashboard PM2.5 line, integration status, activity and preparedness logs, private docs, optional Polygon tools. Directory page for a lighter passphrase-protected list.                                                               |

### What logged-in users really get on `/users`

After email + password (or eligible OTP) sign-in, the meaningful capabilities are:

1. **See and manage enrolment context** — profile, coverage, whether facility reporting is ready.
2. **Add sites and optional per-site PM2.5 lines** — workplace labels for your account (per-site lines do **not** drive municipality broadcast evaluate).
3. **Log preparedness** (if approved + facility-linked) — Stocked O₂, Staff Called, Protocol OK → facility action history.
4. **Read “Notifications sent to you”** — server delivery attempts (broadcasts, codes, etc.).
5. **Friends & family** — your own one-off emergency messages to people you saved (consent + rate limits), not the municipal alert list.
6. **Change notification channels** and **delete the account** (password session).

Without approval / facility link, login still works for inbox, channels, friends & family, and profile — but preparedness buttons stay locked.

### What is live vs illustrative today

| More “real” when configured                           | Often synthetic / illustrative                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Live PM2.5 and heat from WeatherAPI / WAQI / Rapid    | Cases This Week generator                                        |
| Outbound SMS / WhatsApp / email via Twilio / SendGrid | Air Quality 24H chart (wobble around latest reading)             |
| Registration, verify, admin enrollee management       | 5-Day Forecast strip (model on synthetic week)                   |
| Facility action logs in Mongo                         | Scenario A stress sandbox (local sliders only)                   |
| Dashboard Alert Level vs admin Mongo threshold        | Dashboard “Recent Alerts” list (client-built from current PM2.5) |

Refreshing the dashboard **never** sends alerts by itself. Real pushes need evaluate / broadcast / related APIs (and eligible contacts).

### How the pieces fit together

```text
Public dashboard  →  situation awareness (air, heat, demos)
        │
Registration      →  who you are, where you cover, how to reach you
        │
Verify + approve  →  eligible for municipal alerts; facility tools if linked
        │
Users (/users)    →  personal inbox, channels, F&F, site preparedness log
        │
Admin console     →  run the programme (people, threshold, audits, private docs)
```

### Bottom line

This system is **not** primarily a consumer “AQI app.” It is an **early-warning and facility-readiness workflow**: watch municipalities, enrol people into hazard alerts, and let approved sites record that they stocked oxygen, briefed staff, and reviewed protocol — with operators governing the network. Treat synthetic case/forecast/sandbox panels as training and discussion aids until DHIS2 / partner case feeds and full operational alerting are wired for your deployment.

---

## Related code and docs

| Area                            | Location                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| Dashboard UI                    | `landing/templates/fragments/dashboard_body.html`          |
| Registration UI                 | `landing/templates/fragments/registration_body.html`       |
| Registrant directory UI         | `landing/templates/fragments/contacts_directory_body.html` |
| Users / account UI              | `landing/templates/fragments/users_body.html`              |
| Users page scripts              | `frontend/user-account.js`                                 |
| Admin / operator console UI     | `landing/templates/fragments/admin_body.html`              |
| Admin API routes                | `backend/admin_panel.py`                                   |
| Facility name presets           | `backend/facility_presets.py`                              |
| City list                       | `backend/cities_config.py`                                 |
| Register / verify / evaluate    | `backend/notifications_api.py`                             |
| Air / heat / cases / cities API | `backend/main.py`                                          |
| Implementation snapshot         | [IMPLEMENTATION_SNAPSHOT.md](IMPLEMENTATION_SNAPSHOT.md)   |
| App overview                    | [APPLICATION_OVERVIEW.md](APPLICATION_OVERVIEW.md)         |

Rendered in the guides browser (when the server is up): `/guides/md/DASHBOARD_FEATURES.md`.
