/* ZE-CONTACTS-EDIT-REDESIGN: tab switching for the redesigned EditContact form.
   A panel (field-group OR container-box) belongs to a tab if it has the class cpe-<tab>.
   Clicking a .cpe-tab[data-cpetab] shows all panels for that tab, hides the rest.
   Default (no JS) is handled by CSS: .cpe-panel:not(.cpe-profile){display:none}. Delegated on
   document so it survives the /qapps + /vapps SPA transclude (which strip inline <script>). */
(function () {
  if (window.__cpeTabs) return; window.__cpeTabs = 1;
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.cpe-tab') : null;
    if (!btn) return;
    var tab = btn.getAttribute('data-cpetab');
    if (!tab) return;
    e.preventDefault();
    var tabs = document.querySelectorAll('.cpe-tab');
    for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('on', tabs[i].getAttribute('data-cpetab') === tab); }
    var panels = document.querySelectorAll('.cpe-panel');
    for (var j = 0; j < panels.length; j++) { panels[j].style.display = panels[j].classList.contains('cpe-' + tab) ? 'block' : 'none'; }
  });
})();
