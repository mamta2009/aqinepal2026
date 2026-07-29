/**
 * Users page (/users) — sign-in, facilities, per-site actions, thresholds, channels, notification log.
 */
(function () {
  "use strict";

  let API_ROOT = "";
  let API_BASE = "/api";
  const FACILITY_TOKEN_KEY = "facility_access_token";
  const FACILITY_CLAIMS_KEY = "facility_claims_preview";
  const FACILITY_REPORTING_READY_KEY = "ew_facility_reporting_ready";

  /** @type {Record<string, unknown>|null} */
  let lastProfile = null;

  /** @type {Array<Record<string, unknown>>|null} */
  let lastSharedContacts = null;

  async function initRuntimeConfig() {
    const fileMode = window.location.protocol === "file:";
    const defaultOrigin = fileMode
      ? "http://localhost:8000"
      : `${window.location.protocol}//${window.location.host}`;
    const configUrl = fileMode
      ? `${defaultOrigin}/api/runtime-config`
      : "/api/runtime-config";
    try {
      const r = await fetch(configUrl);
      const j = await r.json();
      const originCfg =
        j.public_api_origin && String(j.public_api_origin).trim()
          ? String(j.public_api_origin).replace(/\/$/, "")
          : defaultOrigin;
      let prefix =
        (j.api_path_prefix && String(j.api_path_prefix).trim()) || "/api";
      if (!prefix.startsWith("/")) prefix = "/" + prefix;
      API_ROOT = originCfg;
      API_BASE = `${originCfg}${prefix}`;
    } catch {
      API_ROOT = defaultOrigin;
      API_BASE = `${defaultOrigin}/api`;
    }
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/\n/g, " ");
  }

  function getFacilityBearer() {
    return sessionStorage.getItem(FACILITY_TOKEN_KEY);
  }

  function clearFacilityReportingSession() {
    sessionStorage.removeItem(FACILITY_TOKEN_KEY);
    sessionStorage.removeItem(FACILITY_CLAIMS_KEY);
    sessionStorage.removeItem(FACILITY_REPORTING_READY_KEY);
  }

  function facilityReportingReadyStored() {
    return sessionStorage.getItem(FACILITY_REPORTING_READY_KEY) === "1";
  }

  function _escapeProfileHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function _formatEnvTopics(tp) {
    if (Array.isArray(tp)) return tp.length ? tp.join(", ") : "—";
    if (tp == null || tp === "") return "Air & heat (default)";
    return String(tp);
  }

  function siteLabelsFromProfile(j) {
    if (Array.isArray(j.facility_names) && j.facility_names.length) {
      return j.facility_names.map((x) => String(x).trim()).filter(Boolean);
    }
    const s = (j.facility_name && String(j.facility_name).trim()) || "";
    if (!s) return [];
    if (s.includes("·"))
      return s
        .split("·")
        .map((x) => x.trim())
        .filter(Boolean);
    return [s];
  }

  function renderSitesYouCover(j) {
    const el = document.getElementById("sitesYouCoverStrip");
    if (!el) return;
    const sites = siteLabelsFromProfile(j || {});
    if (!sites.length) {
      el.innerHTML =
        '<p style="margin:6px 0 0;font-size:0.78rem;color:var(--text-tertiary);">' +
        "<strong>Sites on your enrolment:</strong> none yet — use <strong>Add facility</strong> above (or ask your administrator).</p>";
      return;
    }
    el.innerHTML =
      '<p style="margin:6px 0 4px;font-size:0.78rem;color:var(--text-secondary);"><strong>Sites on your enrolment</strong> (' +
      sites.length +
      ')</p><ul style="margin:0;padding-left:1.15rem;line-height:1.65;font-size:0.82rem;">' +
      sites.map((s) => `<li>${_escapeProfileHtml(s)}</li>`).join("") +
      "</ul>";
  }

  function _renderUserProfileHtml(j) {
    const cov =
      Array.isArray(j.cities) && j.cities.length
        ? j.cities.join(", ")
        : j.city || "—";
    const chans = Array.isArray(j.preferred_channels)
      ? j.preferred_channels.join(", ")
      : "—";
    const facOk = j.facility_reporting_ready
      ? "Yes — you can log facility actions"
      : "Not yet (needs approval + facility on file)";
    const sites = siteLabelsFromProfile(j);
    const siteLine = sites.length ? sites.join(" · ") : "—";
    const rows = [
      ["Name", j.name || "—"],
      ["Email", j.email || "—"],
      ["Phone", j.phone_number || "—"],
      ["WhatsApp", j.whatsapp_number || "—"],
      ["Role", j.contact_type || "—"],
      ["Coverage areas", cov],
      ["Registered facilities", siteLine],
      ["Alert channels", chans],
      ["Environmental topics", _formatEnvTopics(j.environmental_topics)],
      ["Language", j.language || "—"],
      ["Verification", j.verification_status || "—"],
      [
        "Partner approval",
        j.approval_status != null ? String(j.approval_status) : "—",
      ],
      [
        "Account active",
        j.active === false ? "Archived — contact support" : "Active",
      ],
      ["Facility reporting", facOk],
      ["Facility ID (scope)", (j.facility_id && String(j.facility_id)) || "—"],
      ["Contact reference ID", j._id || "—"],
    ];
    const parts = rows.map(
      ([k, v]) =>
        `<dt>${_escapeProfileHtml(k)}</dt><dd>${_escapeProfileHtml(String(v))}</dd>`,
    );
    return `<dl>${parts.join("")}</dl>`;
  }

  function renderFacilitiesAndPrefs(j) {
    lastProfile = j;
    renderSitesYouCover(j);
    const root = document.getElementById("facilitiesRoot");
    const saveTh = document.getElementById("saveThresholdsBtn");
    if (!root) return;

    const sites = siteLabelsFromProfile(j);
    const thMap =
      j.facility_site_pm25_thresholds &&
      typeof j.facility_site_pm25_thresholds === "object"
        ? j.facility_site_pm25_thresholds
        : {};

    if (!sites.length) {
      root.innerHTML =
        '<p style="margin:8px 0;font-size:0.82rem;color:var(--text-secondary);">No facilities on file yet — use <strong>Add facility</strong> above, or ask your administrator.</p>';
      if (saveTh) saveTh.style.display = "none";
      return;
    }

    const cards = sites
      .map((site) => {
        const sEsc = escapeAttr(site);
        const thVal =
          thMap[site] != null && !Number.isNaN(Number(thMap[site]))
            ? String(thMap[site])
            : "";
        return `
<div class="facility-site-card" style="margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(0,0,0,0.15);">
  <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;color:var(--accent);">${_escapeProfileHtml(site)}</div>
  <div class="facility-auth-row" style="flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
    <label style="font-size:0.78rem;color:var(--text-secondary);">PM2.5 alert (µg/m³)</label>
    <input type="number" min="5" max="600" step="1" class="fac-threshold-in" data-site="${sEsc}" value="${thVal ? escapeAttr(thVal) : ""}" placeholder="e.g. 55" style="width:100px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-dark);color:var(--text);" />
  </div>
  <div class="action-buttons" style="display:flex;flex-wrap:wrap;gap:8px;">
    <button class="action-btn action-btn-reporting fac-action-btn" type="button" data-action-key="stocked_oxygen" data-facility-site="${sEsc}">Stocked O₂</button>
    <button class="action-btn action-btn-reporting fac-action-btn" type="button" data-action-key="staff_called" data-facility-site="${sEsc}">Staff Called</button>
    <button class="action-btn action-btn-reporting fac-action-btn" type="button" data-action-key="protocol_reviewed" data-facility-site="${sEsc}">Protocol OK</button>
  </div>
</div>`;
      })
      .join("");
    root.innerHTML = cards;
    if (saveTh) saveTh.style.display = sites.length ? "inline-block" : "none";
  }

  function showChannelForm(visible, j) {
    const form = document.getElementById("channelPrefsForm");
    const hint = document.getElementById("channelPrefsSignin");
    const sms = document.getElementById("prefSms");
    const wa = document.getElementById("prefWhatsapp");
    const em = document.getElementById("prefEmail");
    if (!form || !hint) return;
    if (visible && j) {
      form.style.display = "block";
      hint.style.display = "none";
      const ch = Array.isArray(j.preferred_channels)
        ? j.preferred_channels.map(String)
        : [];
      if (sms) sms.checked = ch.includes("sms");
      if (wa) wa.checked = ch.includes("whatsapp");
      if (em) em.checked = ch.includes("email");
    } else {
      form.style.display = "none";
      hint.style.display = "block";
    }
  }

  async function refreshUserRegistrationProfile() {
    const wrap = document.getElementById("userProfileBody");
    if (!wrap) return;
    const tok = getFacilityBearer();
    if (!tok) {
      sessionStorage.removeItem(FACILITY_REPORTING_READY_KEY);
      wrap.innerHTML =
        '<div class="user-profile-empty">Not signed in — use <strong>email + password or OTP</strong> above.</div>';
      renderFacilitiesAndPrefs({ facility_names: [] });
      refreshSharedContacts().catch(() => {});
      showChannelForm(false, null);
      syncFacilityReportingChrome();
      return;
    }
    wrap.innerHTML =
      '<div class="user-profile-empty">Loading your registration…</div>';
    try {
      const r = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem(FACILITY_REPORTING_READY_KEY);
        wrap.innerHTML = `<div class="user-profile-empty">${_escapeProfileHtml(
          typeof j.detail === "string"
            ? j.detail
            : "Could not load profile — sign in again.",
        )}</div>`;
        syncFacilityReportingChrome();
        return;
      }
      if (!r.ok) {
        wrap.innerHTML =
          '<div class="user-profile-empty">Could not load profile. Try Refresh or sign in again.</div>';
        syncFacilityReportingChrome();
        return;
      }
      sessionStorage.setItem(
        FACILITY_REPORTING_READY_KEY,
        j.facility_reporting_ready === true ? "1" : "0",
      );
      wrap.innerHTML = _renderUserProfileHtml(j);
      renderFacilitiesAndPrefs(j);
      showChannelForm(true, j);
      await refreshSharedContacts();
      syncFacilityReportingChrome();
    } catch (e) {
      wrap.innerHTML =
        '<div class="user-profile-empty">Network error loading profile. Check that the API is running.</div>';
      console.warn("profile:", e);
      syncFacilityReportingChrome();
    }
    syncDeleteAccountChrome();
  }

  function syncDeleteAccountChrome() {
    const form = document.getElementById("deleteAccountForm");
    const signin = document.getElementById("deleteAccountSignin");
    if (!form || !signin) return;
    const tok = getFacilityBearer();
    if (tok) {
      form.style.display = "block";
      signin.style.display = "none";
    } else {
      form.style.display = "none";
      signin.style.display = "block";
    }
  }

  async function submitDeleteAccount() {
    const pwEl = document.getElementById("deleteAccountPassword");
    const confEl = document.getElementById("deleteAccountConfirm");
    const msg = document.getElementById("deleteAccountMsg");
    const tok = getFacilityBearer();
    if (!tok) {
      if (msg) msg.textContent = "Sign in with password first.";
      return;
    }
    const password = String(pwEl && pwEl.value ? pwEl.value : "");
    const confirm = String(confEl && confEl.value ? confEl.value : "").trim();
    if (!password || confirm !== "DELETE") {
      if (msg)
        msg.textContent =
          "Enter your current password and type DELETE exactly.";
      return;
    }
    if (
      !window.confirm(
        "Permanently delete your account and personal data? This cannot be undone.",
      )
    ) {
      return;
    }
    if (msg) msg.textContent = "Deleting…";
    try {
      const r = await fetch(`${API_BASE}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({ password, confirm }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const det =
          typeof j.detail === "string"
            ? j.detail
            : JSON.stringify(j.detail || j).slice(0, 220);
        if (msg)
          msg.textContent =
            det ||
            `Delete failed (HTTP ${r.status}). If you used OTP only, sign in with password first.`;
        return;
      }
      if (pwEl) pwEl.value = "";
      if (confEl) confEl.value = "";
      if (msg) msg.textContent = j.message || "Account deleted.";
      facilitySignOutReporting();
      const wrap = document.getElementById("userProfileBody");
      if (wrap) {
        wrap.innerHTML =
          '<div class="user-profile-empty">Account deleted. You can register again with the same email if needed.</div>';
      }
      syncDeleteAccountChrome();
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
      console.warn(e);
    }
  }

  function syncFacilityReportingChrome() {
    const tok = getFacilityBearer();
    const banner = document.getElementById("facilityAuthBanner");
    const logoutBtn = document.getElementById("facilityLogoutBtn");
    const facilitiesRoot = document.getElementById("facilitiesRoot");
    const loginBlock = document.getElementById("facilityAuthLoginBlock");
    if (!banner || !facilitiesRoot || !logoutBtn || !loginBlock) return;

    if (tok) {
      logoutBtn.hidden = false;
      const ready = facilityReportingReadyStored();
      const rk = sessionStorage.getItem(FACILITY_REPORTING_READY_KEY);
      const checking = rk === null;

      if (ready) {
        facilitiesRoot.classList.remove("reporting-locked");
        loginBlock.style.display = "none";
        let claimsTxt = "";
        try {
          const raw = sessionStorage.getItem(FACILITY_CLAIMS_KEY);
          if (raw) {
            const cl = JSON.parse(raw);
            if (cl.facility_name || cl.facility_id)
              claimsTxt = `Reporting as ${cl.facility_name || "facility"} (${cl.facility_id || "—"}). `;
            if (cl.city) claimsTxt += `${cl.city}. `;
          }
        } catch (_) {
          /* ignore */
        }
        banner.textContent =
          claimsTxt + "Authenticated — log actions per facility below.";
      } else {
        facilitiesRoot.classList.add("reporting-locked");
        loginBlock.style.display = "block";
        if (checking) {
          banner.textContent =
            "Signed in — confirming whether your account can post facility actions…";
        } else {
          banner.textContent =
            "Signed in — reporting may stay locked until an operator approves and links your facility.";
        }
      }
      syncDeleteAccountChrome();
      return;
    }
    facilitiesRoot.classList.add("reporting-locked");
    logoutBtn.hidden = true;
    loginBlock.style.display = "block";
    banner.textContent =
      "Not signed in — use password or OTP, then manage facilities below.";
    syncDeleteAccountChrome();
  }

  async function refreshFacilityAuditLog() {
    const wrap = document.getElementById("action-log");
    if (!wrap) return;
    const tok = getFacilityBearer();
    if (!tok) {
      wrap.innerHTML =
        '<div style="padding: 14px;text-align:center;color:var(--text-secondary)">' +
        "Facility action history appears after sign-in (server audit).</div>";
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/action-log/me`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const rows = j.entries || [];
      if (!rows.length) {
        wrap.innerHTML =
          '<div style="padding:14px;text-align:center;color:var(--text-secondary)">' +
          "No actions logged for this account yet.</div>";
        return;
      }
      wrap.innerHTML = rows
        .slice(0, 50)
        .map((row) => {
          const ts = row.timestamp
            ? String(row.timestamp).replace("T", " ")
            : "";
          const at = escapeAttr(
            String(row.action_type || "").replace(/</g, ""),
          );
          const st = row.facility_site
            ? ` <span style="color:var(--text-tertiary);">· ${_escapeProfileHtml(
                String(row.facility_site),
              )}</span>`
            : "";
          return `<div class="action-log-item">${at}${st}<span class="action-log-time">${ts}</span></div>`;
        })
        .join("");
    } catch (err) {
      wrap.innerHTML =
        '<div style="padding:14px;text-align:center;color:#fecaca">Could not load facility audit trail.</div>';
      console.warn("Facility audit:", err);
    }
  }

  async function refreshNotificationInbox() {
    const wrap = document.getElementById("notificationInboxBody");
    const showMoreBtn = document.getElementById("notificationInboxShowMoreBtn");
    if (showMoreBtn) showMoreBtn.style.display = "none";
    if (!wrap) return;
    const tok = getFacilityBearer();
    if (!tok) {
      wrap.textContent = "Sign in to see notifications sent to you.";
      return;
    }
    const previewLimit = 5;
    wrap.textContent = "Loading…";
    try {
      const r = await fetch(
        `${API_BASE}/auth/notification-inbox?limit=${previewLimit}&skip=0`,
        {
          headers: { Authorization: `Bearer ${tok}` },
        },
      );
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        wrap.textContent = "Session expired — sign in again.";
        return;
      }
      if (!r.ok) {
        wrap.textContent =
          typeof j.detail === "string"
            ? j.detail
            : "Could not load notifications.";
        return;
      }
      const rows = j.entries || [];
      const total =
        typeof j.total === "number"
          ? j.total
          : typeof j.count === "number"
            ? j.count
            : 0;
      if (!rows.length) {
        wrap.innerHTML =
          '<p style="margin:0;color:var(--text-tertiary);">No delivery attempts logged yet.</p>';
        return;
      }
      const esc = _escapeProfileHtml;
      wrap.innerHTML =
        '<table class="tbl" style="font-size:0.76rem;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left">When</th><th>Channel</th><th>Status</th><th>Where</th><th>Content</th></tr></thead><tbody>' +
        rows
          .map((row) => {
            const when = esc(row.timestamp || "—");
            const ch = esc(row.channel || "—");
            const st = esc(row.status || "—");
            const meta =
              [row.city, row.alert_level].filter(Boolean).join(" · ") || "—";
            const body =
              row.message != null
                ? esc(String(row.message).slice(0, 1200))
                : esc(row.message_preview || row.error || "—");
            return `<tr><td style="vertical-align:top">${when}</td><td>${ch}</td><td>${st}</td><td>${esc(
              meta,
            )}</td><td style="max-width:420px;word-break:break-word;">${body}</td></tr>`;
          })
          .join("") +
        "</tbody></table>";

      if (showMoreBtn) {
        showMoreBtn.style.display = total > previewLimit ? "" : "none";
      }
    } catch (e) {
      wrap.textContent = "Network error loading notifications.";
      console.warn(e);
    }
  }

  async function openNotificationInboxModal() {
    const modal = document.getElementById("notificationInboxModal");
    const modalBody = document.getElementById("notificationInboxModalBody");
    if (!modal || !modalBody) return;
    modal.style.display = "flex";
    modalBody.textContent = "Loading…";
    const tok = getFacilityBearer();
    if (!tok) {
      modalBody.textContent = "Sign in to load notifications.";
      return;
    }
    const modalLimit = 200;
    try {
      const r = await fetch(
        `${API_BASE}/auth/notification-inbox?limit=${modalLimit}&skip=0`,
        {
          headers: { Authorization: `Bearer ${tok}` },
        },
      );
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        modalBody.textContent = "Session expired — sign in again.";
        return;
      }
      if (!r.ok) {
        modalBody.textContent =
          typeof j.detail === "string"
            ? j.detail
            : "Could not load notifications.";
        return;
      }
      const rows = j.entries || [];
      const total =
        typeof j.total === "number"
          ? j.total
          : typeof j.count === "number"
            ? j.count
            : 0;

      if (!rows.length) {
        modalBody.innerHTML =
          '<p style="margin:0;color:var(--text-tertiary);">No delivery attempts logged yet.</p>';
        return;
      }

      const esc = _escapeProfileHtml;
      const notice =
        total > modalLimit
          ? `<div style="margin-bottom:10px;font-size:0.78rem;color:var(--text-tertiary);">Showing latest ${modalLimit} of ${total} delivery attempts.</div>`
          : "";

      modalBody.innerHTML =
        notice +
        '<table class="tbl" style="font-size:0.76rem;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left">When</th><th>Channel</th><th>Status</th><th>Where</th><th>Content</th></tr></thead><tbody>' +
        rows
          .map((row) => {
            const when = esc(row.timestamp || "—");
            const ch = esc(row.channel || "—");
            const st = esc(row.status || "—");
            const meta =
              [row.city, row.alert_level].filter(Boolean).join(" · ") || "—";
            const body =
              row.message != null
                ? esc(String(row.message).slice(0, 1200))
                : esc(row.message_preview || row.error || "—");
            return `<tr><td style="vertical-align:top">${when}</td><td>${ch}</td><td>${st}</td><td>${esc(
              meta,
            )}</td><td style="max-width:420px;word-break:break-word;">${body}</td></tr>`;
          })
          .join("") +
        "</tbody></table>";
    } catch (e) {
      modalBody.textContent = "Network error loading notifications.";
      console.warn(e);
    }
  }

  function closeNotificationInboxModal() {
    const modal = document.getElementById("notificationInboxModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  function syncSharedContactChannelFields() {
    const sel = document.getElementById("sharedContactChannel");
    const ph = document.getElementById("sharedContactPhone");
    const em = document.getElementById("sharedContactEmail");
    if (!sel || !ph || !em) return;
    const ch = String(sel.value || "sms");
    if (ch === "email") {
      ph.style.display = "none";
      em.style.display = "";
      ph.removeAttribute("required");
    } else {
      ph.style.display = "";
      em.style.display = "none";
    }
  }

  function resetSharedContactForm() {
    const hid = document.getElementById("sharedContactEditId");
    const btn = document.getElementById("sharedContactSubmitBtn");
    const canc = document.getElementById("sharedContactCancelEditBtn");
    const fm = document.getElementById("sharedContactsFormMsg");
    if (hid) hid.value = "";
    if (btn) btn.textContent = "Add contact";
    if (canc) canc.style.display = "none";
    if (fm) fm.textContent = "";
    const n = document.getElementById("sharedContactDisplayName");
    const ph = document.getElementById("sharedContactPhone");
    const em = document.getElementById("sharedContactEmail");
    const sel = document.getElementById("sharedContactChannel");
    if (n) n.value = "";
    if (ph) ph.value = "";
    if (em) em.value = "";
    if (sel) sel.value = "sms";
    syncSharedContactChannelFields();
  }

  function startEditSharedContact(id) {
    const rows = lastSharedContacts || [];
    const row = rows.find((x) => String(x.id || "") === String(id));
    if (!row) return;
    const hid = document.getElementById("sharedContactEditId");
    const btn = document.getElementById("sharedContactSubmitBtn");
    const canc = document.getElementById("sharedContactCancelEditBtn");
    const n = document.getElementById("sharedContactDisplayName");
    const ph = document.getElementById("sharedContactPhone");
    const em = document.getElementById("sharedContactEmail");
    const sel = document.getElementById("sharedContactChannel");
    const fm = document.getElementById("sharedContactsFormMsg");
    if (hid) hid.value = String(id);
    if (btn) btn.textContent = "Save changes";
    if (canc) canc.style.display = "";
    if (fm) fm.textContent = "";
    if (n) n.value = String(row.display_name || "");
    if (sel) sel.value = String(row.channel || "sms");
    syncSharedContactChannelFields();
    if (ph) ph.value = row.phone_e164 != null ? String(row.phone_e164) : "";
    if (em) em.value = row.email != null ? String(row.email) : "";
    const pan = document.getElementById("sharedContactsPanel");
    if (pan && pan.scrollIntoView)
      pan.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function refreshSharedContacts() {
    const limEl = document.getElementById("sharedContactsLimitsMsg");
    const tbody = document.getElementById("sharedContactsTableBody");
    const tbl = document.getElementById("sharedContactsTable");
    const empty = document.getElementById("sharedContactsEmpty");
    const tok = getFacilityBearer();
    if (!tbody || !limEl) return;
    if (!tok) {
      lastSharedContacts = null;
      limEl.textContent = "Sign in to manage your contact list.";
      tbody.innerHTML = "";
      if (tbl) tbl.style.display = "none";
      if (empty) empty.style.display = "none";
      resetSharedContactForm();
      return;
    }
    limEl.textContent = "Loading contacts…";
    try {
      const r = await fetch(`${API_BASE}/auth/shared-contacts`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        lastSharedContacts = null;
        limEl.textContent = "Session expired — sign in again.";
        tbody.innerHTML = "";
        if (tbl) tbl.style.display = "none";
        if (empty) empty.style.display = "none";
        return;
      }
      if (!r.ok) {
        const d =
          typeof j.detail === "string"
            ? j.detail
            : `Could not load contacts (${r.status}).`;
        limEl.textContent = d;
        tbody.innerHTML = "";
        if (tbl) tbl.style.display = "none";
        if (empty) empty.style.display = "none";
        return;
      }
      const contacts = Array.isArray(j.contacts) ? j.contacts : [];
      lastSharedContacts = contacts;
      const lim = j.limits || {};
      const maxC = lim.max_contacts != null ? lim.max_contacts : "—";
      const daily =
        lim.notify_recipients_daily_max != null
          ? lim.notify_recipients_daily_max
          : "—";
      const sent =
        lim.notify_recipients_sent_today != null
          ? lim.notify_recipients_sent_today
          : 0;
      limEl.textContent = `You can store up to ${maxC} contacts. Friend/family sends: ${sent} / ${daily} recipients used today (UTC).`;

      if (!contacts.length) {
        tbody.innerHTML = "";
        if (tbl) tbl.style.display = "none";
        if (empty) {
          empty.style.display = "block";
          empty.textContent = "No saved contacts yet — add one above.";
        }
        return;
      }
      if (empty) empty.style.display = "none";
      if (tbl) tbl.style.display = "";
      const esc = _escapeProfileHtml;
      tbody.innerHTML = contacts
        .map((c) => {
          const id = String(c.id || "");
          const nm = esc(String(c.display_name || "—"));
          const ch = esc(String(c.channel || "—"));
          const dest =
            c.channel === "email"
              ? esc(String(c.email || "—"))
              : esc(String(c.phone_e164 || "—"));
          const idEsc = escapeAttr(id);
          return (
            `<tr>` +
            `<td><input type="checkbox" class="shared-contact-pick" name="pick_shared" value="${idEsc}" aria-label="Select ${nm}" /></td>` +
            `<td>${nm}</td><td>${ch}</td><td style="max-width:200px;word-break:break-all;">${dest}</td>` +
            `<td style="white-space:nowrap">` +
            `<button type="button" class="mini-btn shared-contact-edit" data-shared-id="${idEsc}">Edit</button> ` +
            `<button type="button" class="mini-btn shared-contact-del" data-shared-id="${idEsc}">Remove</button>` +
            `</td></tr>`
          );
        })
        .join("");
    } catch (e) {
      limEl.textContent = "Network error loading contacts.";
      console.warn(e);
    }
  }

  async function submitSharedContactForm() {
    const tok = getFacilityBearer();
    const msg = document.getElementById("sharedContactsFormMsg");
    const hid = document.getElementById("sharedContactEditId");
    const n = document.getElementById("sharedContactDisplayName");
    const ph = document.getElementById("sharedContactPhone");
    const em = document.getElementById("sharedContactEmail");
    const sel = document.getElementById("sharedContactChannel");
    if (!tok || !n || !sel) return;
    const editId = hid && hid.value ? String(hid.value) : "";
    const name = String(n.value || "").trim();
    const ch = String(sel.value || "sms");
    const phone = ph ? String(ph.value || "").trim() : "";
    const email = em ? String(em.value || "").trim() : "";
    if (!name) {
      if (msg) msg.textContent = "Enter a display name.";
      return;
    }
    if (msg) msg.textContent = editId ? "Saving…" : "Adding…";
    try {
      if (editId) {
        const patch = /** @type {Record<string, unknown>} */ ({
          display_name: name,
          channel: ch,
        });
        if (ch === "email") patch.email = email;
        else patch.phone_e164 = phone;
        const r = await fetch(
          `${API_BASE}/auth/shared-contacts/${encodeURIComponent(editId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${tok}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patch),
          },
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const d =
            typeof j.detail === "string"
              ? j.detail
              : JSON.stringify(j.detail || j);
          if (msg) msg.textContent = d || `HTTP ${r.status}`;
          return;
        }
        if (msg) msg.textContent = "Saved.";
        resetSharedContactForm();
      } else {
        const body =
          ch === "email"
            ? { display_name: name, channel: "email", email }
            : { display_name: name, channel: ch, phone_e164: phone };
        const r = await fetch(`${API_BASE}/auth/shared-contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const d =
            typeof j.detail === "string"
              ? j.detail
              : JSON.stringify(j.detail || j);
          if (msg) msg.textContent = d || `HTTP ${r.status}`;
          return;
        }
        if (msg) msg.textContent = "Contact added.";
        resetSharedContactForm();
      }
      await refreshSharedContacts();
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
      console.warn(e);
    }
  }

  async function deleteSharedContact(id) {
    const tok = getFacilityBearer();
    if (!tok) return;
    try {
      const r = await fetch(
        `${API_BASE}/auth/shared-contacts/${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tok}` },
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const d = typeof j.detail === "string" ? j.detail : `HTTP ${r.status}`;
        const msg = document.getElementById("sharedContactsFormMsg");
        if (msg) msg.textContent = d;
        return;
      }
      const hid = document.getElementById("sharedContactEditId");
      if (hid && String(hid.value) === String(id)) resetSharedContactForm();
      await refreshSharedContacts();
    } catch (e) {
      console.warn(e);
    }
  }

  async function submitSharedNotify() {
    const tok = getFacilityBearer();
    const msg = document.getElementById("sharedNotifyMsg");
    const tx = document.getElementById("sharedNotifyBody");
    const consent = document.getElementById("sharedNotifyConsent");
    if (!tok || !tx) return;
    const picks = Array.from(
      document.querySelectorAll(".shared-contact-pick:checked"),
    );
    const ids = picks
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
    const body = String(tx.value || "").trim();
    if (!ids.length) {
      if (msg) msg.textContent = "Select at least one contact (checkbox).";
      return;
    }
    if (!body) {
      if (msg) msg.textContent = "Enter a message.";
      return;
    }
    if (!consent || !consent.checked) {
      if (msg) msg.textContent = "Confirm consent before sending.";
      return;
    }
    if (msg) msg.textContent = "Sending…";
    try {
      const r = await fetch(`${API_BASE}/auth/shared-contacts/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contact_ids: ids,
          message: body,
          confirm_recipients_consented: true,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) {
        if (msg)
          msg.textContent =
            typeof j.detail === "string"
              ? j.detail
              : "Daily send limit reached.";
        await refreshSharedContacts();
        return;
      }
      if (!r.ok) {
        const d =
          typeof j.detail === "string"
            ? j.detail
            : JSON.stringify(j.detail || j);
        if (msg) msg.textContent = d || `HTTP ${r.status}`;
        return;
      }
      const results = j.results || [];
      const okN = results.filter((x) => x.ok).length;
      if (msg)
        msg.textContent = `Sent: ${okN} / ${results.length} OK. Check Notifications for delivery lines.`;
      await refreshSharedContacts();
      await refreshNotificationInbox();
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
      console.warn(e);
    }
  }

  async function facilityPasswordLogin(evt) {
    const emailEl = document.getElementById("facilityAuthEmail");
    const pwEl = document.getElementById("facilityAuthPassword");
    const banner = document.getElementById("facilityAuthBanner");
    if (!emailEl || !pwEl || !banner) return;
    const email = String(emailEl.value || "").trim();
    const password = String(pwEl.value || "");
    if (!email || !password) {
      banner.textContent = "Enter registration email and password.";
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) {
        const det =
          typeof j.detail === "string"
            ? j.detail
            : JSON.stringify(j.detail || j).slice(0, 220);
        banner.textContent = det || `Sign-in failed (HTTP ${r.status}).`;
        const verifyHint =
          r.status === 403 &&
          typeof j.detail === "string" &&
          j.detail.toLowerCase().includes("verify");
        const pnl = document.getElementById("firstTimeVerifyPanel");
        if (pnl) pnl.style.display = verifyHint ? "block" : "none";
        if (verifyHint) {
          banner.textContent +=
            " — Or type the signup verification code below, then try Sign in again.";
        }
        return;
      }
      {
        const pnl = document.getElementById("firstTimeVerifyPanel");
        if (pnl) pnl.style.display = "none";
        const rv = document.getElementById("regSignupVerifyMsg");
        if (rv) rv.textContent = "";
      }
      sessionStorage.setItem(FACILITY_TOKEN_KEY, j.access_token);
      sessionStorage.setItem(
        FACILITY_REPORTING_READY_KEY,
        j.facility_reporting_ready === true ? "1" : "0",
      );
      sessionStorage.setItem(
        FACILITY_CLAIMS_KEY,
        JSON.stringify({
          facility_id: j.facility_id,
          facility_name: j.facility_name,
          city: j.city,
          scopes: j.scopes || [],
        }),
      );
      pwEl.value = "";
      banner.textContent = "Signed in with password.";
      syncFacilityReportingChrome();
      await refreshUserRegistrationProfile();
      await refreshFacilityAuditLog();
      await refreshNotificationInbox();
      await refreshSharedContacts();
    } catch (e) {
      banner.textContent = `Login error: ${e.message || e}`;
      console.warn(e);
    }
  }

  async function facilitySubmitRegistrationVerifyCode() {
    const emailEl = document.getElementById("facilityAuthEmail");
    const codeEl = document.getElementById("regSignupCodeInput");
    const msg = document.getElementById("regSignupVerifyMsg");
    const banner = document.getElementById("facilityAuthBanner");
    const email = String(emailEl?.value || "").trim();
    const code = String(codeEl?.value || "").trim();
    if (!email || !code) {
      if (msg) {
        msg.style.color = "#fecaca";
        msg.textContent =
          "Enter your registration email above and the verification code.";
      }
      return;
    }
    if (msg) {
      msg.style.color = "var(--text-secondary)";
      msg.textContent = "Checking…";
    }
    try {
      const r = await fetch(`${API_BASE}/contacts/verify-with-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, verification_code: code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const d =
          typeof j.detail === "string"
            ? j.detail
            : `Verification failed (HTTP ${r.status}).`;
        if (msg) {
          msg.style.color = "#fecaca";
          msg.textContent = d;
        }
        return;
      }
      if (codeEl) codeEl.value = "";
      if (msg) {
        msg.style.color = "#86efac";
        msg.textContent =
          j.message || "Verified — use Sign in with your password.";
      }
      if (banner) {
        banner.textContent =
          "Registration verified — sign in with email and password (or use OTP if you prefer).";
      }
    } catch (e) {
      if (msg) {
        msg.style.color = "#fecaca";
        msg.textContent = String(e.message || e);
      }
    }
  }

  async function facilitySendLoginCode(evt) {
    const emailEl = document.getElementById("facilityAuthEmail");
    const banner = document.getElementById("facilityAuthBanner");
    if (!emailEl || !banner) return;
    const email = String(emailEl.value || "").trim();
    if (!email) {
      banner.textContent = "Enter your registration email first.";
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/auth/facility-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok && r.status !== 429) {
        banner.textContent =
          `Could not request OTP (HTTP ${r.status}). ${typeof j.detail === "string" ? j.detail : ""}`.trim();
        return;
      }
      if (j != null && typeof j.code_ttl_minutes === "number") {
        let line = `Facility login code queued (valid ${j.code_ttl_minutes} min). Check SMS, email, or WhatsApp — also spam folders. Paste it under Exchange OTP.`;
        if (Array.isArray(j.warnings) && j.warnings.length) {
          line += ` Note: ${j.warnings.slice(0, 4).join("; ")}`;
        }
        banner.textContent = line;
      } else {
        banner.textContent =
          "No login code was issued. You may need verification, approval, and a linked facility. Try password sign-in for a precise error.";
      }
    } catch (e) {
      banner.textContent =
        "Failed to contact API for login codes — verify API_BASE routing and MongoDB readiness.";
      console.warn(e);
    }
  }

  async function facilityExchangeLoginCode(evt) {
    const emailEl = document.getElementById("facilityAuthEmail");
    const codeEl = document.getElementById("facilityAuthCode");
    const banner = document.getElementById("facilityAuthBanner");
    if (!codeEl || !banner) return;
    const email = String(emailEl ? emailEl.value : "").trim();
    const code = String(codeEl.value || "").trim();
    if (!email || !code) {
      banner.textContent = "Enter email plus the OTP.";
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/auth/facility-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) {
        const det =
          typeof j.detail === "string"
            ? j.detail
            : JSON.stringify(j.detail || j).slice(0, 200);
        banner.textContent = det || `Sign-in rejected (HTTP ${r.status}).`;
        return;
      }
      sessionStorage.setItem(FACILITY_TOKEN_KEY, j.access_token);
      sessionStorage.setItem(FACILITY_REPORTING_READY_KEY, "1");
      sessionStorage.setItem(
        FACILITY_CLAIMS_KEY,
        JSON.stringify({
          facility_id: j.facility_id,
          facility_name: j.facility_name,
          city: j.city,
        }),
      );
      codeEl.value = "";
      banner.textContent = "Signed in — actions now write to MongoDB.";
      syncFacilityReportingChrome();
      await refreshUserRegistrationProfile();
      await refreshFacilityAuditLog();
      await refreshNotificationInbox();
      await refreshSharedContacts();
    } catch (e) {
      banner.textContent = `Token exchange error: ${e.message || e}`;
      console.warn(e);
    }
  }

  async function facilitySignOutReporting() {
    clearFacilityReportingSession();
    const pnl = document.getElementById("firstTimeVerifyPanel");
    if (pnl) pnl.style.display = "none";
    const rv = document.getElementById("regSignupVerifyMsg");
    if (rv) rv.textContent = "";
    lastProfile = null;
    syncFacilityReportingChrome();
    await refreshUserRegistrationProfile();
    await refreshFacilityAuditLog();
    await refreshNotificationInbox();
  }

  async function patchPreferences(body) {
    const tok = getFacilityBearer();
    if (!tok) throw new Error("Sign in first");
    const r = await fetch(`${API_BASE}/auth/preferences`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tok}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const det =
        typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || j);
      throw new Error(det || `HTTP ${r.status}`);
    }
    if (j.profile) {
      lastProfile = j.profile;
      const wrap = document.getElementById("userProfileBody");
      if (wrap) wrap.innerHTML = _renderUserProfileHtml(j.profile);
      renderFacilitiesAndPrefs(j.profile);
      showChannelForm(true, j.profile);
    }
    return j;
  }

  async function onAddFacility() {
    const inp = document.getElementById("addFacilityNameInput");
    const msg = document.getElementById("addFacilityMsg");
    const name = String((inp && inp.value) || "").trim();
    if (!name) {
      if (msg) msg.textContent = "Enter a facility or site name.";
      return;
    }
    if (msg) msg.textContent = "Saving…";
    try {
      await patchPreferences({ add_facility_name: name });
      if (inp) inp.value = "";
      if (msg) msg.textContent = "Saved — new site added to your enrolment.";
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
    }
  }

  async function onSaveThresholds() {
    const msgId = "addFacilityMsg";
    const msg = document.getElementById(msgId);
    const tok = getFacilityBearer();
    if (!tok) {
      if (msg) msg.textContent = "Sign in first.";
      return;
    }
    const inputs = document.querySelectorAll(".fac-threshold-in");
    const facility_site_pm25_thresholds = {};
    inputs.forEach((el) => {
      const site = el.getAttribute("data-site");
      const v = String(el.value || "").trim();
      if (!site) return;
      if (v === "") return;
      const n = Number(v);
      if (Number.isNaN(n)) return;
      facility_site_pm25_thresholds[site] = n;
    });
    if (msg) msg.textContent = "Saving thresholds…";
    try {
      await patchPreferences({ facility_site_pm25_thresholds });
      if (msg) msg.textContent = "PM2.5 thresholds saved.";
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
    }
  }

  async function onSaveChannels() {
    const msg = document.getElementById("channelPrefsMsg");
    const sms = document.getElementById("prefSms");
    const wa = document.getElementById("prefWhatsapp");
    const em = document.getElementById("prefEmail");
    const chans = [];
    if (sms && sms.checked) chans.push("sms");
    if (wa && wa.checked) chans.push("whatsapp");
    if (em && em.checked) chans.push("email");
    if (!chans.length) {
      if (msg) msg.textContent = "Select at least one channel.";
      return;
    }
    if (msg) msg.textContent = "Saving…";
    try {
      await patchPreferences({
        preferred_channels: chans,
        consent_given: lastProfile && lastProfile.consent_given !== false,
      });
      if (msg) msg.textContent = "Channel preferences saved.";
    } catch (e) {
      if (msg) msg.textContent = String(e.message || e);
    }
  }

  async function postFacilityOperationalAction(actionKey, evt, facilitySite) {
    const tok = getFacilityBearer();
    const banner = document.getElementById("facilityAuthBanner");
    const actions = {
      stocked_oxygen: "✓ Stocked O₂ cylinders",
      staff_called: "✓ Pediatric staff briefed",
      protocol_reviewed: "✓ Rapid triage protocol reviewed",
    };
    if (!tok) {
      if (banner) banner.textContent = "Sign in with password or OTP first.";
      return;
    }
    if (!facilityReportingReadyStored()) {
      if (banner)
        banner.textContent =
          "Preparedness actions need an approved account with a facility linked (see banner above).";
      return;
    }
    if (!actions[actionKey]) return;
    const sites = lastProfile ? siteLabelsFromProfile(lastProfile) : [];
    let facility_site = (facilitySite && String(facilitySite).trim()) || "";
    if (sites.length > 1 && !facility_site) {
      if (banner)
        banner.textContent =
          "Choose a facility card above — which site are you reporting for?";
      return;
    }
    try {
      const payload = {
        action_type: actionKey,
        details: actions[actionKey],
      };
      if (facility_site) payload.facility_site = facility_site;
      const r = await fetch(`${API_BASE}/action-log`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) {
        clearFacilityReportingSession();
        syncFacilityReportingChrome();
        await refreshFacilityAuditLog();
        if (banner)
          banner.textContent =
            (typeof j.detail === "string" ? j.detail : "Session expired") +
            " — sign in again.";
        return;
      }
      if (!r.ok) {
        const det =
          typeof j.detail === "string"
            ? j.detail
            : JSON.stringify(j.detail || j).slice(0, 220);
        if (banner) banner.textContent = det || `Action failed (${r.status})`;
        return;
      }
      const siteTag = j.facility_site ? ` @ ${j.facility_site}` : "";
      if (banner)
        banner.textContent = `${actions[actionKey]} logged${siteTag} (${j.facility_id || "facility"}).`;
      await refreshFacilityAuditLog();
      if (evt && evt.target.closest) {
        const b = evt.target.closest("button");
        if (b) {
          b.style.background = "rgba(46, 125, 50, 0.3)";
          b.style.borderColor = "#2e7d32";
          setTimeout(() => {
            b.style.background = "";
            b.style.borderColor = "";
          }, 950);
        }
      }
    } catch (err) {
      if (banner)
        banner.textContent =
          err && err.message ? err.message : "Action network error.";
      console.warn(err);
    }
  }

  function initThemeFromStorage() {
    const dark = localStorage.getItem("theme_dark");
    const useDark = dark === null ? true : dark === "1";
    if (useDark) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = "light";
  }

  function setupUserAccountListeners() {
    const fcPw = document.getElementById("facilityPasswordLoginBtn");
    if (fcPw) fcPw.addEventListener("click", (ev) => facilityPasswordLogin(ev));
    const fcSend = document.getElementById("facilitySendCodeBtn");
    if (fcSend)
      fcSend.addEventListener("click", (ev) => facilitySendLoginCode(ev));
    const fcEx = document.getElementById("facilityExchangeBtn");
    if (fcEx)
      fcEx.addEventListener("click", (ev) => facilityExchangeLoginCode(ev));
    const fcOut = document.getElementById("facilityLogoutBtn");
    if (fcOut)
      fcOut.addEventListener("click", () => facilitySignOutReporting());
    const regV = document.getElementById("regSignupVerifyBtn");
    if (regV)
      regV.addEventListener("click", () =>
        facilitySubmitRegistrationVerifyCode(),
      );
    const upRf = document.getElementById("userProfileRefreshBtn");
    if (upRf)
      upRf.addEventListener("click", () => refreshUserRegistrationProfile());
    const nInb = document.getElementById("notificationInboxRefreshBtn");
    if (nInb)
      nInb.addEventListener("click", () =>
        refreshNotificationInbox().catch(() => {}),
      );
    const nMore = document.getElementById("notificationInboxShowMoreBtn");
    if (nMore) {
      nMore.addEventListener("click", () =>
        openNotificationInboxModal().catch(() => {}),
      );
    }
    const nModalClose = document.getElementById(
      "notificationInboxModalCloseBtn",
    );
    if (nModalClose)
      nModalClose.addEventListener("click", () =>
        closeNotificationInboxModal(),
      );
    const nModal = document.getElementById("notificationInboxModal");
    if (nModal)
      nModal.addEventListener("click", (evt) => {
        if (evt.target === nModal) closeNotificationInboxModal();
      });
    const addF = document.getElementById("addFacilityBtn");
    if (addF)
      addF.addEventListener("click", () => onAddFacility().catch(() => {}));
    const saveTh = document.getElementById("saveThresholdsBtn");
    if (saveTh)
      saveTh.addEventListener("click", () =>
        onSaveThresholds().catch(() => {}),
      );
    const saveCh = document.getElementById("channelPrefsSaveBtn");
    if (saveCh)
      saveCh.addEventListener("click", () => onSaveChannels().catch(() => {}));
    const delAcc = document.getElementById("deleteAccountBtn");
    if (delAcc)
      delAcc.addEventListener("click", () =>
        submitDeleteAccount().catch(() => {}),
      );

    const sc = document.getElementById("sharedContactChannel");
    if (sc)
      sc.addEventListener("change", () => syncSharedContactChannelFields());
    syncSharedContactChannelFields();
    const ss = document.getElementById("sharedContactSubmitBtn");
    if (ss)
      ss.addEventListener("click", () =>
        submitSharedContactForm().catch(() => {}),
      );
    const sca = document.getElementById("sharedContactCancelEditBtn");
    if (sca) sca.addEventListener("click", () => resetSharedContactForm());
    const sct = document.getElementById("sharedContactsTable");
    if (sct) {
      sct.addEventListener("click", (evt) => {
        const ed =
          evt.target && evt.target.closest
            ? evt.target.closest(".shared-contact-edit")
            : null;
        const del =
          evt.target && evt.target.closest
            ? evt.target.closest(".shared-contact-del")
            : null;
        if (ed) {
          const id = ed.getAttribute("data-shared-id");
          if (id) startEditSharedContact(id);
          return;
        }
        if (del) {
          const id = del.getAttribute("data-shared-id");
          if (id && window.confirm("Remove this contact from your list?"))
            deleteSharedContact(id).catch(() => {});
        }
      });
    }
    const sn = document.getElementById("sharedNotifySendBtn");
    if (sn)
      sn.addEventListener("click", () => submitSharedNotify().catch(() => {}));

    const root = document.getElementById("facilitiesRoot");
    if (root) {
      root.addEventListener("click", (evt) => {
        const tgt =
          evt.target && evt.target.closest
            ? evt.target.closest(".fac-action-btn")
            : null;
        if (!tgt) return;
        const key = tgt.getAttribute("data-action-key");
        const site = tgt.getAttribute("data-facility-site") || "";
        if (!key) return;
        evt.preventDefault();
        postFacilityOperationalAction(key, evt, site);
      });
    }
  }

  async function boot() {
    await initRuntimeConfig();
    initThemeFromStorage();
    syncFacilityReportingChrome();
    setupUserAccountListeners();
    await refreshUserRegistrationProfile().catch(() => {});
    await refreshFacilityAuditLog().catch(() => {});
    await refreshNotificationInbox().catch(() => {});
    await refreshSharedContacts().catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => console.warn(e));
  });
})();
