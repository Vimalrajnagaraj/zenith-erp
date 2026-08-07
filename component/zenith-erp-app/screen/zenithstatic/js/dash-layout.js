/* ZE-DASH: shared dashboard layout engine (switchable widgets + drag-to-reorder).
   Each dashboard sets window.__dashLayout = { saveUrl: '<screen>/saveDashOrder', order: 'csv,of,wkeys' }
   and wraps each toggleable widget as <div class="dash-widget" data-wkey="X"><div class="dash-handle">..</div>..</div>,
   optionally wrapping fixed trailing cards in <div id="dashExtras">. This flattens the widgets into a single
   #dashWidgets column in the saved order, removes the now-empty original layout row, and enables HTML5 drag
   (via the handle) that POSTs the new order back. Degrades gracefully (try/catch) to the default layout. */
(function () {
  try {
    var cfg = window.__dashLayout || {};
    var first = document.querySelector('.dash-widget');
    if (!first) return;
    var extras = document.getElementById('dashExtras');
    var oldRow = extras ? extras.parentNode.parentNode : (first.parentNode && first.parentNode.parentNode);
    var wrap = document.createElement('div');
    wrap.id = 'dashWidgets';
    wrap.className = 'dash-widgets-wrap';
    first.parentNode.insertBefore(wrap, first);
    var all = [].slice.call(document.querySelectorAll('.dash-widget'));
    var byKey = {};
    all.forEach(function (w) { byKey[w.getAttribute('data-wkey')] = w; });
    var seq = [];
    (cfg.order || '').split(',').forEach(function (k) { if (byKey[k] && seq.indexOf(k) < 0) seq.push(k); });
    all.forEach(function (w) { var k = w.getAttribute('data-wkey'); if (seq.indexOf(k) < 0) seq.push(k); });
    seq.forEach(function (k) { if (byKey[k]) wrap.appendChild(byKey[k]); });
    if (extras) wrap.parentNode.insertBefore(extras, wrap.nextSibling);
    if (oldRow && oldRow.parentNode && oldRow !== wrap && !oldRow.contains(wrap) && oldRow.querySelectorAll('.dash-widget').length === 0) {
      oldRow.parentNode.removeChild(oldRow);
    }
    if (!cfg.saveUrl) return;
    var dragEl = null;
    all.forEach(function (w) {
      var h = w.querySelector('.dash-handle');
      if (!h) return;
      h.addEventListener('mousedown', function () { w.setAttribute('draggable', 'true'); });
      w.addEventListener('dragstart', function (e) { dragEl = w; w.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x'); } catch (_e) {} });
      w.addEventListener('dragend', function () { w.classList.remove('dragging'); w.removeAttribute('draggable'); saveOrder(); });
    });
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); if (!dragEl) return; var a = afterEl(e.clientY); if (a == null) wrap.appendChild(dragEl); else wrap.insertBefore(dragEl, a); });
    function afterEl(y) {
      var els = [].slice.call(wrap.querySelectorAll('.dash-widget:not(.dragging)'));
      var res = { o: -1e9, e: null };
      els.forEach(function (ch) { var b = ch.getBoundingClientRect(); var o = y - b.top - b.height / 2; if (o < 0 && o > res.o) { res = { o: o, e: ch }; } });
      return res.e;
    }
    function saveOrder() {
      var keys = [].slice.call(wrap.querySelectorAll('.dash-widget')).map(function (w) { return w.getAttribute('data-wkey'); });
      var body = 'order=' + encodeURIComponent(keys.join(','));
      fetch(cfg.saveUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' }).catch(function () {});
    }
  } catch (_e) {}
})();
