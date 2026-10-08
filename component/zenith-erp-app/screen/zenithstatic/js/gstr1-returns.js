/* GST Returns (GSTR-1) screen logic. External (loaded via <img onload>) so bare '<' in the
   pagination is safe on /qapps. Generate POSTs to the unchanged generateGstr1 transition;
   client-side paginates the Saved Filings table; toggles the Guide help. Re-callable via __gstr1Init. */
(function () {
  var state = { page: 1, perPage: 10 };

  function appBase() { var p = location.pathname || ''; var i = p.indexOf('/zenith/'); return i > 0 ? p.substring(0, i) : ''; }
  function syncYear() {
    var period = document.getElementById('gstr1-period'), year = document.getElementById('gstr1-fy');
    if (!period || !year) return;
    var value = period.value, start = Number(value.slice(2)) - (Number(value.slice(0,2)) < 4 ? 1 : 0);
    var fy = start + '-' + (start + 1);
    if (!Array.from(year.options).some(function (option) { return option.value === fy; })) year.add(new Option(fy, fy));
    year.value = fy;
  }
  function generate() {
    syncYear();
    var period = document.getElementById('gstr1-period'), fy = document.getElementById('gstr1-fy');
    if (!period || !period.value) return;
    var token = document.getElementById('gstr1-token');
    if (!token || !token.value) { alert('Your session is unavailable. Sign in and try again.'); return; }
    // Use the normal form navigation: Moqui renders validation errors and preserves the
    // generated filing redirect. Fetch+reload previously discarded both in Bootstrap.
    var form = document.createElement('form'); form.method = 'post';
    form.action = appBase() + '/zenith/tax/Gstr1Returns/generateGstr1';
    [['returnPeriod',period.value],['financialYear',fy.value],['moquiSessionToken',token.value]].forEach(function (pair) {
      var field=document.createElement('input'); field.type='hidden'; field.name=pair[0]; field.value=pair[1]; form.appendChild(field);
    });
    ['gstr1-gen','gstr1-gen-hdr'].forEach(function (id) { var button=document.getElementById(id); if(button) button.disabled=true; });
    document.body.appendChild(form); form.submit();
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
    function btn(html, disabled, active, go, label) {
      var b = document.createElement('button'); b.type = 'button'; b.innerHTML = html;
      b.setAttribute('aria-label', label);
      if (active) b.setAttribute('aria-current', 'page');
      b.style.cssText = 'min-width:32px;height:32px;padding:0 8px;border-radius:8px;font-size:13px;cursor:pointer;'
        + (active ? 'background:#7C3AED;color:#fff;border:1px solid #7C3AED;' : 'background:#fff;color:#6B7280;border:1px solid #E5E7EB;')
        + (disabled ? 'opacity:.4;cursor:default;' : '');
      b.disabled = disabled;
      if (!disabled && !active && go != null) b.addEventListener('click', function () { state.page = go; paginate(); });
      return b;
    }
    pager.appendChild(btn('&#124;&lt;', state.page <= 1, false, 1, 'First filing page'));
    pager.appendChild(btn('&lsaquo;', state.page <= 1, false, state.page - 1, 'Previous filing page'));
    pager.appendChild(btn(String(state.page), false, true, null, 'Page ' + state.page));
    pager.appendChild(btn('&rsaquo;', state.page >= tp, false, state.page + 1, 'Next filing page'));
    pager.appendChild(btn('&gt;&#124;', state.page >= tp, false, tp, 'Last filing page'));
  }

  function init() {
    var period=document.getElementById('gstr1-period');
    if(period && !period.dataset.ready) {period.dataset.ready='true';period.addEventListener('change',syncYear);}
    syncYear();
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
