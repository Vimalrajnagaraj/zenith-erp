/*
 * sw-reaper.js  (ZE-CONTACTS-025 follow-up — legacy service-worker cleanup)
 *
 * Retire the LEGACY root-scoped service worker.
 *
 * Before the offline POS moved to a POS-scoped SW (/apps/zenith/pos/sw.js, scope
 * /apps/zenith/pos/), the app shipped a ROOT-scoped SW (served at /sw.js and /static/sw.js,
 * CACHE_VERSION "zetaerp-v6", scope /). No current code registers it any more — but a service
 * worker keeps running until it is explicitly unregistered, so every browser that visited the app
 * before the migration still has it ACTIVELY controlling EVERY page. That is why the SW was
 * observed intercepting org-context requests (userOrgInfo / ActiveOrgNav.qvue / saasConfig) and
 * firing "message channel closed" noise on Contacts (Vendors, EditContact) and elsewhere — it is
 * systemic, on page load generally, exactly as reported. It also risks serving a stale app shell.
 *
 * Fixing it at the page level is independent of the legacy /sw.js still being served `immutable`
 * (so Cloudflare/browsers may pin it for up to a year): the legacy SW is network-first for
 * navigation, so this script loads on the fresh shell even for browsers it still controls. On
 * every page we unregister any registration NOT scoped to the intended POS SW and drop the legacy
 * caches — retiring the stray while preserving the POS offline SW. Loaded app-wide on BOTH /apps
 * and /qapps (per-screen scripts are stripped on the /qapps SPA, and the stale SW is root-scoped,
 * so it must be reaped on every surface).
 *
 * If a NEW legitimate service worker is ever added at a different scope, add it to KEEP_SCOPES.
 */
(function () {
    if (window.__zetaSwReaper) return;
    window.__zetaSwReaper = true;
    if (!('serviceWorker' in navigator)) return;

    var KEEP_SCOPES = ['/apps/zenith/pos/'];   // the only intentional SW (offline POS terminal)
    function isKept(scope) {
        if (!scope) return false;
        for (var i = 0; i < KEEP_SCOPES.length; i++) {
            if (scope.indexOf(KEEP_SCOPES[i]) !== -1) return true;
        }
        return false;
    }

    try {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
            regs.forEach(function (reg) {
                if (!isKept(reg.scope)) {
                    // Legacy root-scoped SW (or any other stray) -> retire it.
                    reg.unregister();
                }
            });
        }).catch(function () {});

        // Drop the legacy caches (zetaerp-*); never touch the POS SW's caches (zenith-pos-cache-*).
        if (window.caches && caches.keys) {
            caches.keys().then(function (keys) {
                keys.forEach(function (k) {
                    if (k && k.indexOf('zetaerp') === 0) { caches.delete(k); }
                });
            }).catch(function () {});
        }
    } catch (e) { /* never let cleanup break the page */ }
})();
