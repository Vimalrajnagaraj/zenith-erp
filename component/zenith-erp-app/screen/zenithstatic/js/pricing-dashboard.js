/* Reserve the measured wrapped header only while an Pricing Dashboard screen is rendered. */
(function () {
    if (location.pathname.indexOf('/qapps/') !== 0) return;
    var watchedHeader = null, headerObserver = null, pending = false;
    function sync() {
        pending = false;
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
    schedule();
})();
