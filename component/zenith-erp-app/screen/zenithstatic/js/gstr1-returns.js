/* GST Returns (GSTR-1) screen logic. External (loaded via <img onload>) so bare '<' in the
   pagination is safe on /qapps. Generate POSTs to the unchanged generateGstr1 transition;
   client-side paginates the Saved Filings table; toggles the Guide help. Re-callable via __gstr1Init. */
(function () {
  var state = { page: 1, perPage: 10 };

  function appBase() { var p = location.pathname || ''; var i = p.indexOf('/zenith/'); return i > 0 ? p.substring(0, i) : ''; }
  function tok() { try { return window.moqui.webrootVue.moquiSessionToken; } catch (e) { return ''; } }

  function generate() {
    var per = (document.getElementById('gstr1-period') || {}).value || '';
    var fy = (document.getElementById('gstr1-fy') || {}).value || '';
    if (!per) { alert('Select a return period first.'); return; }
    ['gstr1-gen', 'gstr1-gen-hdr'].forEach(function (id) { var b = document.getElementById(id); if (b) { b.disabled = true; } });
    var g = document.getElementById('gstr1-gen'); if (g) g.textContent = 'Generating...';
    var body = new URLSearchParams({ returnPeriod: per, financialYear: fy, moquiSessionToken: tok() });
    fetch(appBase() + '/zenith/tax/Gstr1Returns/generateGstr1', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' })
      .then(function () { location.reload(); })
      .catch(function () { location.reload(); });
  }

  function rows() { return Array.prototype.slice.call(document.querySelectorAll('#gstr1-tbody .gstr1-row')); }
  function paginate() {
    var rs = rows(); var total = rs.length; var pp = state.perPage;
    var tp = Math.max(1, Math.ceil(total / pp)); if (state.page > tp) state.page = tp;
    var start = (state.page - 1) * pp, end = Math.min(total, start + pp);
    rs.forEach(function (tr, i) { tr.style.display = (i >= start && i < end) ? '' : 'none'; });
    var sh = document.getElementById('gstr1-showing');
    if (sh) sh.textContent = total === 0 ? 'No entries' : ('Showing ' + (start + 1) + ' to ' + end + ' of ' + total + ' entries');
    var pager = document.getElementById('gstr1-pager'); if (!pager) return;
    pager.innerHTML = '';
    function btn(html, disabled, active, go) {
      var b = document.createElement('button'); b.innerHTML = html;
      b.style.cssText = 'min-width:32px;height:32px;padding:0 8px;border-radius:8px;font-size:13px;cursor:pointer;'
        + (active ? 'background:#7C3AED;color:#fff;border:1px solid #7C3AED;' : 'background:#fff;color:#6B7280;border:1px solid #E5E7EB;')
        + (disabled ? 'opacity:.4;cursor:default;' : '');
      if (!disabled && !active && go != null) b.addEventListener('click', function () { state.page = go; paginate(); });
      return b;
    }
    pager.appendChild(btn('&#124;&lt;', state.page <= 1, false, 1));
    pager.appendChild(btn('&lsaquo;', state.page <= 1, false, state.page - 1));
    pager.appendChild(btn(String(state.page), false, true, null));
    pager.appendChild(btn('&rsaquo;', state.page >= tp, false, state.page + 1));
    pager.appendChild(btn('&gt;&#124;', state.page >= tp, false, tp));
  }

  function init() {
    ['gstr1-gen', 'gstr1-gen-hdr'].forEach(function (id) { var b = document.getElementById(id); if (b && !b.__w) { b.__w = 1; b.addEventListener('click', generate); } });
    var gb = document.getElementById('gstr1-guide-btn');
    if (gb && !gb.__w) { gb.__w = 1; gb.addEventListener('click', function () { var d = document.getElementById('gstr1-guide'); if (d) { d.open = !d.open; if (d.open) d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }); }
    var ps = document.getElementById('gstr1-perpage');
    if (ps && !ps.__w) { ps.__w = 1; ps.addEventListener('change', function () { state.perPage = parseInt(ps.value, 10) || 10; state.page = 1; paginate(); }); }
    if (ps) state.perPage = parseInt(ps.value, 10) || 10;
    state.page = 1;
    if (document.getElementById('gstr1-tbody')) paginate();
  }

  window.__gstr1Init = init;
  init();
})();
