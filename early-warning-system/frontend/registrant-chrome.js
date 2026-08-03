/**
 * Shared registrant session chrome for /dashboard and /users.
 * Reads sessionStorage JWT from password/OTP login; shows name + Sign out;
 * hides Register CTAs while signed in.
 */
(function () {
  "use strict";

  var TOKEN_KEY = "facility_access_token";
  var CLAIMS_KEY = "facility_claims_preview";
  var READY_KEY = "ew_facility_reporting_ready";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CLAIMS_KEY);
    sessionStorage.removeItem(READY_KEY);
  }

  function readClaims() {
    try {
      var raw = sessionStorage.getItem(CLAIMS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeClaims(patch) {
    var cur = readClaims();
    var next = Object.assign({}, cur, patch || {});
    sessionStorage.setItem(CLAIMS_KEY, JSON.stringify(next));
  }

  function pageChromeOpts(extra) {
    var path = (window.location.pathname || "").replace(/\/$/, "");
    var onUsers = path === "/users";
    return Object.assign(
      { reloadOnSignOut: onUsers ? false : true },
      extra || {},
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function apiBase() {
    return (typeof window !== "undefined" && window.__EWS_API_BASE__) || "/api";
  }

  function setRegisterVisible(visible) {
    if (document.body) {
      document.body.classList.toggle("registrant-signed-in", !visible);
    }
    var nodes = document.querySelectorAll(
      "[data-auth-hide-when-signed-in], #dashboardRegisterAlertsBtn, a.registrant-register-cta",
    );
    nodes.forEach(function (el) {
      el.hidden = !visible;
      if (el.style) {
        el.style.display = visible ? "" : "none";
      }
    });
    document
      .querySelectorAll('.site-nav-global a[href="/registration"]')
      .forEach(function (a) {
        var sep = a.previousElementSibling;
        if (sep && sep.classList && sep.classList.contains("nav-sep")) {
          sep.hidden = !visible;
          sep.style.display = visible ? "" : "none";
        }
        a.hidden = !visible;
        a.style.display = visible ? "" : "none";
      });
  }

  function renderChrome(opts) {
    opts = opts || {};
    var tok = getToken();
    var root = document.getElementById("registrantAuthChrome");

    // Always sync Register CTAs from session first (even if chrome slot is missing)
    if (!tok) {
      setRegisterVisible(true);
      if (root) {
        root.hidden = true;
        root.innerHTML = "";
      }
      return;
    }

    setRegisterVisible(false);
    if (!root) return;

    var name =
      opts.name || readClaims().name || readClaims().email || "Signed in";
    root.hidden = false;
    root.innerHTML =
      '<span class="registrant-auth-pill" title="Registrant session">' +
      '<span class="registrant-auth-dot" aria-hidden="true"></span>' +
      '<span class="registrant-auth-text">Signed in as <strong id="registrantAuthName">' +
      escapeHtml(name) +
      "</strong></span></span>" +
      '<button type="button" class="btn secondary" id="registrantAuthSignOut">Sign out</button>';

    var btn = document.getElementById("registrantAuthSignOut");
    if (btn) {
      btn.addEventListener("click", function () {
        clearSession();
        if (typeof window.__ewsOnRegistrantSignOut === "function") {
          try {
            window.__ewsOnRegistrantSignOut();
          } catch (_) {
            /* ignore */
          }
        }
        // Soft refresh on /users; reload elsewhere so dashboard UI resets cleanly
        if (opts.reloadOnSignOut !== false) {
          window.location.reload();
        } else {
          renderChrome({ reloadOnSignOut: false });
        }
      });
    }
  }

  async function hydrateFromProfile() {
    var tok = getToken();
    if (!tok) {
      renderChrome();
      return;
    }
    var claims = readClaims();
    if (claims.name) {
      renderChrome(pageChromeOpts({ name: claims.name }));
    } else {
      renderChrome(pageChromeOpts({ name: claims.email || "…" }));
    }
    try {
      var r = await fetch(apiBase() + "/auth/profile", {
        headers: { Authorization: "Bearer " + tok },
      });
      if (r.status === 401 || r.status === 403) {
        clearSession();
        renderChrome();
        return;
      }
      if (!r.ok) return;
      var j = await r.json();
      if (j && (j.name || j.email)) {
        writeClaims({
          name: j.name || "",
          email: j.email || "",
          facility_id: j.facility_id || claims.facility_id,
          facility_name: j.facility_name || claims.facility_name,
          city: j.city || claims.city,
        });
        renderChrome(pageChromeOpts({ name: j.name || j.email }));
      }
    } catch (_) {
      /* keep claims-only chrome */
    }
  }

  window.EwsRegistrantChrome = {
    refresh: function (opts) {
      renderChrome(pageChromeOpts(opts || {}));
    },
    hydrate: hydrateFromProfile,
    clearSession: clearSession,
    writeClaims: writeClaims,
    getToken: getToken,
  };

  function boot() {
    hydrateFromProfile();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
