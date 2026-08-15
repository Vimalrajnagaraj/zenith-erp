/* ZE-DASH: shared dashboard layout engine (switchable widgets + drag-to-reorder + optional width presets).
   Each dashboard sets window.__dashLayout = { saveUrl: '<screen>/saveDashOrder', order: 'csv,of,wkeys', sizes?: 'wkey:half,...' }
   and wraps each toggleable widget as <div class="dash-widget" data-wkey="X"><div class="dash-handle">..</div>..</div>,
   optionally wrapping fixed trailing cards in <div id="dashExtras">. This flattens the widgets into a single
   #dashWidgets column in the saved order, removes the now-empty original layout row, and enables HTML5 drag
   (via the handle) that POSTs the new order back. Degrades gracefully (try/catch) to the default layout.
   WIDTH PRESETS (opt-in): when `sizes` is present (even ''), each widget gets a full/half width toggle; the wrap
   becomes a flex grid (scoped via .dash-resizable so other dashboards are unaffected) and sizes persist too. */
(function () {
  try {
    var cfg = window.__dashLayout || {};
    var first = document.querySelector('.dash-widget');
    if (!first) return;
    var extras = document.getElementById('dashExtras');
    var all = [].slice.call(document.querySelectorAll('.dash-widget'));
    // record each widget's grandparent (its layout row) BEFORE moving, so any row that ends up
    // empty (e.g. a 2-col charts row whose cards we hoisted out) can be cleaned up afterwards.
    var sources = [];
    all.forEach(function (w) { var p = w.parentNode && w.parentNode.parentNode; if (p && sources.indexOf(p) < 0) sources.push(p); });
    var wrap = document.createElement('div');
    wrap.id = 'dashWidgets';
    wrap.className = 'dash-widgets-wrap';
    first.parentNode.insertBefore(wrap, first);
    var byKey = {};
    all.forEach(function (w) { byKey[w.getAttribute('data-wkey')] = w; });
    var seq = [];
    (cfg.order || '').split(',').forEach(function (k) { if (byKey[k] && seq.indexOf(k) < 0) seq.push(k); });
    all.forEach(function (w) { var k = w.getAttribute('data-wkey'); if (seq.indexOf(k) < 0) seq.push(k); });
    seq.forEach(function (k) { if (byKey[k]) wrap.appendChild(byKey[k]); });
    if (extras) wrap.parentNode.insertBefore(extras, wrap.nextSibling);
    // drop any now-empty layout rows left behind (no widget, no real content)
    sources.forEach(function (row) {
      if (!row || !row.parentNode || row === wrap || row.contains(wrap) || row.querySelector('.dash-widget')) return;
      if ((row.textContent || '').replace(/\s/g, '') === '' && !row.querySelector('img,canvas,svg,input,button,a,iframe')) {
        row.parentNode.removeChild(row);
      }
    });

    // ---- optional width presets (full / half / third), gated so other dashboards are untouched ----
    var sizesOn = (cfg.sizes != null);
    var SIZES = { full: 'dw-full', half: 'dw-half', third: 'dw-third' };
    function sizeOf(w) { return w.classList.contains('dw-third') ? 'third' : (w.classList.contains('dw-half') ? 'half' : 'full'); }
    function applySize(w, sz) { w.classList.remove('dw-full', 'dw-half', 'dw-third'); w.classList.add(SIZES[sz] || 'dw-full'); }
    function currentSizes() {
      return [].slice.call(wrap.querySelectorAll('.dash-widget')).map(function (w) {
        return w.getAttribute('data-wkey') + ':' + sizeOf(w);
      }).filter(function (s) { return /:(half|third)$/.test(s); }).join(',');
    }
    // ApexCharts (and other responsive widgets) render at their initial width, so after we change a
    // widget's column width we must nudge them to re-fit — a window 'resize' is what they listen for.
    function reflow() { try { window.dispatchEvent(new Event('resize')); } catch (_e) {} }
    if (sizesOn) {
      wrap.classList.add('dash-resizable');
      var sizeMap = {};
      (cfg.sizes || '').split(',').forEach(function (pair) { var kv = pair.split(':'); if (kv.length === 2 && kv[0]) { var s = kv[1]; sizeMap[kv[0]] = (s === 'half' || s === 'third') ? s : 'full'; } });
      var ICON = '<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.2" y="3" width="11.6" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect><line x1="7" y1="3.4" x2="7" y2="10.6" stroke="currentColor" stroke-width="1.4"></line></svg>';
      var NEXT = { full: 'half', half: 'third', third: 'full' };
      all.forEach(function (w) {
        applySize(w, sizeMap[w.getAttribute('data-wkey')] || 'full');
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'dash-resize'; btn.innerHTML = ICON;
        btn.title = 'Resize widget (full / half / third width)'; btn.setAttribute('aria-label', 'Cycle widget width: full, half, third');
        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          applySize(w, NEXT[sizeOf(w)]);
          saveLayout(); reflow();
        });
        w.appendChild(btn);
      });
      // charts may finish rendering slightly after this runs — re-fit a couple of times as the layout settles
      reflow(); setTimeout(reflow, 500); setTimeout(reflow, 1400);
    }

    if (!cfg.saveUrl) return;
    var dragEl = null;
    all.forEach(function (w) {
      var h = w.querySelector('.dash-handle');
      if (!h) return;
      h.addEventListener('mousedown', function () { w.setAttribute('draggable', 'true'); });
      w.addEventListener('dragstart', function (e) { dragEl = w; w.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x'); } catch (_e) {} });
      w.addEventListener('dragend', function () { w.classList.remove('dragging'); w.removeAttribute('draggable'); saveLayout(); });
    });
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); if (!dragEl) return; var a = afterEl(e.clientY); if (a == null) wrap.appendChild(dragEl); else wrap.insertBefore(dragEl, a); });
    function afterEl(y) {
      var els = [].slice.call(wrap.querySelectorAll('.dash-widget:not(.dragging)'));
      var res = { o: -1e9, e: null };
      els.forEach(function (ch) { var b = ch.getBoundingClientRect(); var o = y - b.top - b.height / 2; if (o < 0 && o > res.o) { res = { o: o, e: ch }; } });
      return res.e;
    }
    var saveTimer = null;
    function saveLayout() {
      // debounce so rapid changes (e.g. resizing two widgets quickly) coalesce into ONE final POST —
      // otherwise near-simultaneous requests race on the same preference and a stale write can win.
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        var keys = [].slice.call(wrap.querySelectorAll('.dash-widget')).map(function (w) { return w.getAttribute('data-wkey'); });
        var body = 'order=' + encodeURIComponent(keys.join(','));
        // '__full__' sentinel = "every widget full" (a real saved state); empty would be ambiguous with
        // "never customized" (which falls back to the dashboard's default sizes).
        if (sizesOn) body += '&sizes=' + encodeURIComponent(currentSizes() || '__full__');
        fetch(cfg.saveUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' }).catch(function () {});
      }, 250);
    }
  } catch (_e) {}
})();
