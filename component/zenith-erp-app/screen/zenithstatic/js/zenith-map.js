/* ZE-CONTACT-MAP: a real interactive map for the Contacts dashboard, using ONLY free/open tools with NO API
   key and NO usage limits: MapLibre GL JS (BSD-3) + OpenFreeMap vector tiles (free, commercial-OK, and
   self-hostable at tiles.openfreemap.org). Only this small helper is head-loaded app-wide; MapLibre (~800KB)
   + its CSS are LAZY-LOADED on first map render (pages without a map never pay for them). Head-loading means
   window.zContactMap exists before the body (works on /apps AND the /qapps Quasar SPA, which strips inline
   <script>); each map is driven by an <img onload> attribute (survives the strip). Markers + the home pin
   come from the map div's data-markers / data-home attributes. Degrades quietly if the lib/tiles fail. */
(function () {
  var V = '?v=2';
  var JS = '/zenithstatic/js/maplibre-gl.js' + V;
  var CSS = '/zenithstatic/css/maplibre-gl.css' + V;
  var STYLE = 'https://tiles.openfreemap.org/styles/positron';

  function loadLib(cb) {
    if (window.maplibregl) { cb(); return; }
    window.__zmCbs = window.__zmCbs || [];
    window.__zmCbs.push(cb);
    if (window.__zmLoading) return;
    window.__zmLoading = 1;
    try {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = CSS; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = JS;
      s.onload = function () { var cbs = window.__zmCbs; window.__zmCbs = []; cbs.forEach(function (f) { try { f(); } catch (_e) {} }); };
      s.onerror = function () { window.__zmLoading = 0; };
      document.head.appendChild(s);
    } catch (_e) { window.__zmLoading = 0; }
  }

  function node(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }

  window.zContactMap = function (img) {
    if (!img) return;
    var box = img.closest ? img.closest('[data-cmap]') : null;
    var el = box ? box.querySelector('.z-cmap') : (img.previousElementSibling || null);
    if (!el || el.__zmap) return;
    el.__zmap = 1;
    loadLib(function () {
      try {
        if (!window.maplibregl) { el.__zmap = 0; return; }
        var mk = [], hm = null;
        try { mk = JSON.parse(el.getAttribute('data-markers') || '[]'); } catch (_e) {}
        try { hm = JSON.parse(el.getAttribute('data-home') || 'null'); } catch (_e) {}

        // MapLibre uses [lng, lat] order (GeoJSON), not [lat, lng]
        var map = new maplibregl.Map({ container: el, style: STYLE, center: [79, 22.5], zoom: 3.2, attributionControl: true });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
        try { map.scrollZoom.disable(); } catch (_e) {}

        var maxN = 1; mk.forEach(function (p) { if (p.n > maxN) maxN = p.n; });
        var pts = [];
        mk.forEach(function (p) {
          var dm = 20 + Math.round(20 * Math.sqrt(p.n / maxN));
          var fs = dm > 36 ? 13 : (dm > 28 ? 11 : 10);
          var elm = node('<div style="width:' + dm + 'px;height:' + dm + 'px;border-radius:50%;background:rgba(110,86,207,.85);'
            + 'border:2px solid #fff;box-shadow:0 1px 5px rgba(70,61,122,.45);display:flex;align-items:center;justify-content:center;'
            + 'color:#fff;font-weight:800;font-size:' + fs + 'px;font-family:Segoe UI,Arial;cursor:pointer">' + p.n + '</div>');
          new maplibregl.Marker({ element: elm, anchor: 'center' }).setLngLat([p.lng, p.lat])
            .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML('<b>' + p.name + '</b>: ' + p.n + ' customer' + (p.n == 1 ? '' : 's')))
            .addTo(map);
          pts.push([p.lng, p.lat]);
        });
        if (hm) {
          var hn = node('<div style="width:15px;height:15px;background:#B833EC;border:2px solid #fff;transform:rotate(45deg);'
            + 'box-shadow:0 1px 5px rgba(70,61,122,.5);cursor:pointer"></div>');
          new maplibregl.Marker({ element: hn, anchor: 'center' }).setLngLat([hm.lng, hm.lat])
            .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML('<b>' + hm.name + '</b> &mdash; your business'))
            .addTo(map);
          pts.push([hm.lng, hm.lat]);
        }
        var framed = false;
        function frame() {
          if (framed) return; framed = true;
          try { map.resize(); } catch (_e) {}
          if (pts.length === 1) map.jumpTo({ center: pts[0], zoom: 7 });
          else if (pts.length > 1) {
            var b = new maplibregl.LngLatBounds();
            pts.forEach(function (c) { b.extend(c); });
            map.fitBounds(b, { padding: 40, maxZoom: 10, duration: 0 });
          }
          setTimeout(function () { try { map.resize(); } catch (_e) {} }, 200);
        }
        map.on('load', frame);
        setTimeout(frame, 1800); // fallback if 'load' is slow/flaky
      } catch (_e) {}
    });
  };
})();
