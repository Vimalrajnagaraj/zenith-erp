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
    // ZE-CONTACTS-SEARCH: the custom "Filters" button (All Contacts) proxy-opens the framework Find Options dialog.
    // Prefer the element we've already marked+hidden (.sup-fo-native); fall back to a text match. .click() fires even
    // on a display:none element, so the hidden native trigger still toggles the Bootstrap modal / Quasar q-dialog.
    var fBtn = tgt && tgt.closest ? tgt.closest('.sup-filters-btn') : null;
    if (fBtn) {
      e.preventDefault();
      var fo = document.querySelector('.sup-fo-native');
      if (!fo) {
        var fc = document.querySelectorAll('button, a, .q-btn');
        for (var fi = 0; fi < fc.length; fi++) { var ft = (fc[fi].textContent || '').replace(/\s+/g, ' ').trim(); if (ft.indexOf('Find Options') !== -1 && ft.length < 40) { fo = fc[fi]; break; } }
      }
      if (fo) fo.click();
      return;
    }
    // ZE-CG-EDIT: Active toggle — flip the visual switch AND sync the hidden isActive field so the form always submits Y/N.
    var cgTog = tgt && tgt.closest ? tgt.closest('.cg-toggle') : null;
    if (cgTog) {
      var cgSw = cgTog.querySelector('.cg-toggle-sw'), cgLbl = cgTog.querySelector('.cg-toggle-lbl');
      var cgOn = cgSw ? cgSw.classList.toggle('on') : false;
      if (cgLbl) cgLbl.textContent = cgOn ? 'Yes' : 'No';
      var cgFrm = cgTog.closest('form'), cgHid = cgFrm ? cgFrm.querySelector('[name="isActive"]') : null;
      if (cgHid) { cgHid.value = cgOn ? 'Y' : 'N'; try { cgHid.dispatchEvent(new Event('change', { bubbles: true })); } catch (er) {} }
      return;
    }
    // ZE-CUST-FINAL: "+ New Customer" dropdown (Customers list) — toggle the menu; a menu item proxies its click to
    // the real (hidden) create-dialog trigger, which opens the Bootstrap modal (/apps) or the q-dialog (/qapps).
    var ncTrig = tgt && tgt.closest ? tgt.closest('.cust-nc-trigger') : null;
    if (ncTrig) { e.preventDefault(); var ncw = ncTrig.closest('.cust-newcust'); if (ncw) ncw.classList.toggle('open'); return; }
    var ncItem = tgt && tgt.closest ? tgt.closest('.cust-nc-item, .cust-nc-solo') : null;
    if (ncItem) {
      e.preventDefault();
      var ncw2 = ncItem.closest('.cust-newcust'); if (ncw2) ncw2.classList.remove('open');
      // container-dialog IGNORES button-class on BOTH surfaces, so match the real trigger (/apps <button data-target>,
      // /qapps .q-btn) by its button text within the hidden .cust-nc-src wrapper, then click it to open the dialog.
      // data-nctext lets a single-action CTA (e.g. Add Group) name its trigger; dropdown items fall back to the class.
      var ncLbl = ncItem.getAttribute('data-nctext') || (ncItem.classList.contains('cust-nc-org') ? 'Add Company' : 'Add Person');
      var ncReal = null, ncCand = document.querySelectorAll('.cust-nc-src button, .cust-nc-src .q-btn');
      for (var nci = 0; nci < ncCand.length; nci++) {
        if ((ncCand[nci].innerText || '').replace(/\s+/g, ' ').indexOf(ncLbl) !== -1) { ncReal = ncCand[nci]; break; }
      }
      if (ncReal) ncReal.click();
      setTimeout(cgPlaceholders, 450);  // the create dialog just opened — seed field placeholders (attr is a no-op here)
      return;
    }
    if (!(tgt && tgt.closest && tgt.closest('.cust-newcust'))) {
      var ncOpen = document.querySelectorAll('.cust-newcust.open');
      for (var nk = 0; nk < ncOpen.length; nk++) ncOpen[nk].classList.remove('open');
    }
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

  // ZE-CG-ADD: seed placeholders on the "Add Customer Group" form (Moqui <text-line placeholder> is a no-op in this
  // build). Runs on load (/apps: inputs pre-exist in the hidden modal) + after the dialog opens (/qapps: portaled).
  function cgPlaceholders() {
    var m = { groupName: 'Enter group name', defaultDiscountPercent: 'Enter percentage', creditTermDays: 'Enter credit term in days', creditLimitDefault: 'Enter credit limit', paymentTerms: 'e.g. Net 30, Immediate', description: 'Enter description (optional)' };
    var forms = document.querySelectorAll('form[name="CreateGroupForm"], form[name="GroupForm"]');
    for (var f = 0; f < forms.length; f++) {
      for (var k in m) { var el = forms[f].querySelector('[name="' + k + '"]'); if (el && !el.getAttribute('placeholder')) el.setAttribute('placeholder', m[k]); }
    }
  }
  // ZE-CG-EDIT: on /apps, replace the isActive Y/N <drop-down> with a purple toggle switch synced to the select (the
  // select stays the REAL submitting control, so Active saves correctly). /qapps keeps the dropdown (safe q-select).
  function cgActiveToggle() {
    if (!document.getElementById('content')) return;  // /apps only (Bootstrap page)
    var sels = document.querySelectorAll('form[name="GroupForm"] select[name="isActive"]');
    for (var i = 0; i < sels.length; i++) {
      var sel = sels[i];
      if (sel.getAttribute('data-cgtog')) continue;
      sel.setAttribute('data-cgtog', '1');
      var on = sel.value !== 'N';
      var tog = document.createElement('span');
      tog.className = 'cg-toggle';
      tog.innerHTML = '<span class="cg-toggle-sw' + (on ? ' on' : '') + '"></span><span class="cg-toggle-lbl">' + (on ? 'Yes' : 'No') + '</span>';
      sel.style.display = 'none';
      var s2 = sel.parentNode.querySelector('.select2-container'); if (s2) s2.style.display = 'none';
      var fg = sel.closest('.form-group'), lb = fg ? fg.querySelector('label') : null; if (lb) lb.style.display = 'none';
      sel.parentNode.appendChild(tog);
    }
  }
  // ZE-CONTACTS-SEARCH: on any list that ships the custom "Filters" button (currently All Contacts), hide the
  // framework's own "Find Options" trigger so there's a single filters entry point. Scoped by .sup-filters-btn so it
  // never touches Find Options on other list screens. Marked (not removed) so the Filters proxy can still click it.
  function hideNativeFindOpts() {
    if (!document.querySelector('.sup-filters-btn')) return;
    var cand = document.querySelectorAll('button, a, .q-btn');
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i];
      if (c.classList.contains('sup-filters-btn') || c.classList.contains('sup-fo-native')) continue;
      var t = (c.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.indexOf('Find Options') !== -1 && t.length < 40) c.classList.add('sup-fo-native');
    }
  }
  function cgInit() { cgPlaceholders(); cgActiveToggle(); hideNativeFindOpts(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cgInit); else cgInit();
  // /qapps renders screens AFTER DOMContentLoaded (async SPA transclude), so a load-time call is too early — re-run
  // when the DOM settles (idempotent; guarded by data-cgtog and the existing-placeholder check).
  if (window.MutationObserver) { var _cgT; new MutationObserver(function () { clearTimeout(_cgT); _cgT = setTimeout(cgInit, 200); }).observe(document.documentElement, { childList: true, subtree: true }); }
})();
