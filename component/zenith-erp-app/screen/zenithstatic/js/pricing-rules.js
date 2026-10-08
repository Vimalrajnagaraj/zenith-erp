/* Reserve the measured wrapped header only while an Pricing Rules screen is rendered. */
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
        if (header && document.querySelector('.zprr-page')) {
            document.body.style.setProperty('--zq-prr-header-height', (header.offsetHeight || 51) + 'px');
        } else {
            document.body.style.removeProperty('--zq-prr-header-height');
        }
    }
    function schedule() {
        if (!pending) { pending = true; window.requestAnimationFrame(sync); }
    }
    new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('resize', schedule);
    schedule();
})();

/* Delegated controls also survive Quasar page replacements. */
(function () {
    document.addEventListener('click', function (event) {
        var target = event.target.closest('.prr-tab,.prr-addcond-toggle,.prr-addcond-cancel,.prr-update-btn,.prr-dup-btn');
        if (!target) return;
        var page = target.closest('.zprr-page');
        if (!page) return;
        if (target.classList.contains('prr-tab')) {
            var tab = target.getAttribute('data-tab');
            page.querySelectorAll('.prr-tab').forEach(function (node) { node.classList.toggle('prr-active', node === target); });
            page.querySelectorAll('.prr-panel').forEach(function (node) { node.classList.toggle('prr-active', node.classList.contains('prr-panel-' + tab)); });
        } else if (target.classList.contains('prr-addcond-toggle') || target.classList.contains('prr-addcond-cancel')) {
            var form = page.querySelector('.prr-addform');
            if (form) form.classList.toggle('prr-show', target.classList.contains('prr-addcond-toggle') && !form.classList.contains('prr-show'));
        } else if (target.classList.contains('prr-update-btn')) {
            var submit = page.querySelector('#UpdateRuleForm_submitBtn');
            if (submit) submit.click();
        } else if (target.classList.contains('prr-dup-btn')) {
            var duplicate = page.querySelector('.prr-dup-real');
            if (duplicate) duplicate.click();
        }
    });
})();
