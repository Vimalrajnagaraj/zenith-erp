/*
 * sw-reaper.js  (ZE-CONTACTS-025 / ZE-CONTACTS-024 — legacy service-worker cleanup + cross-tenant guard)
 *
 * Retire the LEGACY root-scoped service worker, and — critically for security — reload if it was
 * serving this page.
 *
 * Before the offline POS moved to a POS-scoped SW (/apps/zenith/pos/sw.js, scope /apps/zenith/pos/),
 * the app shipped a ROOT-scoped SW (served at /sw.js and /static/sw.js, "zetaerp-v6", scope /). No
 * current code registers it, but a service worker keeps running until explicitly unregistered, so
 * every browser that visited before the migration still has it ACTIVELY controlling EVERY page.
 *
 * S1 (ZE-CONTACTS-024): that stale SW caches authenticated, tenant-specific responses (the
 * EditContact.qvt component, org-context: userOrgInfo / ActiveOrgNav.qvue / saasConfig). After a
 * tenant switch it can serve Tenant A's CACHED contact profile to Tenant B on the first load —
 * bypassing the server-side ownership check entirely (the server correctly denies on the next load,
 * once the SW is out of the way). Cache-Control: no-store does NOT stop this, because a service
 * worker caches via caches.put(), which ignores HTTP cache headers. The only fix is to remove the SW.
 *
 * So on every page (loaded app-wide via footer_scripts, on BOTH /apps and /qapps): unregister any
 * registration NOT scoped to the intended POS SW, drop the legacy zetaerp-* caches, and — if THIS
 * page was being controlled by such a stray SW (i.e. its content may be cross-tenant cache that never
 * hit the server) — reload once so the page is re-fetched fresh from the network and the server
 * ownership check gates it. Loaded network-first for navigation by the stale SW, so this script
 * always reaches a browser it still controls. The POS offline SW is preserved.
 *
 * If a NEW legitimate service worker is ever added at a different scope, add it to KEEP_SCOPES.
 */
(function () {
    if (window.__zetaSwReaper) return;
    window.__zetaSwReaper = true;
    if (!('serviceWorker' in navigator)) return;

    var KEEP_SCOPES = ['/apps/zenith/pos/'];   // the only intentional SW (offline POS terminal)
    function isKept(url) {
        if (!url) return false;
        for (var i = 0; i < KEEP_SCOPES.length; i++) {
            if (url.indexOf(KEEP_SCOPES[i]) !== -1) return true;
        }
        return false;
    }

    // Is THIS page currently controlled by a stray (non-POS) SW? If so, whatever it rendered may be
    // cross-tenant cache that bypassed the server ownership check — after retiring the SW we must
    // reload to a clean, server-gated response.
    var ctrl = navigator.serviceWorker.controller;
    var controlledByStray = !!(ctrl && ctrl.scriptURL && !isKept(ctrl.scriptURL));

    try {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
            var jobs = [];
            regs.forEach(function (reg) {
                if (!isKept(reg.scope)) { jobs.push(reg.unregister()); }   // legacy root SW / any stray
            });
            // Drop the legacy caches (zetaerp-*); never touch the POS SW's caches (zenith-pos-cache-*).
            var cacheClear = (window.caches && caches.keys)
                ? caches.keys().then(function (keys) {
                      return Promise.all(keys.filter(function (k) { return k.indexOf('zetaerp') === 0; })
                                             .map(function (k) { return caches.delete(k); }));
                  }).catch(function () {})
                : Promise.resolve();

            return Promise.all(jobs.concat([cacheClear])).then(function () {
                // Security reload: only when a stray SW controlled this page, and only once per session
                // (guard against reload loops; after unregister the reloaded page is uncontrolled).
                if (controlledByStray && !sessionStorage.getItem('__zetaSwReaped')) {
                    try { sessionStorage.setItem('__zetaSwReaped', '1'); } catch (e) {}
                    location.reload();
                }
            });
        }).catch(function () {});
    } catch (e) { /* never let cleanup break the page */ }
})();
