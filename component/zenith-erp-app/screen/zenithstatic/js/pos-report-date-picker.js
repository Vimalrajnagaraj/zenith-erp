(function () {
    var reports = ':is(#AuditFilter, #BillFilter, #ItemFilter, #PaymentFilter, #UserFilter, #CancelFilter, #EditedFilter)';
    var forms = reports + ' .input-group.date';

    function validDate(value) {
        return !value || (window.moment && moment(value, 'YYYY-MM-DD', true).isValid());
    }

    function validateRange(form) {
        var from = form.elements.fromDate;
        var to = form.elements.thruDate;
        if (!from || !to) return true;
        from.setCustomValidity('');
        to.setCustomValidity('');
        if (!validDate(from.value)) from.setCustomValidity('Enter a valid From Date in YYYY-MM-DD format.');
        else if (!validDate(to.value)) to.setCustomValidity('Enter a valid To Date in YYYY-MM-DD format.');
        else if (from.value && to.value && from.value > to.value) {
            to.setCustomValidity('To Date must be on or after From Date.');
        }
        var invalid = from.validationMessage ? from : (to.validationMessage ? to : null);
        if (invalid) invalid.reportValidity();
        return !invalid;
    }

    function attach() {
        if (!window.jQuery) return;
        document.querySelectorAll(reports).forEach(function (form) {
            if (form.dataset.reportRangeValidation) return;
            form.addEventListener('submit', function (event) {
                if (!validateRange(form)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
            form.addEventListener('click', function (event) {
                if (event.target.closest('[type="submit"]') && !validateRange(form)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
            ['fromDate', 'thruDate'].forEach(function (name) {
                var input = form.elements[name];
                if (input) input.addEventListener('input', function () { input.setCustomValidity(''); });
            });
            form.dataset.reportRangeValidation = '1';
        });
        document.querySelectorAll(forms).forEach(function (field) {
            if (field.dataset.reportPickerBelow) return;
            var picker = jQuery(field).data('DateTimePicker');
            if (!picker) return;
            picker.keepInvalid(true);
            picker.widgetPositioning({ horizontal: 'left', vertical: 'bottom' });
            var addon = field.querySelector('.input-group-addon');
            if (addon) {
                addon.setAttribute('role', 'button');
                addon.setAttribute('tabindex', '0');
                addon.setAttribute('aria-label', 'Open ' + (field.querySelector('input').name === 'fromDate' ? 'From Date' : 'To Date') + ' calendar');
                addon.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        picker.show();
                    }
                });
            }
            jQuery(field).on('dp.change.reportPicker', function () {
                var input = field.querySelector('input');
                if (input) input.setCustomValidity('');
            });
            jQuery(field).on('dp.show.reportPicker', function () {
                requestAnimationFrame(function () {
                    var widget = field.querySelector('.bootstrap-datetimepicker-widget');
                    if (!widget) return;
                    widget.scrollIntoView({ block: 'nearest', behavior: 'instant' });
                    var overflow = widget.getBoundingClientRect().bottom - innerHeight + 16;
                    if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'instant' });
                });
            });
            field.dataset.reportPickerBelow = '1';
        });
    }
    attach();
    setInterval(attach, 700);
})();
