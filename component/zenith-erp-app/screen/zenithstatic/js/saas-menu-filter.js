(function() {
    if (window._saasMenuFilterLoaded) return;
    window._saasMenuFilterLoaded = true;

    function startFilter(cfg) {
        var app = document.getElementById("apps-root");
        if (!app || !app.__vue__) return;
        var vm = app.__vue__;
        var isTenant = !!cfg.isSaasTenant;
        var hasAll = !!cfg.hasAllAccess;
        var posOnly = !!cfg.posOnly;
        var allowedSet = {};
        (cfg.modules || []).forEach(function(m) { allowedSet[String(m).toLowerCase()] = true; });
        var alwaysAllowed = { "dashboard":true, "settings":true, "saas-admin":true, "my-subscription":true };
        var lastFiltered = null;

        function filterMenu(list) {
            // Guard prevents redundant re-processing of the same array reference.
            if (!list || !list.length || list === lastFiltered) return;
            lastFiltered = list;
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                // Only filter the top-level ZetaERP app menu (the module list).
                // Filtering deeper levels would wrongly hide each module's own
                // sub-screens, since their names are not plan-module names.
                if (!item || item.name !== "zenith") continue;
                if (!item.subscreens || !item.subscreens.length) continue;
                var filtered = item.subscreens.filter(function(ss) {
                    var name = ss.name ? ss.name.toLowerCase() : "";
                    // POS-only cashier: show only the POS module, hide everything else.
                    if (posOnly) return name === "pos";
                    if (name === "saas-admin" && isTenant) return false;
                    if (name === "my-subscription" && !isTenant) return false;
                    if (!isTenant || hasAll) return true;
                    if (alwaysAllowed[name]) return true;
                    return !!allowedSet[name];
                });
                if (filtered.length !== item.subscreens.length) {
                    item.subscreens = filtered;
                }
            }
        }

        vm.$watch("navMenuList", function(newList) {
            filterMenu(newList);
        }, { immediate: true });
    }

    function readEmbedded() {
        // Vue strips <script> from screen templates, so the server embeds the
        // config in a hidden div's data-* attributes (which survive compile).
        var el = document.getElementById("zenith-saas-cfg");
        if (!el) return null;
        try {
            return {
                isSaasTenant: el.getAttribute("data-tenant") === "true",
                hasAllAccess: el.getAttribute("data-all") === "true",
                posOnly: el.getAttribute("data-pos-only") === "true",
                modules: JSON.parse(el.getAttribute("data-modules") || "[]")
            };
        } catch (e) { return null; }
    }

    function boot() {
        var app = document.getElementById("apps-root");
        if (!(app && app.__vue__)) return false;
        // Prefer the server-embedded config (zero extra round-trip, applies on
        // first paint). Fall back to the saasConfig XHR only if it is absent.
        var embedded = window.__zenithSaasCfg || readEmbedded();
        if (embedded) {
            startFilter(embedded);
            return true;
        }
        var vm = app.__vue__;
        $.ajax({
            type: "GET", url: vm.appRootPath + "/apps/zenith/saasConfig", dataType: "json",
            success: function(cfg) { if (cfg) startFilter(cfg); }
        });
        return true;
    }

    var checkReady = setInterval(function() {
        if (boot()) clearInterval(checkReady);
    }, 200);
})();
