/* KOT Billing — kitchen order-entry cart engine.
 * Loaded via <img onload> from KotBilling.xml so it runs on both /apps and /qapps.
 * External .js file => no Vue-template constraints (bare < is fine here).
 * Drafts are persisted SERVER-SIDE (KotDraft); Active/Completed tabs show server-loaded lists. */
(function () {
  if (window.__kbInit) return;
  window.__kbInit = true;

  var cart = {};            // id -> {id, name, price, qty}
  var orderType = 'Dine In';
  var loadedDraftId = '';   // set when a saved draft was resumed into the cart
  var orders = {};          // kotId -> {num, table, time, items:[{name,qty}]}  (for per-order print)

  function $(id) { return document.getElementById(id); }
  function qsa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function base() { return location.pathname.replace(/\/$/, ''); }
  function cssId(id) { return (window.CSS && CSS.escape) ? CSS.escape(id) : id; }
  function tok() {
    try { if (window.moqui && window.moqui.webrootVue && window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; } catch (e) {}
    var h = $('kb-token'); return h ? h.value : '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function inr(n) {
    n = Math.round((Number(n) || 0) * 100) / 100;
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2), ip = s.split('.')[0], fp = s.split('.')[1], res;
    if (ip.length <= 3) { res = ip; }
    else {
      var last3 = ip.slice(-3), rest = ip.slice(0, -3), out = '';
      while (rest.length > 2) { out = ',' + rest.slice(-2) + out; rest = rest.slice(0, -2); }
      res = rest + out + ',' + last3;
    }
    return (neg ? '-' : '') + '₹' + res + '.' + fp;
  }

  var TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

  function menuPrice(id) {
    var c = document.querySelector('.kb-card[data-id="' + cssId(id) + '"]');
    return c ? (Number(c.getAttribute('data-price')) || 0) : 0;
  }

  function render() {
    var tbody = $('kb-cart'), rows = '', sub = 0, n = 0;
    for (var id in cart) {
      if (!cart.hasOwnProperty(id)) continue;
      var it = cart[id], amt = it.price * it.qty; sub += amt; n++;
      rows += '<tr>' +
        '<td class="kb-oname">' + esc(it.name) + '</td>' +
        '<td><span class="kb-ostep">' +
          '<button type="button" onclick="kbDec(\'' + id + '\')"' + (it.qty <= 1 ? ' disabled' : '') + '>−</button>' +
          '<span>' + it.qty + '</span>' +
          '<button type="button" onclick="kbInc(\'' + id + '\')">+</button>' +
        '</span></td>' +
        '<td class="r">' + inr(it.price) + '</td>' +
        '<td class="r kb-oamt">' + inr(amt) + '</td>' +
        '<td class="r"><button type="button" class="kb-orm" onclick="kbRemove(\'' + id + '\')">' + TRASH + '</button></td>' +
      '</tr>';
    }
    if (tbody) tbody.innerHTML = rows;
    var empty = $('kb-cartempty'); if (empty) empty.style.display = n ? 'none' : 'block';

    var cgst = sub * 0.025, sgst = sub * 0.025, grand = sub + cgst + sgst;
    if ($('kb-subtotal')) $('kb-subtotal').textContent = inr(sub);
    if ($('kb-cgst')) $('kb-cgst').textContent = inr(cgst);
    if ($('kb-sgst')) $('kb-sgst').textContent = inr(sgst);
    if ($('kb-grand')) $('kb-grand').textContent = inr(grand);

    var send = $('kb-send'); if (send) send.classList.toggle('is-disabled', n === 0);
    var clr = $('kb-clear'); if (clr) clr.disabled = (n === 0);

    qsa('.kb-card').forEach(function (c) {
      var id = c.getAttribute('data-id'), it = cart[id];
      c.classList.toggle('in-cart', !!it);
      var q = c.querySelector('[data-q="' + cssId(id) + '"]');
      if (q) q.textContent = it ? it.qty : 0;
    });
  }

  function cardData(id) {
    var c = document.querySelector('.kb-card[data-id="' + cssId(id) + '"]');
    if (!c) return null;
    return { id: id, name: c.getAttribute('data-name'), price: Number(c.getAttribute('data-price')) || 0 };
  }

  window.kbAdd = function (id) {
    if (cart[id]) { cart[id].qty++; }
    else { var d = cardData(id); if (!d) return; cart[id] = { id: id, name: d.name, price: d.price, qty: 1 }; }
    render();
  };
  window.kbInc = function (id) { if (cart[id]) { cart[id].qty++; render(); } };
  window.kbDec = function (id) { if (cart[id]) { cart[id].qty--; if (cart[id].qty <= 0) delete cart[id]; render(); } };
  window.kbRemove = function (id) { delete cart[id]; render(); };
  window.kbClear = function () { cart = {}; render(); };

  // ---- menu filters ----
  function applyFilter() {
    var cat = (window.__kbCat || ''), term = (window.__kbTerm || '').toLowerCase(),
        avail = $('kb-avail') && !$('kb-avail').classList.contains('off'), shown = 0;
    qsa('.kb-card').forEach(function (c) {
      var okCat = (!cat || c.getAttribute('data-cat') === cat);
      var okTerm = (!term || (c.getAttribute('data-name') || '').toLowerCase().indexOf(term) !== -1);
      var okAvail = (!avail || (Number(c.getAttribute('data-price')) || 0) > 0);
      var ok = okCat && okTerm && okAvail;
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    var nr = $('kb-noresult'); if (nr) nr.style.display = shown ? 'none' : 'block';
  }
  window.kbCat = function (cat, el) { window.__kbCat = cat; qsa('.kb-cat').forEach(function (x) { x.classList.toggle('is-active', x === el); }); applyFilter(); };
  window.kbSearch = function (v) { window.__kbTerm = v; applyFilter(); };
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'kb-avail') setTimeout(applyFilter, 0); });

  // ---- order type ----
  function setOrderType(ot) {
    orderType = ot;
    qsa('.kb-otbtn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-ot') === ot); });
    var sel = $('kb-ordertype'); if (sel && sel.value !== ot) sel.value = ot;
  }
  window.kbOrderType = function (ot) { setOrderType(ot); };
  window.kbOrderTypeSel = function (v) { setOrderType(v); };

  // ---- tabs: switch between the New Order entry view and the Active/Completed lists ----
  window.kbTab = function (tab, el) {
    qsa('.kb-tab').forEach(function (b) { b.classList.toggle('is-active', b === el); });
    var w = $('kb-wrap'); if (!w) return;
    w.classList.remove('view-active', 'view-completed');
    if (tab === 'active') w.classList.add('view-active');
    else if (tab === 'completed') w.classList.add('view-completed');
  };

  window.kbGo = function (path) { location.href = base() + '/' + path; };

  // ---- server-side transitions (POST with session token) ----
  function post(path, params) {
    var f = document.createElement('form');
    f.method = 'POST'; f.action = base() + '/' + path; f.style.display = 'none';
    function add(n, v) { var i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = (v == null ? '' : v); f.appendChild(i); }
    for (var k in params) { if (params.hasOwnProperty(k)) add(k, params[k]); }
    add('moquiSessionToken', tok());
    document.body.appendChild(f); f.submit();
  }
  function cartItems() {
    var items = [];
    for (var id in cart) { if (!cart.hasOwnProperty(id)) continue; var it = cart[id]; items.push({ productId: it.id, productName: it.name, quantity: it.qty }); }
    return items;
  }

  window.kbSend = function () {
    var items = cartItems(); if (!items.length) return;
    var btn = $('kb-send'); if (btn) { btn.classList.add('is-disabled'); btn.textContent = 'Sending...'; }
    post('createKot', { itemsJson: JSON.stringify(items), tableNumber: ($('kb-table') || {}).value || '',
      orderType: orderType, notes: ($('kb-instr') || {}).value || '', loadedDraftId: loadedDraftId });
  };
  window.kbSaveDraft = function () {
    var items = cartItems(); if (!items.length) { alert('Add items before saving a draft.'); return; }
    var btn = $('kb-draft'); if (btn) { btn.innerHTML = 'Saving...'; }
    post('saveDraft', { itemsJson: JSON.stringify(items), tableNumber: ($('kb-table') || {}).value || '',
      orderType: orderType, notes: ($('kb-instr') || {}).value || '', existingDraftId: loadedDraftId });
  };
  window.kbLoadDraft = function (id) { location.href = base() + '/?loadDraft=' + encodeURIComponent(id); };
  window.kbDiscardDraft = function (id) { if (!confirm('Discard this draft?')) return; post('deleteDraft', { kotId: id }); };

  // ---- printing ----
  function openPrint(html) {
    var w = window.open('', '_blank', 'width=340,height=560');
    if (!w) { alert('Allow pop-ups to print the KOT.'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 250);
  }
  function slip(title, meta, items, notes) {
    var rows = '';
    (items || []).forEach(function (it) { rows += '<tr><td>' + esc(it.name) + '</td><td style="text-align:center">' + esc(it.qty) + '</td></tr>'; });
    return '<html><head><title>KOT</title><style>body{font-family:monospace;padding:12px;width:280px}h3{margin:0 0 6px;text-align:center}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:4px 0;border-bottom:1px dashed #999;text-align:left}</style></head><body>' +
      '<h3>' + esc(title) + '</h3><div style="font-size:12px;margin-bottom:8px">' + esc(meta) + '</div>' +
      '<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (notes ? '<div style="font-size:12px;margin-top:8px">Notes: ' + esc(notes) + '</div>' : '') + '</body></html>';
  }
  window.kbPrint = function () {
    var items = cartItems(); if (!items.length) { alert('Add items before printing.'); return; }
    var pit = items.map(function (it) { return { name: it.productName, qty: it.quantity }; });
    openPrint(slip('KITCHEN ORDER TICKET', 'Type: ' + orderType + '   Table: ' + (($('kb-table') || {}).value || '-') + '\n' + new Date().toLocaleString(), pit, ($('kb-instr') || {}).value || ''));
  };
  window.kbPrintKot = function (id) {
    var o = orders[id]; if (!o) { alert('Order not found.'); return; }
    openPrint(slip('KOT #' + o.num, 'Table: ' + o.table + '   ' + o.time, o.items, ''));
  };

  // ---- init: read embedded server data, prime a resumed draft ----
  (function init() {
    var el = $('kb-data');
    if (el) {
      try { orders = JSON.parse(el.getAttribute('data-orders') || '{}'); } catch (e) { orders = {}; }
      loadedDraftId = el.getAttribute('data-draftid') || '';
      var dl = [];
      try { dl = JSON.parse(el.getAttribute('data-draftload') || '[]'); } catch (e) { dl = []; }
      if (dl.length) {
        dl.forEach(function (it) { cart[it.productId] = { id: it.productId, name: it.productName, price: menuPrice(it.productId), qty: Number(it.quantity) || 1 }; });
        var b = $('kb-badge'); if (b && loadedDraftId) b.textContent = 'Editing Draft';
        var dt = el.getAttribute('data-drafttable'); if (dt && $('kb-table')) $('kb-table').value = dt;
        var dty = el.getAttribute('data-drafttype'); if (dty) setOrderType(dty);
        var di = el.getAttribute('data-draftinstr'); if (di && $('kb-instr')) $('kb-instr').value = di;
      }
    }
    render();
  })();
})();
