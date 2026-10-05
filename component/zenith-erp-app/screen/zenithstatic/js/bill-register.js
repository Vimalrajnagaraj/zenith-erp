/* Bill Register (POS) — client-side pagination, column chooser, custom-range apply.
   Loaded via an <img onload> bootstrap so it runs on BOTH /apps and /qapps
   (/qapps strips inline <script>, but a dynamically-appended <script src> runs).
   Self-contained: derives appBase + viewMode from the URL. Idempotent per table. */
(function () {
  var state = { page: 1, perPage: 10 };

  function pageList(cur, tp) {
    var out = [], i;
    if (tp <= 7) { for (i = 1; i <= tp; i++) out.push(i); return out; }
    out.push(1);
    var lo = Math.max(2, cur - 1), hi = Math.min(tp - 1, cur + 1);
    if (cur <= 3) { lo = 2; hi = 5; }
    if (cur >= tp - 2) { lo = tp - 4; hi = tp - 1; }
    if (lo > 2) out.push('...');
    for (i = lo; i <= hi; i++) out.push(i);
    if (hi < tp - 1) out.push('...');
    out.push(tp);
    return out;
  }

  function paginate() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#br-tbody .br-row'));
    var total = rows.length;
    var perPage = state.perPage;
    var tp = Math.max(1, Math.ceil(total / perPage));
    if (state.page > tp) state.page = tp;
    var page = state.page;
    var start = (page - 1) * perPage, end = Math.min(total, start + perPage);
    rows.forEach(function (tr, i) { tr.style.display = (i >= start && i < end) ? '' : 'none'; });

    var showing = document.getElementById('br-showing');
    if (showing) showing.innerHTML = total === 0 ? 'No numbers' :
      ('Showing ' + (start + 1) + ' &ndash; ' + end + ' of <b style="color:#111827">' + total + '</b> numbers');

    var pager = document.getElementById('br-pager');
    if (!pager) return;
    pager.innerHTML = '';
    function btn(html, disabled, active, go) {
      var b = document.createElement('button');
      b.innerHTML = html;
      b.style.cssText = 'min-width:28px;height:28px;padding:0 7px;border-radius:8px;font-size:12.5px;cursor:pointer;'
        + (active ? 'background:#7C3AED;color:#fff;border:1px solid #7C3AED;' : 'background:#fff;color:#6B7280;border:1px solid #E5E7EB;')
        + (disabled ? 'opacity:.4;cursor:default;' : '');
      if (!disabled && !active && go != null) b.addEventListener('click', function () { state.page = go; paginate(); });
      return b;
    }
    pager.appendChild(btn('<span class="material-icons" style="font-size:16px;vertical-align:middle">chevron_left</span>', page <= 1, false, page - 1));
    pageList(page, tp).forEach(function (p) {
      if (p === '...') { var s = document.createElement('span'); s.textContent = '…'; s.style.cssText = 'color:#9CA3AF;padding:0 4px'; pager.appendChild(s); }
      else pager.appendChild(btn(String(p), false, p === page, p));
    });
    pager.appendChild(btn('<span class="material-icons" style="font-size:16px;vertical-align:middle">chevron_right</span>', page >= tp, false, page + 1));
  }

  function init() {
    var tbody = document.getElementById('br-tbody');
    if (!tbody) return;
    state.page = 1;
    state.perPage = 10;
    if (tbody.getAttribute('data-brwired') === '1') { paginate(); return; }
    tbody.setAttribute('data-brwired', '1');

    var path = location.pathname || '';
    var zi = path.indexOf('/zenith/');
    var appBase = zi > 0 ? path.substring(0, zi) : '';
    var viewMode = 'all';
    try { viewMode = new URLSearchParams(location.search || '').get('viewMode') || 'all'; } catch (e) {}

    var ab = document.getElementById('br-apply');
    if (ab) ab.addEventListener('click', function () {
      var f = document.getElementById('br-from'), t = document.getElementById('br-thru');
      location.href = appBase + '/zenith/pos/BillNumberRegister?period=custom&viewMode=' + encodeURIComponent(viewMode)
        + '&fromDate=' + encodeURIComponent((f && f.value) || '') + '&thruDate=' + encodeURIComponent((t && t.value) || '');
    });
    var cb = document.getElementById('br-customBtn');
    if (cb) cb.addEventListener('click', function () { var f = document.getElementById('br-from'); if (f) f.focus(); });

    var colsBtn = document.getElementById('br-colsBtn'), colsMenu = document.getElementById('br-colsMenu');
    if (colsBtn && colsMenu) {
      colsBtn.addEventListener('click', function (e) { e.stopPropagation(); colsMenu.style.display = (colsMenu.style.display === 'none' ? 'block' : 'none'); });
      document.addEventListener('click', function () { colsMenu.style.display = 'none'; });
      colsMenu.addEventListener('click', function (e) { e.stopPropagation(); });
      Array.prototype.forEach.call(document.querySelectorAll('.br-colchk'), function (ch) {
        ch.addEventListener('change', function () {
          var col = ch.getAttribute('data-col'), show = ch.checked;
          Array.prototype.forEach.call(document.querySelectorAll('[data-col="' + col + '"]'), function (cell) { cell.style.display = show ? '' : 'none'; });
        });
      });
    }

    var perSel = document.getElementById('br-perpage');
    if (perSel) perSel.addEventListener('change', function () { state.perPage = parseInt(perSel.value, 10) || 10; state.page = 1; paginate(); });

    paginate();
  }

  window.__brInit = init;
  init();
})();
