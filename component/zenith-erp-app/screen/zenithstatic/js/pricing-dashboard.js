/* Reserve the measured wrapped header only while an Pricing Dashboard screen is rendered. */
(function () {
  function start() {
    if (!document.body || window.zprdHeaderObserver) return;
    window.zprdHeaderObserver = true;
    var watchedHeader = null, headerObserver = null, pending = false;
    function sync() {
        pending = false;
        document.body.classList.toggle('zprd-module', /^\/(?:apps|qapps)\/zenith\/pricing(?:\/|$)/.test(location.pathname));
        var header = document.querySelector('.q-header');
        if (header !== watchedHeader) {
            if (headerObserver) headerObserver.disconnect();
            watchedHeader = header;
            if (header && window.ResizeObserver) {
                headerObserver = new ResizeObserver(schedule);
                headerObserver.observe(header);
            }
        }
        if (header && document.querySelector('.zprd-page')) {
            document.body.style.setProperty('--zq-prd-header-height', (header.offsetHeight || 51) + 'px');
        } else {
            document.body.style.removeProperty('--zq-prd-header-height');
        }
    }
    function schedule() {
        if (!pending) { pending = true; window.requestAnimationFrame(sync); }
    }
    new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', schedule);
    window.addEventListener('popstate', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
