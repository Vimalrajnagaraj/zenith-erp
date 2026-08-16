/* ZE-CONTACTS-EDIT-REDESIGN: tab switching for the redesigned EditContact form.
   A panel (field-group OR container-box) belongs to a tab if it has the class cpe-<tab>.
   Clicking a .cpe-tab[data-cpetab] shows all panels for that tab, hides the rest.
   Default (no JS) is handled by CSS: .cpe-panel:not(.cpe-profile){display:none}. Delegated on
   document so it survives the /qapps + /vapps SPA transclude (which strip inline <script>). */
(function () {
  if (window.__cpeTabs) return; window.__cpeTabs = 1;
  document.addEventListener('click', function (e) {
    var tgt = e.target;
    // Persistent action-bar Save: proxy the click to the real (hidden) submit inside ContactDetailForm,
    // so the profile form submits from any tab — including the read-only Orders / Contact-Info tabs.
    var sv = tgt && tgt.closest ? tgt.closest('[data-cpesave]') : null;
    if (sv) { e.preventDefault(); var real = document.getElementById('ContactDetailForm_submitButton'); if (real) real.click(); return; }
    var btn = tgt && tgt.closest ? tgt.closest('.cpe-tab') : null;
    if (!btn) return;
    var tab = btn.getAttribute('data-cpetab');
    if (!tab) return;
    e.preventDefault();
    var tabs = document.querySelectorAll('.cpe-tab');
    for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('on', tabs[i].getAttribute('data-cpetab') === tab); }
    var panels = document.querySelectorAll('.cpe-panel');
    for (var j = 0; j < panels.length; j++) {
      var show = panels[j].classList.contains('cpe-' + tab);
      panels[j].style.display = show ? (panels[j].classList.contains('cpe-grp') ? 'grid' : 'block') : 'none';
    }
    cpeColorBen();  /* re-colour after a tab switch — on /qapps the Banking q-select only exists post-transclude */
  });

  /* Beneficiary Status pill: colour the editable status control by its current value (Pending=amber,
     Verified=green, Rejected=muted) so it reads as a compact status pill while staying fully functional.
     The value-class is stamped on the native <select> AND its visible framework widget: /apps = the adjacent
     Select2 container (styled via CSS sibling selector); /qapps = the enclosing Quasar q-field. */
  function cpeColorBen() {
    var sels = document.querySelectorAll('select[name="bankBeneficiaryStatus"]');
    for (var i = 0; i < sels.length; i++) {
      var s = sels[i], v = (s.value || '').toLowerCase(), cls = v ? 'cpe-bs-' + v : 'cpe-bs-none';
      var targets = [s];
      var qf = s.closest ? s.closest('.q-field') : null; if (qf) targets.push(qf);
      for (var t = 0; t < targets.length; t++) {
        var el = targets[t];
        el.classList.add('cpe-bs');
        el.classList.remove('cpe-bs-pending', 'cpe-bs-verified', 'cpe-bs-rejected', 'cpe-bs-none');
        el.classList.add(cls);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cpeColorBen); else cpeColorBen();
  document.addEventListener('change', function (e) {
    if (e.target && e.target.matches && e.target.matches('select[name="bankBeneficiaryStatus"]')) cpeColorBen();
  });
})();
