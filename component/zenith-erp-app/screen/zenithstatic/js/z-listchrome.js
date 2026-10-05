/* z-listchrome.js — mockup-style toolbar + pagination footer for native Moqui form-lists.
 *
 * OPT-IN: only acts on a form-list card carrying class `z-listchrome` (+ optional
 * data-zlc-ph="placeholder"). No-ops everywhere else, so it is safe to load globally
 * via footer_scripts (runs on BOTH /apps Bootstrap and /qapps Quasar surfaces).
 *
 * It HIDES the native nav row (`tr.form-list-nav-row`, present on both surfaces) and
 * injects: a Search box (client-side filter) + Columns/Saved Finds/CSV buttons (proxy-
 * click the hidden native controls) + Reset; and a footer "Showing X to Y of N entries"
 * + per-page + first/prev/[page]/next/last (arrows proxy the native pagination).
 *
 * GRACEFUL DEGRADATION: the CSS hides native chrome only once this script adds the
 * `zlc-on` class — so if the script errors, the native toolbar stays usable.
 */
(function () {
  'use strict';
  var DEFAULT_SIZE = 10; // sensible page size (matches the mockup's "10 per page")
  function qa(root, sel) { try { return Array.prototype.slice.call(root.querySelectorAll(sel)); } catch (e) { return []; } }
  function txt(el) { return ((el && (el.innerText || el.textContent || el.getAttribute && (el.getAttribute('aria-label') || el.title))) || '').trim(); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function ico(name) { return '<span class="material-icons">' + name + '</span>'; }

  // numbers may be thousands-grouped on /apps (e.g. "1,219" via the app-wide Indian number formatter),
  // so capture digit-runs WITH commas and strip them before parsing (bare \d+ stopped at the comma -> total 1).
  var COUNT_RE = /([\d,]+)\s*-\s*([\d,]+)\s*(?:\/|of)\s*([\d,]+)/i; // "1 - 2 of 2" or "1-10 of 1,219"
  var PAGE_RE = /(?:page\s+)?([\d,]+)\s*(?:of|\/)\s*([\d,]+)/i;     // "Page 1 of 122" or "1 / 122"
  function toNum(s) { return parseInt(String(s).replace(/[,\s]/g, ''), 10) || 0; }

  function rowsOf(card) {
    if (card.querySelector('.q-table')) return qa(card, '.q-table .tbody > .tr'); // /qapps div-table
    return qa(card, 'table > tbody > tr');                                        // /apps real table
  }

  // Find a native control (within the hidden nav row) whose label matches re.
  function nativeCtl(card, re) {
    var ctls = qa(card, 'tr.form-list-nav-row .q-btn, tr.form-list-nav-row button, tr.form-list-nav-row a.btn, tr.form-list-nav-row a');
    for (var i = 0; i < ctls.length; i++) { if (re.test(txt(ctls[i]))) return ctls[i]; }
    return null;
  }

  // The native pagination arrows + counts (first/prev/next/last), both surfaces.
  function pager(card) {
    var p = { first: null, prev: null, next: null, last: null, en: {}, start: 0, end: 0, total: 0, page: 1, pages: 1 };
    var ul = card.querySelector('tr.form-list-nav-row ul.pagination'); // /apps
    if (ul) {
      var lis = qa(ul, ':scope > li');
      function clk(li) { return li ? li.querySelector('a') : null; } // <a>=enabled, <span>=disabled
      if (lis.length >= 5) {
        p.first = clk(lis[0]); p.prev = clk(lis[1]); p.next = clk(lis[lis.length - 2]); p.last = clk(lis[lis.length - 1]);
      }
    } else {
      var qp = card.querySelector('tr.form-list-nav-row .q-pagination'); // /qapps
      if (qp) {
        var btns = qa(qp, '.q-btn');
        function byIcon(name) { for (var i = 0; i < btns.length; i++) { if ((btns[i].innerText || '').indexOf(name) >= 0) { return btns[i].hasAttribute('disabled') || /disabled/.test(btns[i].className) ? null : btns[i]; } } return null; }
        p.first = byIcon('skip_previous'); p.prev = byIcon('fast_rewind'); p.next = byIcon('fast_forward'); p.last = byIcon('skip_next');
      }
    }
    p.en.first = !!p.first; p.en.prev = !!p.prev; p.en.next = !!p.next; p.en.last = !!p.last;
    // counts: scan the nav row for the "(a-b of/ n)" text + "page x of y"
    var navTxt = '';
    qa(card, 'tr.form-list-nav-row').forEach(function (nr) { navTxt += ' ' + txt(nr); });
    var m = COUNT_RE.exec(navTxt); if (m) { p.start = toNum(m[1]); p.end = toNum(m[2]); p.total = toNum(m[3]); }
    var pm = PAGE_RE.exec(navTxt); if (pm) { p.page = toNum(pm[1]); p.pages = toNum(pm[2]); }
    return p;
  }

  function buildToolbar(card) {
    var phEl = card.querySelector('.zlc-ph');
    var ph = (phEl && phEl.getAttribute('data-ph')) || card.getAttribute('data-zlc-ph') || 'Search…';
    var tb = mk('div', 'zlc-toolbar');
    var search = mk('div', 'zlc-search', ico('search') + '<input type="text" placeholder="' + ph.replace(/"/g, '&quot;') + '" aria-label="Search">');
    tb.appendChild(search);
    var defs = [
      { act: 'columns', re: /Columns/i, icon: 'view_column', label: 'Columns' },
      { act: 'saved', re: /Saved\s*Finds/i, icon: 'bookmark_border', label: 'Saved Finds' },
      { act: 'csv', re: /^CSV/i, icon: 'file_download', label: 'CSV' }
    ];
    defs.forEach(function (d) {
      var nat = nativeCtl(card, d.re) || (d.act === 'saved' ? nativeCtl(card, /Find\s*Options/i) : null);
      if (!nat) return; // no native control on this surface → omit the button
      var b = mk('button', 'zlc-btn', ico(d.icon) + d.label); b.type = 'button';
      b.addEventListener('click', function () { try { nat.click(); } catch (e) {} });
      tb.appendChild(b);
    });
    var reset = mk('button', 'zlc-btn zlc-reset', ico('refresh') + 'Reset'); reset.type = 'button';
    reset.addEventListener('click', function () { try { location.href = location.pathname; } catch (e) {} });
    tb.appendChild(reset);

    // client-side filter
    var input = search.querySelector('input');
    input.addEventListener('input', function () {
      var q = (input.value || '').toLowerCase().trim();
      var rows = rowsOf(card), shown = 0;
      rows.forEach(function (r) {
        var hit = !q || (r.textContent || '').toLowerCase().indexOf(q) >= 0;
        r.style.display = hit ? '' : 'none'; if (hit) shown++;
      });
      updateFoot(card, q ? shown : null);
    });
    return tb;
  }

  function buildFoot(card) {
    var p = pager(card);
    var foot = mk('div', 'zlc-foot');
    var left = mk('div', 'zlc-foot-left');
    foot.appendChild(left);
    var right = mk('div', 'zlc-foot-right');
    // per-page select (navigates with pageSize; best-effort — tiny master lists fit one page)
    var pp = mk('select', 'zlc-pp');
    // Reflect the REAL page size: when more than one page exists it is (end-start+1); otherwise fall back to
    // the ?pageSize= param, else the mockup default (10). Moqui persists the chosen size per user per form.
    var detected = (p.total > p.end && p.end >= p.start) ? (p.end - p.start + 1) : 0;
    var urlSize = (function () { try { var m = /[?&]pageSize=(\d+)/.exec(location.search); return m ? +m[1] : 0; } catch (e) { return 0; } })();
    var sel = detected || urlSize || DEFAULT_SIZE;
    var sizes = [10, 25, 50, 100];
    if (sizes.indexOf(sel) < 0) sizes.push(sel);
    sizes.sort(function (a, b) { return a - b; });
    sizes.forEach(function (n) { var o = mk('option', null, n + ' per page'); o.value = n; pp.appendChild(o); });
    pp.value = String(sel);
    pp.addEventListener('change', function () {
      try { var u = new URL(location.href); u.searchParams.set('pageSize', pp.value); u.searchParams.delete('pageIndex'); location.href = u.toString(); } catch (e) {}
    });
    right.appendChild(pp);
    var arrows = [['first', 'first_page'], ['prev', 'chevron_left'], ['__page', ''], ['next', 'chevron_right'], ['last', 'last_page']];
    arrows.forEach(function (a) {
      if (a[0] === '__page') { var chip = mk('span', 'zlc-page', String(p.page)); chip.setAttribute('data-zlc', 'page'); right.appendChild(chip); return; }
      var nat = p[a[0]], b = mk('button', 'zlc-pg' + (p.en[a[0]] ? '' : ' zlc-dis'), ico(a[1])); b.type = 'button';
      if (p.en[a[0]]) b.addEventListener('click', function () { try { nat.click(); } catch (e) {} });
      right.appendChild(b);
    });
    foot.appendChild(right);
    card.__zlcFoot = foot;
    updateFoot(card, null);
    return foot;
  }

  function updateFoot(card, visibleOverride) {
    var foot = card.__zlcFoot; if (!foot) return;
    var left = foot.querySelector('.zlc-foot-left'); if (!left) return;
    var p = pager(card);
    if (visibleOverride != null) { left.textContent = 'Showing ' + visibleOverride + ' of ' + (p.total || visibleOverride) + ' entries'; }
    else if (p.total) { left.textContent = 'Showing ' + p.start + ' to ' + p.end + ' of ' + p.total + ' entries'; }
    else { var n = rowsOf(card).length; left.textContent = 'Showing ' + n + ' ' + (n === 1 ? 'entry' : 'entries'); }
    var chip = foot.querySelector('[data-zlc="page"]'); if (chip && p.page) chip.textContent = String(p.page);
  }

  function enhance(card) {
    if (!card || card.__zlc) return;
    if (!card.querySelector('tr.form-list-nav-row')) return; // native chrome not rendered yet
    // Self-heal a stale/tiny persisted page size (Moqui remembers pageSize per user): if more rows exist
    // than are shown and the page is below the sensible default — and the URL doesn't already pin a size —
    // bump to the default ONCE. Moqui persists it, so a no-param load thereafter is already correct and
    // this never fires again (also loop-safe: after the redirect the URL carries pageSize).
    try {
      var hasParam = /[?&]pageSize=\d+/.test(location.search);
      if (!hasParam) {
        var p0 = pager(card), shown0 = rowsOf(card).length;
        if (shown0 > 0 && p0.total > shown0 && shown0 < DEFAULT_SIZE) {
          card.__zlc = 1;
          var uu = new URL(location.href); uu.searchParams.set('pageSize', DEFAULT_SIZE); uu.searchParams.delete('pageIndex');
          location.replace(uu.toString());
          return;
        }
      }
    } catch (e) {}
    card.__zlc = 1;
    try {
      var tb = buildToolbar(card);
      var foot = buildFoot(card);
      // Place the toolbar just above the list's rendered root and the footer just below it, so the chrome
      // lands tightly around the table even when the card holds other content (a title/banner, or a
      // container-box's box-header/box-toolbar sitting above a box-body list).
      var root = listRoot(card);
      if (root && root.parentElement) {
        root.parentElement.insertBefore(tb, root);
        if (root.nextSibling) root.parentElement.insertBefore(foot, root.nextSibling); else root.parentElement.appendChild(foot);
      } else {
        card.insertBefore(tb, card.firstChild); card.appendChild(foot);
      }
      card.classList.add('zlc-on'); // triggers the CSS that hides native chrome
    } catch (e) { card.__zlc = 0; /* leave native chrome visible on failure */ }
  }

  function listRoot(card) {
    var nav = card.querySelector('tr.form-list-nav-row'); if (!nav) return null;
    var el = nav; while (el.parentElement && el.parentElement !== card) el = el.parentElement;
    return el; // the direct child of the card that contains the form-list's nav row (= its table root)
  }
  // Derive the card from each placeholder marker (its nearest ancestor containing a form-list nav row) and
  // tag it — so a screen only needs the marker beside its list, and this works for plain cards AND
  // container-box (box-body) layouts without the markup declaring which element is the card.
  function tagFromMarkers() {
    qa(document, '.zlc-ph').forEach(function (m) {
      if (m.__zlcTag) return;
      var el = m.parentElement, card = null;
      while (el) { try { if (el.querySelector('tr.form-list-nav-row')) { card = el; break; } } catch (e) {} el = el.parentElement; }
      if (card) { m.__zlcTag = 1; if (!card.classList.contains('z-listchrome')) card.classList.add('z-listchrome'); }
    });
  }
  function scan() { tagFromMarkers(); qa(document, '.z-listchrome:not(.zlc-on)').forEach(enhance); }

  function boot() {
    scan();
    // /qapps renders async + is an SPA → watch for late/added form-list cards
    try {
      var mo = new MutationObserver(function () { clearTimeout(boot._t); boot._t = setTimeout(scan, 120); });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    var n = 0, iv = setInterval(function () { scan(); if (++n > 12) clearInterval(iv); }, 500); // retries while q-table paints
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
