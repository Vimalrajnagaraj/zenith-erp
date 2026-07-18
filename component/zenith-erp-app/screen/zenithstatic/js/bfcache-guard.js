/*
 * bfcache-guard.js  (ZE-DASH-031)
 *
 * Reload the page whenever it is restored from the browser's back/forward cache (bfcache).
 *
 * Why: Chrome 112+ (and by 150 broadly) keeps even `Cache-Control: no-store` documents in the
 * bfcache. A screen rendered for tenant A is therefore snapshotted in memory and, after a
 * logout + login as tenant B, the browser can restore that snapshot verbatim on the first
 * paint — showing A's data (KPI counts, lists) under B's session until a manual refresh. That
 * is a cross-tenant data bleed (S1). The server render is correctly org-scoped; the stale paint
 * is purely the bfcache snapshot.
 *
 * `pageshow` fires on every show; `event.persisted === true` means it was served from the
 * bfcache (not a fresh load). Reloading then forces a fresh, correctly-scoped server render.
 * A normal load has persisted=false, so this never loops. Loaded app-wide on BOTH /apps and
 * /qapps (per-screen <render-mode type="html"> guards are stripped on the /qapps SPA, so they
 * could not cover the surface where this defect was reported).
 */
(function () {
    if (window.__zetaBfcacheGuard) return;
    window.__zetaBfcacheGuard = true;
    window.addEventListener('pageshow', function (e) {
        if (e && e.persisted) { location.reload(); }
    });
})();
