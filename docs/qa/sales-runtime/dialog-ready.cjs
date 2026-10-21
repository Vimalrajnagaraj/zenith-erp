// Wait for the framework's shown callback, which runs its initial field focus.
// Stable element bounds alone do not wait for a fade transition to finish.
module.exports = async function openItemDialog(page, shell) {
    await page.evaluate(surface => {
        window.__salesItemDialogReady = false;
        if (surface === 'qapps') {
            const pending = [window.moqui && window.moqui.webrootVue];
            let dialog;
            while (pending.length) {
                const component = pending.pop();
                if (!component) continue;
                if (component.$options.name === 'mDialog' && component.id === 'AddItemDialog') {
                    dialog = component;
                    break;
                }
                pending.push(...component.$children);
            }
            if (!dialog) throw Error('Invoice item dialog component was not mounted');
            dialog.$once('onShow', () => { window.__salesItemDialogReady = true; });
        } else {
            const dialog = window.jQuery('#AddItemDialog');
            if (dialog.length !== 1) throw Error('Invoice item modal was not mounted');
            dialog.one('shown.bs.modal', () => { window.__salesItemDialogReady = true; });
        }
    }, shell);
    await page.getByText('Add Item', { exact: true }).first().click();
    await page.waitForFunction(() => window.__salesItemDialogReady === true);
};
