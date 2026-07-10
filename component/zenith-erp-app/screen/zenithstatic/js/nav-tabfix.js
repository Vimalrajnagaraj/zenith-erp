/* ============================================================================
 * ZetaERP /qapps nav keyboard-accessibility — de-duplicate tab stops (IV-121)
 * ----------------------------------------------------------------------------
 * Each left-nav module row is a Quasar q-expansion-item with `:to` (navigate) +
 * a SEPARATE expand/collapse chevron. Both are focusable, so Tab lands on every
 * menu item TWICE — once on the item (which navigates on Enter) and once on the
 * chevron toggle — a duplicate tab stop (ZE-INV-016 / IV-121).
 *
 * The item is the primary control (it navigates, and its branch auto-expands on
 * navigation — see the ZE-INV-012 collapse fix), so we keep IT as the single tab
 * stop and take the chevron OUT of the tab order (tabindex=-1). The chevron stays
 * MOUSE-clickable to collapse/expand; only its keyboard tab stop is removed.
 *
 * The /qapps SPA rebuilds the drawer tree on every navigation, and Quasar may
 * re-assign tabindex, so a MutationObserver re-applies the fix. /apps (Bootstrap)
 * has no q-expansion-item drawer, so this no-ops there.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__zNavTabFix) return;
  window.__zNavTabFix = 1;
  if (location.pathname.indexOf('/qapps/') !== 0) return;  // the expansion-tree drawer is /qapps only

  // the separate chevron toggle: a q-focusable role=button section inside a q-expansion-item
  var SEL = '.q-drawer-container .q-expansion-item [role="button"].q-focusable';

  function fix() {
    var t = document.querySelectorAll(SEL);
    for (var i = 0; i < t.length; i++) {
      if (t[i].getAttribute('tabindex') !== '-1') t[i].setAttribute('tabindex', '-1');
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(function () { scheduled = false; fix(); }, 0);
  }

  var tries = 0;
  function init() {
    var d = document.querySelector('.q-drawer-container');
    if (!d) { if (++tries < 40) setTimeout(init, 400); return; }
    fix();
    // coalesced re-apply on tree re-render / Quasar tabindex resets
    new MutationObserver(schedule).observe(d, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex', 'role', 'class']
    });
  }
  init();
})();
