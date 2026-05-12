/**
 * Floating aqiHelp launcher — FAB + expandable panel (/help/aqi-help in iframe).
 * Skips itself when already on the aqiHelp page. Load: <script defer src="/landing-assets/aqi-help-widget.js"></script>
 */
(function () {
    if (!window.location.pathname || window.location.pathname.replace(/\/$/, '') === '/help/aqi-help') {
        return;
    }

    var PANEL_ID = 'aqi-help-float-panel';
    var FAB_ID = 'aqi-help-float-fab';

    var root = document.createElement('div');
    root.id = 'aqi-help-float-root';
    root.innerHTML =
        '<button type="button" id="' +
        FAB_ID +
        '" class="aqi-help-fab" aria-expanded="false" aria-controls="' +
        PANEL_ID +
        '" title="Open aqiHelp (how the platform works)">' +
        '<span aria-hidden="true">💬</span><span class="aqi-help-fab-text">Help</span></button>' +
        '<div id="' +
        PANEL_ID +
        '" class="aqi-help-panel" role="dialog" aria-modal="true" aria-labelledby="aqi-help-panel-title" hidden>' +
        '<div class="aqi-help-panel-toolbar">' +
        '<strong id="aqi-help-panel-title">aqiHelp</strong>' +
        '<div class="aqi-help-panel-actions">' +
        '<a class="aqi-help-panel-full" href="/help/aqi-help" target="_blank" rel="noopener">Fullscreen</a>' +
        '<button type="button" class="aqi-help-panel-close" aria-label="Close aqiHelp">✕</button>' +
        '</div></div>' +
        '<iframe class="aqi-help-panel-frame" src="/help/aqi-help" title="aqiHelp assistant"></iframe>' +
        '</div>';

    function injectCss() {
        if (document.getElementById('aqi-help-float-styles')) return;
        var s = document.createElement('style');
        s.id = 'aqi-help-float-styles';
        s.textContent =
            '#aqi-help-float-root{position:fixed;z-index:100050;bottom:max(14px,env(safe-area-inset-bottom));right:max(14px,env(safe-area-inset-right));font-family:system-ui,-apple-system,sans-serif;}' +
            '.aqi-help-fab{display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;border:none;cursor:pointer;font-weight:700;font-size:14px;color:#052e26;background:linear-gradient(145deg,#10b981,#059669);box-shadow:0 6px 24px rgba(16,185,129,.42),0 2px 8px rgba(0,0,0,.25);transition:transform .15s ease,box-shadow .15s ease;}' +
            '.aqi-help-fab:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(16,185,129,.48),0 4px 12px rgba(0,0,0,.28);}' +
            '.aqi-help-fab:focus{outline:3px solid #6ee7b7;outline-offset:2px;}' +
            '.aqi-help-fab-text{letter-spacing:.02em;}' +
            '.aqi-help-panel{position:fixed;z-index:100051;width:min(420px,calc(100vw - 20px));height:min(86vh,calc(100dvh - 90px));max-height:760px;' +
            'bottom:calc(max(14px,env(safe-area-inset-bottom)) + 58px);right:max(14px,env(safe-area-inset-right));' +
            'background:#0f172a;border-radius:14px;border:1px solid #334155;box-shadow:0 16px 50px rgba(0,0,0,.48);overflow:hidden;display:flex;flex-direction:column;}' +
            '.aqi-help-panel[hidden]{display:none !important;}' +
            '.aqi-help-panel-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#1e293b;border-bottom:1px solid #334155;color:#e2e8f0;font-size:15px;}' +
            '.aqi-help-panel-actions{display:flex;align-items:center;gap:10px;}' +
            '.aqi-help-panel-full{color:#10b981;font-size:12px;font-weight:600;text-decoration:none;}' +
            '.aqi-help-panel-full:hover{text-decoration:underline;}' +
            '.aqi-help-panel-close{width:34px;height:34px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;font-size:18px;line-height:1;cursor:pointer;}' +
            '.aqi-help-panel-close:hover{background:#475569;}' +
            '.aqi-help-panel-frame{flex:1;width:100%;border:none;background:#0f172a;min-height:0;}' +
            '@media(max-width:480px){.aqi-help-panel{bottom:auto;top:52px;width:calc(100vw - 14px);right:7px;left:auto;height:calc(100dvh - 70px);max-height:none;}' +
            '#aqi-help-float-root{bottom:12px;right:12px;}.aqi-help-fab{padding:14px;width:52px;height:52px;border-radius:50%;justify-content:center;}.aqi-help-fab-text{display:none;}}';
        document.head.appendChild(s);
    }

    function toggle(open) {
        var fab = document.getElementById(FAB_ID);
        var panel = document.getElementById(PANEL_ID);
        if (!fab || !panel) return;
        var next = typeof open === 'boolean' ? open : panel.hidden;
        panel.hidden = !next;
        fab.setAttribute('aria-expanded', next ? 'true' : 'false');
        if (next) {
            try {
                panel.querySelector('.aqi-help-panel-close').focus();
            } catch (_) { /* ignore */ }
        } else fab.focus();
    }

    injectCss();
    document.body.appendChild(root);

    var fabBtn = document.getElementById(FAB_ID);
    var panelEl = document.getElementById(PANEL_ID);

    fabBtn.addEventListener('click', function () {
        toggle();
    });

    panelEl.querySelector('.aqi-help-panel-close').addEventListener('click', function () {
        toggle(false);
    });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && panelEl && !panelEl.hidden) {
            ev.preventDefault();
            toggle(false);
        }
    });
})();
