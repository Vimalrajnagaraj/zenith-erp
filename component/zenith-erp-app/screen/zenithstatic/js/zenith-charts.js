/* zenith-charts.js — makes inline ApexCharts render on BOTH /apps and /qapps.
 * /qapps (Quasar SPA) strips <script> tags, so a chart's <script src=apexcharts> and its
 * inline `new ApexCharts(...).render()` never run there. This exposes window.zChart(imgEl, fn)
 * which each chart calls from an <img onload="..."> attribute (attributes survive the strip),
 * lazy-loading the self-hosted ApexCharts library once on first use. No-op if already booted.
 * Loaded app-wide via footer_scripts (runs on both surfaces, like qapps-nav.js). */
(function () {
    'use strict';
    var loading = false, queue = [];
    function withApex(cb) {
        if (window.ApexCharts) { cb(); return; }
        queue.push(cb);
        if (loading) return;
        loading = true;
        var s = document.createElement('script');
        s.src = '/zenithstatic/js/apexcharts.min.js?v=1';
        s.onload = function () { var q = queue; queue = []; q.forEach(function (f) { try { f(); } catch (e) {} }); };
        s.onerror = function () { loading = false; if (window.console) console.warn('zChart: ApexCharts failed to load'); };
        document.head.appendChild(s);
    }
    // Called from a chart placeholder's <img onload="...zChart(this, function(){ new ApexCharts(...).render(); })">.
    // Idempotent (guards on the img) so an SPA re-render or a duplicated onload can't double-draw.
    function draw(img, fn) {
        try {
            if (!img || img.getAttribute('data-zdone') === '1') return;
            img.setAttribute('data-zdone', '1');
        } catch (e) {}
        withApex(function () { try { fn(); } catch (e) { if (window.console) console.warn('zChart render', e); } });
    }
    // On server-rendered /apps the chart <img> onload fires BEFORE this footer script runs, so those calls
    // queue into window.__zqcharts; drain them now. On /qapps the SPA content loads after this, so zChart is
    // already defined and used directly.
    var pending = window.__zqcharts;
    window.zChart = draw;
    if (pending && pending.length) pending.forEach(function (a) { try { draw(a[0], a[1]); } catch (e) {} });
})();
