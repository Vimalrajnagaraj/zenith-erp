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
    var modeRequests = new WeakMap();
    function modeNote(root, message, kind) {
        var status = root.querySelector('.pp-mode-message');
        if (!status || (kind === 'saved' && status.dataset.kind === 'minimum')) return;
        status.dataset.kind = kind || '';
        status.textContent = message;
        status.hidden = !message;
    }
    function saveModes(root) {
        var state = modeRequests.get(root);
        if (!state || state.inFlight || !root.isConnected) return;
        var value = root.querySelector('[name=modeIds]').value;
        var token = root.querySelector('[name=moquiSessionToken]');
        if (!token || !token.value) { modeNote(root, 'Refresh this page before saving the selection.', 'error'); return; }
        state.inFlight = true;
        state.pending = false;
        var retry = root.querySelector('.pp-mode-retry');
        retry.hidden = true;
        fetch(root.dataset.modeUrl, { method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ modeIds: value, moquiSessionToken: token.value }) })
            .then(function (response) {
                if (!response.ok || !(response.headers.get('Content-Type') || '').includes('application/json')) throw new Error();
                return response.json();
            })
            .then(function (data) {
                if (!data || !data.success) throw new Error();
                modeNote(root, '', 'saved');
            })
            .catch(function () {
                modeNote(root, 'The selection could not be saved. Your displayed columns and price edits are still here.', 'error');
                retry.hidden = false;
            })
            .finally(function () {
                state.inFlight = false;
                if (state.pending) saveModes(root);
            });
    }
    function selectModes(root, input) {
        var choices = Array.from(root.querySelectorAll('.pp-mode-choice:checked'));
        if (!choices.length) {
            input.checked = true;
            modeNote(root, 'At least one pricing mode must remain selected. Select another mode before removing ' + input.dataset.modeName + '.', 'minimum');
            return;
        }
        modeNote(root, '', '');
        var ids = choices.map(function (choice) { return choice.value; });
        var editable = choices.some(function (choice) { return choice.dataset.editable === 'true'; });
        root.querySelector('[name=modeIds]').value = ids.join(',');
        root.querySelectorAll('[data-pp-mode]').forEach(function (cell) {
            var shown = ids.includes(cell.dataset.ppMode);
            cell.hidden = !shown;
            cell.querySelectorAll('input').forEach(function (field) { field.disabled = !shown; });
        });
        root.querySelectorAll('.pp-wsthreshold').forEach(function (field) {
            var cell = field.closest('[data-pp-mode]');
            field.disabled = cell.hidden || !cell.querySelector('.pp-wstoggle').checked;
        });
        root.querySelectorAll('.pp-save').forEach(function (button) { button.hidden = !editable; });
        root.querySelectorAll('.pp-view-only').forEach(function (label) { label.hidden = editable; });
        root.querySelectorAll('td[colspan]').forEach(function (cell) { cell.colSpan = 5 + ids.length + (ids.includes('WHOLESALE') ? 1 : 0); });
        var chips = root.querySelector('.pp-mode-chips');
        chips.replaceChildren();
        choices.forEach(function (choice) {
            var chip = document.createElement('span');
            chip.textContent = choice.dataset.modeName;
            chips.appendChild(chip);
        });
        // Preserve filters, pagination, export and browser history without replacing the page or drafts.
        var url = new URL(location.href);
        url.searchParams.set('modeIds', ids.join(','));
        history.replaceState(history.state, '', url);
        root.querySelectorAll('a[href]').forEach(function (link) {
            var target = new URL(link.href, location.href);
            if (target.origin === location.origin && /\/ProductPricing(?:\/|$)/.test(target.pathname)) {
                target.searchParams.set('modeIds', ids.join(','));
                link.href = target.toString();
            }
        });
        var state = modeRequests.get(root);
        if (!state) { state = { inFlight: false }; modeRequests.set(root, state); }
        state.pending = true;
        clearTimeout(state.timer);
        state.timer = setTimeout(function () { saveModes(root); }, 150);
    }
    document.addEventListener('input', function (event) {
        if (rootOf(event.target) && event.target.classList.contains('pp-price')) recalc(event.target);
    });
    document.addEventListener('click', function (event) {
        var retry = event.target.closest && event.target.closest('.pp-mode-retry');
        if (retry) { saveModes(rootOf(retry)); return; }
        var button = event.target.closest && event.target.closest('.pp-save'), root = rootOf(button);
        if (!root || button.disabled) return;
        var row = button.closest('tr'), token = root.querySelector('[name=moquiSessionToken]');
        if (!row || !token || !token.value) {
            note(button, 'Refresh this page before saving prices.', '#c62828');
            return;
        }
        var prices = {}, thresholds = {}, quantity = row.querySelector('.pp-wsthreshold');
        row.querySelectorAll('.pp-mode-price:not(:disabled)').forEach(function (input) { prices[input.getAttribute('data-mode-id')] = input.value; });
        if (quantity && row.querySelector('.pp-mode-price[data-mode-id="WHOLESALE"]:not(:disabled)')) thresholds.WHOLESALE = quantity.value;
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
            selectModes(root, input);
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
