/* Product Pricing handlers shared by full-page /apps and SPA /qapps navigation. */
(function () {
    'use strict';
    if (window.ZPosProductPricing) return;
    window.ZPosProductPricing = true;

    function rootOf(node) { return node && node.closest && node.closest('#posProductPricing'); }
    function recalc(input) {
        var row = input.closest('tr');
        var preview = input.parentNode.querySelector('.pp-incl');
        if (!row || !preview) return;
        var rate = parseFloat(row.getAttribute('data-gst')), price = parseFloat(input.value);
        var text = !isNaN(price) && price > 0 && !isNaN(rate) && rate > 0 ? '≈ ₹' + (price * (1 + rate / 100)).toFixed(2) + ' incl.' : '';
        if (preview.textContent !== text) preview.textContent = text;
    }
    function note(button, message, color) {
        var status = button.parentNode.querySelector('.pp-save-message');
        if (!status) {
            status = document.createElement('span');
            status.className = 'pp-save-message';
            status.setAttribute('role', 'status');
            status.style.cssText = 'display:block;font-size:12px;margin-top:5px';
            button.parentNode.appendChild(status);
        }
        status.textContent = message;
        status.style.color = color;
    }
    document.addEventListener('input', function (event) {
        if (rootOf(event.target) && event.target.classList.contains('pp-price')) recalc(event.target);
    });
    document.addEventListener('click', function (event) {
        var button = event.target.closest && event.target.closest('.pp-save'), root = rootOf(button);
        if (!root || button.disabled) return;
        var row = button.closest('tr'), token = root.querySelector('[name=moquiSessionToken]');
        if (!row || !token || !token.value) {
            note(button, 'Refresh this page before saving prices.', '#c62828');
            return;
        }
        var prices = {}, thresholds = {}, quantity = row.querySelector('.pp-wsthreshold');
        row.querySelectorAll('.pp-mode-price').forEach(function (input) { prices[input.getAttribute('data-mode-id')] = input.value; });
        if (quantity) thresholds.WHOLESALE = quantity.value;
        button.disabled = true;
        button.textContent = 'Saving...';
        note(button, '', '#1b5e20');
        var body = new URLSearchParams({ productId: row.getAttribute('data-pid'), modePricesJson: JSON.stringify(prices),
            modeThresholdsJson: JSON.stringify(thresholds), moquiSessionToken: token.value });
        fetch(root.getAttribute('data-save-url'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' })
            .then(function (response) {
                if (response.status === 401 || response.status === 403) throw new Error('Refresh this page and check your permission before saving.');
                if (!response.ok || !(response.headers.get('Content-Type') || '').includes('application/json')) throw new Error('Save could not be confirmed. Reload the prices before retrying.');
                return response.json().catch(function () { throw new Error('Save could not be confirmed. Reload the prices before retrying.'); });
            })
            .then(function (data) {
                note(button, data && data.success ? (data.warning || 'Saved') : ((data && data.error) || 'Prices could not be saved.'), data && data.success ? (data.warning ? '#e65100' : '#1b5e20') : '#c62828');
            })
            .catch(function (error) { note(button, error instanceof TypeError ? 'Save could not be confirmed. Reload the prices before retrying.' : error.message, '#c62828'); })
            .finally(function () { button.disabled = false; button.textContent = 'Save'; });
    });
    document.addEventListener('change', function (event) {
        var input = event.target, root = rootOf(input);
        if (!root || !input.classList) return;
        if (input.classList.contains('pp-wstoggle')) {
            var cell = input.closest('td'), wrap = cell.querySelector('.pp-wswrap'), quantity = cell.querySelector('.pp-wsthreshold');
            if (wrap) wrap.style.display = input.checked ? 'inline-flex' : 'none';
            if (quantity) { quantity.disabled = !input.checked; if (!input.checked) quantity.value = ''; else if (!quantity.value) quantity.focus(); }
        }
        if (input.classList.contains('pp-mode-choice')) {
            var picker = input.closest('.pp-mode-picker'), form = picker && picker.closest('form');
            if (!form) return;
            var selected = Array.from(picker.querySelectorAll('.pp-mode-choice:checked'), function (choice) { return choice.value; });
            if (!selected.length) { input.checked = true; return; }
            form.querySelector('[name=modeIds]').value = selected.join(',');
            form.submit();
        }
    });
    function refresh() {
        var root = document.getElementById('posProductPricing');
        if (root) root.querySelectorAll('.pp-price').forEach(recalc);
    }
    function boot() {
        refresh();
        new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
