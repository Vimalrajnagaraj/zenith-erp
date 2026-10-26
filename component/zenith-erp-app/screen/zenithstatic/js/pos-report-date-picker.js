(function () {
    var forms = ':is(#AuditFilter, #BillFilter, #ItemFilter, #PaymentFilter, #UserFilter, #CancelFilter, #EditedFilter) .input-group.date';

    function attach() {
        if (!window.jQuery) return;
        document.querySelectorAll(forms).forEach(function (field) {
            if (field.dataset.reportPickerBelow) return;
            var picker = jQuery(field).data('DateTimePicker');
            if (!picker) return;
            picker.widgetPositioning({ horizontal: 'left', vertical: 'bottom' });
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
