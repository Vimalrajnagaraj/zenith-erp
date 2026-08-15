/* ZE-CONTACT-MAP: a real interactive map (Leaflet + free CARTO/OpenStreetMap raster tiles) for the Contacts
   dashboard. Only THIS small helper is head-loaded app-wide; the ~150KB Leaflet library + its CSS are
   LAZY-LOADED on first use (so pages without a map — POS terminal, etc. — never pay for them). Head-loading
   means window.zContactMap exists before the body (works on /apps AND the /qapps Quasar SPA, which strips
   inline <script>); each map instance is driven by an <img onload> attribute (which survives the strip).
   Markers + the home pin come from the map div's data-markers / data-home attributes. Degrades quietly. */
(function () {
  var V = '?v=1';
  function loadLeaflet(cb) {
    if (window.L) { cb(); return; }
    window.__zlCbs = window.__zlCbs || [];
    window.__zlCbs.push(cb);
    if (window.__zlLoading) return;
    window.__zlLoading = 1;
    try {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = '/zenithstatic/css/leaflet.css' + V;
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = '/zenithstatic/js/leaflet.js' + V;
      s.onload = function () { var cbs = window.__zlCbs; window.__zlCbs = []; cbs.forEach(function (f) { try { f(); } catch (_e) {} }); };
      s.onerror = function () { window.__zlLoading = 0; };
      document.head.appendChild(s);
    } catch (_e) { window.__zlLoading = 0; }
  }

  window.zContactMap = function (img) {
    if (!img) return;
    var box = img.closest ? img.closest('[data-cmap]') : null;
    var el = box ? box.querySelector('.z-cmap') : (img.previousElementSibling || null);
    if (!el || el.__zmap) return;
    el.__zmap = 1;
    loadLeaflet(function () {
      try {
        if (!window.L) { el.__zmap = 0; return; }
        var mk = [], hm = null;
        try { mk = JSON.parse(el.getAttribute('data-markers') || '[]'); } catch (_e) {}
        try { hm = JSON.parse(el.getAttribute('data-home') || 'null'); } catch (_e) {}

        var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([22.5, 79], 4);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19, subdomains: 'abcd',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(map);

        var maxN = 1;
        mk.forEach(function (p) { if (p.n > maxN) maxN = p.n; });
        var bounds = [];
        mk.forEach(function (p) {
          var d = 20 + Math.round(20 * Math.sqrt(p.n / maxN));
          var fs = d > 36 ? 13 : (d > 28 ? 11 : 10);
          var html = '<div style="position:relative;transform:translate(-50%,-50%)">'
            + '<div style="width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:rgba(110,86,207,.85);'
            + 'border:2px solid #fff;box-shadow:0 1px 5px rgba(70,61,122,.45);display:flex;align-items:center;'
            + 'justify-content:center;color:#fff;font-weight:800;font-size:' + fs + 'px;font-family:Segoe UI,Arial">' + p.n + '</div></div>';
          L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'zcm-i', html: html, iconSize: [d, d] }), title: p.name })
            .addTo(map).bindPopup('<b>' + p.name + '</b>: ' + p.n + ' customer' + (p.n == 1 ? '' : 's'));
          bounds.push([p.lat, p.lng]);
        });
        if (hm) {
          var hh = '<div style="transform:translate(-50%,-50%)"><div style="width:15px;height:15px;background:#B833EC;'
            + 'border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 5px rgba(70,61,122,.5)"></div></div>';
          L.marker([hm.lat, hm.lng], { icon: L.divIcon({ className: 'zcm-i', html: hh, iconSize: [15, 15] }), title: hm.name })
            .addTo(map).bindPopup('<b>' + hm.name + '</b> &mdash; your business');
          bounds.push([hm.lat, hm.lng]);
        }
        if (bounds.length === 1) map.setView(bounds[0], 8);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 11 });
        var n = 0, t = setInterval(function () { try { map.invalidateSize(); } catch (_e) {} if (++n > 4) clearInterval(t); }, 250);
      } catch (_e) {}
    });
  };
})();
