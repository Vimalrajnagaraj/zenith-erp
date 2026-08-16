/* ZE-CONTACTS-PROFILE: tab switching for the redesigned Contact Profile (.cp-tab / .cp-panel).
   Head-loaded app-wide (delegated click on document) so it works on /apps AND the /qapps + /vapps SPAs,
   which strip inline <script>. Panels are matched to tabs by index within the same tab body. No-op on
   pages that have no .cp-tab. */
(function () {
  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest('.cp-tab') : null;
    if (!t) return;
    var idx = parseInt(t.getAttribute('data-idx'), 10);
    if (isNaN(idx)) return;
    var nav = t.parentElement;
    var tabs = nav ? nav.querySelectorAll('.cp-tab') : [];
    for (var i = 0; i < tabs.length; i++) {
      if (i === idx) { tabs[i].classList.add('active'); } else { tabs[i].classList.remove('active'); }
    }
    // The tab body is the .cp-tab-body nearest after the tabs-container. Fall back to the first on page.
    var body = null;
    var container = t.closest ? t.closest('.cp-tabs-container') : null;
    if (container) { var n = container.nextElementSibling;
      while (n && !(n.classList && n.classList.contains('cp-tab-body'))) { n = n.nextElementSibling; }
      body = n; }
    if (!body) body = document.querySelector('.cp-tab-body');
    if (!body) return;
    var panels = body.querySelectorAll('.cp-panel');
    for (var j = 0; j < panels.length; j++) {
      if (j === idx) { panels[j].classList.add('active'); } else { panels[j].classList.remove('active'); }
    }
  }
  document.addEventListener('click', onClick);
})();
