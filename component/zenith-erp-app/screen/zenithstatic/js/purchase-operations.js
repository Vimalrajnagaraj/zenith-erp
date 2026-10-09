/* Reserve the measured wrapped header only while an Purchase operations screen is rendered. */
(function () {
  function start() {
    if (!document.body || window.zpurHeaderObserver) return;
    window.zpurHeaderObserver = true;
    var watchedHeader = null, headerObserver = null, pending = false;
    function sync() {
        pending = false;
        document.body.classList.toggle('zpur-module', /^\/(?:apps|qapps)\/zenith\/Purchase(?:\/|$)/.test(location.pathname));
        var header = document.querySelector('.q-header');
        if (header !== watchedHeader) {
            if (headerObserver) headerObserver.disconnect();
            watchedHeader = header;
            if (header && window.ResizeObserver) {
                headerObserver = new ResizeObserver(schedule);
                headerObserver.observe(header);
            }
        }
        if (header && document.querySelector('.zpur-page')) {
            document.body.style.setProperty('--zq-pur-header-height', (header.offsetHeight || 51) + 'px');
        } else {
            document.body.style.removeProperty('--zq-pur-header-height');
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
