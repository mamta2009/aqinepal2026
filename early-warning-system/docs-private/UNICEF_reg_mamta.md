# UNICEF registration workbook — Mamta Sonwalkar track

**Status:** Draft — internal only (not served on the public demo site).

**Purpose:** Single place to collect answers, narratives, and evidence for UNICEF-related registration or programme submissions **without tying them to runnable product code.** Update dates and facts as commitments become real.

---

## 1. Identity & coordination

| Field | Notes |
|--------|------|
| Primary contact | Mamta Sonwalkar |
| Role / title | _(e.g. product lead, technical lead)_ |
| Email |  |
| Phone / Signal / etc. |  |
| Organisation | _(legal entity submitting or backing the work — e.g. intellADAPT / Edwise Tech as applicable)_ |
| Co-applicants / partners | _(ministry adjacency, UNICEF CO, NGOs — list)_ |
| Time zone |  |

---

## 2. Programme / vehicle

**Which UNICEF mechanism is this aimed at?** _(tick one primary; duplicate section if parallel tracks)_

- [ ] UNICEF Venture Fund (or successor innovation window)
- [ ] Country office innovation / partnership pathway
- [ ] Other: _________________________________

**Target round / intake / deadline:**

- Reference link (official): 
- Hard deadline date: 

**Internal owner for submission:** Mamta Sonwalkar (+ named backup):

---

## 3. Problem & geography (truthful baseline)

Describe the **public-health / climate–health coordination** problem in **Nepal Bagmati** (or revised geography) **as you would defend it to an evaluator** — aspirations vs what is validated today:

- Population / geography in scope:
- Existing data pipelines (DHIS2, AQ, meteorology — what is actually connected vs planned):
- What the **current demo proves** vs what requires a **governed rollout with partners**

---

## 4. Solution summary (architecture in words — no code)

**One paragraph** describing the prototype: APIs, synthetic vs real data, optional verification hooks, optional blockchain anchoring philosophy, dashboards.

Attach or cross-reference diagrams from the repo **as figures** only (do not imply code = validation):

- `docs/tech/early_warning_platform_architecture.svg`
- `docs/tech/fastapi_mongodb_render_architecture.svg`
- `docs/tech/simple_frontend_architecture.svg`

---

## 5. Open source, blockchain, AI — claims you can evidence

Use **only** statements you can back with repository, deployment, or written methodology.

| Pillar | Honest current state | Evidence to attach / link |
|--------|----------------------|---------------------------|
| Open source | MIT / GitHub URL / license file |  |
| Blockchain | Cryptographic verification vs optional on-chain txs; testnet vs mainnet |  |
| AI | Which models run in production; validation status (or “not yet validated on partner data”) |  |

**Red lines:** Do not copy aspirational numbers from internal strategy packs into official forms unless approved and measured.

---

## 6. Data, privacy & child rights

- Personal data handled today: _(yes / no — what classes)_
- Data residency / UNICEF DPIA alignment: _(status)_ 
- UNICEF GIS / safeguarding expectations: _(checklist)_ 
- linkage to external **Privacy** / **Terms** stubs if appropriate for web demo only

---

## 7. Deployment & sustainability

| Topic | Answer |
|--------|--------|
| Current hosting sketch (e.g. Render + Mongo Atlas) |  |
| Estimated run cost band |  |
| Hand-off / open-source stewardship after funding |  |
| Local capacity (Nepal) for operations |  |

---

## 8. Budget & milestones (high level)

- Phase 1 (months): outcomes + budget band:
- Phase 2:  
- Key risks & mitigations:

---

## 9. Mandatory attachments checklist

Use the **official UNICEF checklist** for your vehicle; map files here:

- [ ] Executive summary  
- [ ] Technical annex (diagrams OK, no inflated metrics)  
- [ ] Letters of intent / partnership (if required)  
- [ ] Ethics / data use (template or CO sign-off if required)  
- [ ] Team CVs  
- [ ] Pitch / video (spec from call)  

**File naming convention:** keep `UNICEF_reg_mamta` materials in `docs-private/` or a sibling folder that is **not** web-mounted.

---

## 10. Technical repository baseline (for accurate filings)

Use this checklist when describing the **live demo** versus **aspirations**:

- **Canonical spec:** `early-warning-system/docs/guides/IMPLEMENTATION_SNAPSHOT.md` (resolver: WeatherAPI direct → WAQI → Rapid for `/api/air-quality/current`; provenance field **`deployment_role`**; OpenWeather routes are supplementary; **`DEPLOYMENT_MODE`** default **REGIONAL**).
- **Synthetic health data:** Weekly case generator is not DHIS2-derived until you wire ETL (see `DHIS2_*` + `/api/dhis2/system-check`).
- **AI forecast strip:** `GET /api/models/predict/week/{city}` uses `ai_models` on synthetic weekly input — clarify validation status.

Do not cite this workbook as implying ministry-validated denominators unless you have separate evidence.

---

## 11. Version log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | _(fill)_ | Mamta Sonwalkar | Initial workbook |

---

## 12. Cross-reference

- Detailed strategy checklist (internal): `UNICEF_REQUIREMENTS_STRATEGY.md` in this folder — **do not** paste unreviewed wording into registrations without aligning to evidence.
