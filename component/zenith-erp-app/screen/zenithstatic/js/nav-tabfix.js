/* ============================================================================
 * ZetaERP /qapps left-nav keyboard accessibility  (IV-121 + follow-up)
 * ----------------------------------------------------------------------------
 * Each nav row is a Quasar q-expansion-item: an item anchor (navigates via `:to`)
 * plus a SEPARATE expand/collapse chevron (both focusable). This script makes the
 * nav keyboard-accessible without duplicate tab stops or losing collapse control:
 *
 *  1. TAB — the chevron toggle is taken OUT of the tab order (tabindex=-1) so each
 *     item is a SINGLE tab stop (IV-121). The chevron stays mouse-clickable.
 *  2. ARROW KEYS on a focused item (the collapse/expand a keyboard user otherwise
 *     lost when we removed the chevron tab stop):
 *        Down / Up      -> move focus to next / previous VISIBLE item
 *        Right          -> expand the item (if collapsed)
 *        Left           -> collapse the item (if expanded)
 *        Home / End     -> first / last visible item
 *  3. aria-expanded on each expandable item reflects its state, and the now-
 *     decorative chevron is aria-hidden, so screen readers announce it correctly.
 *
 * The item is kept as a normal tab stop (we do NOT switch to a roving-tabindex
 * role="tree" — that would change how every keyboard user reaches the menu on a
 * live system; Tab-through-items is stable and familiar, and arrow keys add the
 * tree behaviour on top). The SPA rebuilds the drawer on each navigation, so a
 * MutationObserver re-applies the tabindex/aria state. /apps has no such drawer.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__zNavTabFix) return;
  window.__zNavTabFix = 1;
  if (location.pathname.indexOf('/qapps/') !== 0) return;   // the expansion-tree drawer is /qapps only

  var DRAWER = '.q-drawer-container';
  var ITEM = 'a.q-item[role="listitem"], .q-item[role="listitem"]';   // the nav item (navigates)
  var CHEV = '[role="button"].q-focusable';                           // the separate chevron toggle

  function expOf(item) { return item.closest('.q-expansion-item'); }
  function chevOf(item) { return item.querySelector(CHEV); }
  function isExpandable(item) { return !!chevOf(item); }
  function isExpanded(item) { var e = expOf(item); return !!(e && e.classList.contains('q-expansion-item--expanded')); }

  // keep chevrons out of the tab order + decorative; mirror expand state onto the item for screen readers
  function sync() {
    var d = document.querySelector(DRAWER); if (!d) return;
    var chevs = d.querySelectorAll('.q-expansion-item ' + CHEV);
    for (var i = 0; i < chevs.length; i++) {
      if (chevs[i].getAttribute('tabindex') !== '-1') chevs[i].setAttribute('tabindex', '-1');
      chevs[i].setAttribute('aria-hidden', 'true');
    }
    var items = d.querySelectorAll(ITEM);
    for (var j = 0; j < items.length; j++) {
      if (chevOf(items[j])) items[j].setAttribute('aria-expanded', isExpanded(items[j]) ? 'true' : 'false');
    }
  }

  // visible nav items in DOM order (collapsed children are display:none -> offsetParent null -> skipped)
  function visibleItems() {
    var d = document.querySelector(DRAWER); if (!d) return [];
    return Array.prototype.filter.call(d.querySelectorAll(ITEM), function (el) { return el.offsetParent !== null; });
  }

  function toggle(item) {
    var c = chevOf(item);
    if (c) { c.click(); setTimeout(function () { try { item.focus(); } catch (e) {} sync(); }, 30); }
  }

  function onKey(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    if (!(e.target.closest && e.target.closest(DRAWER))) return;
    var item = e.target.closest(ITEM);
    if (!item) return;
    var list = visibleItems();
    var idx = list.indexOf(item);
    if (e.key === 'ArrowDown') { if (idx >= 0 && list[idx + 1]) list[idx + 1].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { if (idx > 0) list[idx - 1].focus(); e.preventDefault(); }
    else if (e.key === 'Home') { if (list[0]) list[0].focus(); e.preventDefault(); }
    else if (e.key === 'End') { if (list.length) list[list.length - 1].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { if (isExpandable(item) && !isExpanded(item)) toggle(item); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { if (isExpandable(item) && isExpanded(item)) toggle(item); e.preventDefault(); }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(function () { scheduled = false; sync(); }, 0);
  }

  var tries = 0;
  function init() {
    var d = document.querySelector(DRAWER);
    if (!d) { if (++tries < 40) setTimeout(init, 400); return; }
    sync();
    d.addEventListener('keydown', onKey, true);   // capture: handle arrows before anything else
    new MutationObserver(schedule).observe(d, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex', 'role', 'class']
    });
  }
  init();
})();
