(function() {
    if (window._zetaOfflineLoaded) return;
    window._zetaOfflineLoaded = true;

    var isOnline = navigator.onLine;
    var syncCount = 0;
    var banner = null;
    var syncBadge = null;

    function createBanner() {
        if (document.getElementById("zeta-offline-banner")) return;

        var css = document.createElement("style");
        css.textContent =
            "#zeta-offline-banner{" +
                "position:fixed;top:0;left:0;right:0;z-index:99999;" +
                "background:linear-gradient(135deg,#DC2626,#B91C1C);" +
                "color:#fff;text-align:center;font-family:Inter,sans-serif;" +
                "font-size:13px;font-weight:500;padding:6px 16px;" +
                "padding-top:calc(6px + env(safe-area-inset-top,0px));" +
                "display:flex;align-items:center;justify-content:center;gap:8px;" +
                "transform:translateY(-100%);transition:transform .3s ease;" +
                "box-shadow:0 2px 8px rgba(0,0,0,.15);" +
            "}" +
            "#zeta-offline-banner.visible{transform:translateY(0)}" +
            "#zeta-offline-banner.online-restored{background:linear-gradient(135deg,#059669,#047857)}" +
            "#zeta-offline-banner .dot{" +
                "width:8px;height:8px;border-radius:50%;background:#FCA5A5;flex-shrink:0;" +
                "animation:zeta-pulse 2s infinite;" +
            "}" +
            "#zeta-offline-banner.online-restored .dot{background:#6EE7B7;animation:none}" +
            "@keyframes zeta-pulse{0%,100%{opacity:1}50%{opacity:.4}}" +
            "#zeta-sync-badge{" +
                "position:fixed;bottom:80px;right:20px;z-index:99998;" +
                "background:#0E63D6;color:#fff;border-radius:12px;" +
                "padding:10px 16px;font-family:Inter,sans-serif;font-size:13px;" +
                "font-weight:500;cursor:pointer;box-shadow:0 4px 12px rgba(14,99,214,.3);" +
                "display:none;align-items:center;gap:8px;" +
                "transition:all .2s ease;-webkit-tap-highlight-color:transparent;" +
                "touch-action:manipulation;" +
            "}" +
            "#zeta-sync-badge:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(14,99,214,.4)}" +
            "#zeta-sync-badge .count{" +
                "background:#fff;color:#0E63D6;border-radius:50%;min-width:22px;height:22px;" +
                "display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;" +
            "}" +
            "#zeta-sync-badge.syncing{background:#18B4F0;pointer-events:none}" +
            "#zeta-sync-toast{" +
                "position:fixed;bottom:20px;right:20px;z-index:99999;" +
                "background:#065F46;color:#fff;border-radius:10px;" +
                "padding:12px 20px;font-family:Inter,sans-serif;font-size:13px;" +
                "font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);" +
                "transform:translateY(120%);transition:transform .3s ease;" +
                "display:flex;align-items:center;gap:8px;max-width:90vw;" +
            "}" +
            "#zeta-sync-toast.visible{transform:translateY(0)}" +
            ".zeta-cached-indicator{" +
                "display:inline-block;background:#FEF3C7;color:#92400E;font-size:11px;" +
                "padding:2px 8px;border-radius:4px;font-weight:500;margin-left:8px;" +
            "}" +
            "@media(max-width:600px){" +
                "#zeta-offline-banner{font-size:12px;padding:5px 12px;padding-top:calc(5px + env(safe-area-inset-top,0px))}" +
                "#zeta-sync-badge{bottom:70px;right:12px;padding:8px 12px;font-size:12px;border-radius:10px}" +
                "#zeta-sync-toast{bottom:12px;right:12px;left:12px;padding:10px 14px;font-size:12px;border-radius:8px}" +
                "#zeta-sync-badge .count{min-width:20px;height:20px;font-size:11px}" +
            "}" +
            "@media(max-width:360px){" +
                "#zeta-offline-banner{font-size:11px;padding:4px 8px;padding-top:calc(4px + env(safe-area-inset-top,0px))}" +
                "#zeta-sync-badge{bottom:60px;right:8px;padding:7px 10px;font-size:11px}" +
                "#zeta-sync-toast{bottom:8px;right:8px;left:8px;padding:8px 12px;font-size:11px}" +
            "}";
        document.head.appendChild(css);

        banner = document.createElement("div");
        banner.id = "zeta-offline-banner";
        banner.innerHTML = '<span class="dot"></span><span id="zeta-offline-text">You\'re offline. Cached data is shown.</span>';
        document.body.appendChild(banner);

        syncBadge = document.createElement("div");
        syncBadge.id = "zeta-sync-badge";
        syncBadge.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg><span id="zeta-sync-text">Sync</span><span class="count" id="zeta-sync-count">0</span>';
        syncBadge.onclick = function() { triggerSync(); };
        document.body.appendChild(syncBadge);

        var toast = document.createElement("div");
        toast.id = "zeta-sync-toast";
        toast.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span id="zeta-toast-text"></span>';
        document.body.appendChild(toast);
    }

    function showBanner(text, isOnlineRestored) {
        if (!banner) return;
        var textEl = document.getElementById("zeta-offline-text");
        if (textEl) textEl.textContent = text;
        banner.className = isOnlineRestored ? "visible online-restored" : "visible";
    }

    function hideBanner() {
        if (!banner) return;
        banner.className = "";
    }

    function updateSyncBadge(count) {
        syncCount = count;
        if (!syncBadge) return;
        var countEl = document.getElementById("zeta-sync-count");
        if (countEl) countEl.textContent = count;
        syncBadge.style.display = count > 0 ? "flex" : "none";
    }

    function showToast(text, duration) {
        var toast = document.getElementById("zeta-sync-toast");
        var toastText = document.getElementById("zeta-toast-text");
        if (!toast || !toastText) return;
        toastText.textContent = text;
        toast.className = "visible";
        setTimeout(function() { toast.className = ""; }, duration || 4000);
    }

    function triggerSync() {
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
        syncBadge.className = "syncing";
        var textEl = document.getElementById("zeta-sync-text");
        if (textEl) textEl.textContent = "Syncing...";
        navigator.serviceWorker.controller.postMessage("SYNC_NOW");
    }

    function requestSyncCount() {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage("GET_SYNC_COUNT");
        }
    }

    function handleOnline() {
        isOnline = true;
        showBanner("Back online!", true);
        setTimeout(function() { hideBanner(); }, 3000);
        if (syncCount > 0) {
            setTimeout(function() { triggerSync(); }, 1000);
        }
    }

    function handleOffline() {
        isOnline = false;
        showBanner("You're offline. Cached data is shown.");
    }

    function handleSWMessage(event) {
        var data = event.data;
        if (!data || !data.type) return;

        switch (data.type) {
            case "SYNC_COUNT":
                updateSyncBadge(data.count);
                break;
            case "SYNC_QUEUED":
                updateSyncBadge(syncCount + data.count);
                showToast("Action saved. Will sync when online.");
                break;
            case "SYNC_STARTED":
                if (syncBadge) syncBadge.className = "syncing";
                break;
            case "SYNC_COMPLETE":
                if (syncBadge) syncBadge.className = "";
                var textEl = document.getElementById("zeta-sync-text");
                if (textEl) textEl.textContent = "Sync";
                if (data.synced > 0) {
                    showToast(data.synced + " action(s) synced successfully." +
                        (data.failed > 0 ? " " + data.failed + " failed." : ""));
                }
                requestSyncCount();
                break;
        }
    }

    function interceptAjaxForOffline() {
        if (!window.jQuery) return;
        jQuery(document).ajaxComplete(function(event, xhr) {
            if (xhr && xhr.getResponseHeader && xhr.getResponseHeader("X-ZetaERP-Offline") === "true") {
                var pageContainer = document.querySelector(".q-page-container");
                if (pageContainer) {
                    var existing = pageContainer.querySelector(".zeta-cached-indicator");
                    if (!existing) {
                        var indicator = document.createElement("span");
                        indicator.className = "zeta-cached-indicator";
                        indicator.textContent = "Cached";
                        var title = pageContainer.querySelector("h3, h4, .text-h3, .text-h4");
                        if (title) title.appendChild(indicator);
                    }
                }
            }
        });
    }

    function init() {
        createBanner();
        if (!navigator.onLine) { handleOffline(); }
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener("message", handleSWMessage);
            navigator.serviceWorker.ready.then(function() { requestSyncCount(); });
        }
        interceptAjaxForOffline();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
