// One public write path shared by AJAX and the legacy form; reconcile against SQL.
module.exports = async function ({ a, cashier, foreign, page, session, id, line, q, check }) {
    const scope = { transactionId: id, itemSeqId: line.item_seq_id, sessionId: session.result.sessionId };
    const price = async (newPrice, taxOn = 'Y', actor = a, legacy = false) => {
        const response = await actor.post('Terminal', legacy ? 'updateItemPrice' : 'ajaxCart',
            { ...scope, action: 'updatePrice', newPrice, taxOn });
        if (legacy) return { status: response.status() };
        return (response.headers()['content-type'] || '').includes('application/json') ? response.json() : { success: false, status: response.status() };
    };
    const stored = () => q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}'`)[0];
    const audit = () => q(`SELECT * FROM pos_item_price_override WHERE transaction_id='${id}'`);
    const initialAudit = audit();
    check('Rate audit records the real actor, session and original price', initialAudit.length === 1 &&
        initialAudit[0].changed_by_user_id === 'POS_QA_MANAGER' &&
        String(initialAudit[0].session_id) === String(session.result.sessionId) &&
        Number(initialAudit[0].original_price) === 100 && Number(initialAudit[0].new_price) === 75.5);
    await price('75.50');
    check('Same-price retry does not duplicate override history', audit().length === 1);
    for (const value of ['-1', 'NaN', 'Infinity']) {
        const result = await price(value);
        check('Invalid override ' + value + ' leaves price and audit unchanged', result.success === false &&
            Number(stored().unit_price) === 75.5 && audit().length === 1);
    }
    await price('45', 'Y', foreign);
    check('Foreign request cannot change an authorized rate', Number(stored().unit_price) === 75.5 && audit().length === 1);
    const legacy = await price('75.50', 'Y', cashier, true);
    check('Legacy form preserves the configured cashier write permission', legacy.status >= 300 && legacy.status < 400 && Number(stored().unit_price) === 75.5 && audit().length === 1);

    await page.goto('http://127.0.0.1:18084/apps/zenith/pos/Terminal?sessionId=' + session.result.sessionId + '&transactionId=' + id, { waitUntil: 'networkidle' });
    const cashPage = await cashier.c.newPage();
    await cashPage.goto('http://127.0.0.1:18084/apps/zenith/pos/Terminal?sessionId=' + session.result.sessionId + '&transactionId=' + id, { waitUntil: 'networkidle' });
    check('Configured cashier POS writer retains an editable rate control', await cashPage.locator('.pos-cart .aj-p').first().getAttribute('readonly') === null);
    await cashPage.close();

    const off = await price('100', 'N');
    check('Tax-off rate change stores the entered price without GST', off.success && Number(stored().line_total) === 100 &&
        Number(stored().total_tax_amount) === 0 &&
        q(`SELECT * FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${id}'`).length === 0);
    const free = await price('0', 'N');
    check('Explicit zero-price override preserves the existing free-item policy', free.success &&
        Number(stored().unit_price) === 0 && Number(stored().line_total) === 0 && Number(stored().total_tax_amount) === 0);
    const on = await price('100', 'Y');
    check('Tax-on after tax-off recalculates 18% GST from the product', on.success && Number(stored().taxable_amount) === 100 &&
        Number(stored().total_tax_amount) === 18 && Number(stored().line_total) === 118 &&
        Number(q(`SELECT sum(tax_amount) AS total FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${id}'`)[0].total) === 18);
    await a.invoke('pay', { transactionId: id, paymentMethod: 'Cash', amount: '118' });
    await a.invoke('complete', { transactionId: id });
    const count = audit().length;
    const completed = await price('1');
    check('Completed bill cannot be repriced or gain a misleading audit entry', completed.success === false && Number(stored().unit_price) === 100 && audit().length === count);

    const next = await a.invoke('cart', { sessionId: session.result.sessionId });
    const nextId = next.result.transactionId;
    const added = await a.invoke('add', { transactionId: nextId, productId: 'POS_QA_A_P18', quantity: '2', discountPercent: '10' });
    const change = async newPrice => (await a.post('Terminal', 'ajaxCart', {
        transactionId: nextId, itemSeqId: added.result.itemSeqId,
        action: 'updatePrice', newPrice, taxOn: 'Y' })).json();
    const discounted = await change('50');
    let nextLine = q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${nextId}'`)[0];
    check('Rate override preserves quantity and percentage discount with exact GST', discounted.success && Number(nextLine.quantity) === 2 &&
        Number(nextLine.discount_percent) === 10 && Number(nextLine.discount_amount) === 10 &&
        Number(nextLine.taxable_amount) === 90 && Number(nextLine.total_tax_amount) === 16.2 && Number(nextLine.line_total) === 106.2);
    await a.post('SalesMode', 'createMode', { modeName: 'Disposable inclusive mode', modeCode: 'QAINCL', priceSource: 'PpsDiscountMrp', isTaxInclusive: 'Y', discountPercent: '10', requireCustomer: 'N' });
    const inclusiveId = q("SELECT sales_mode_id FROM pos_sales_mode WHERE mode_code='QAINCL'")[0].sales_mode_id;
    await a.invoke('mode', { transactionId: nextId, itemSeqId: added.result.itemSeqId, salesModeId: inclusiveId, taxOn: 'Y' });
    const inclusive = await change('118');
    nextLine = q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${nextId}'`)[0];
    check('Tax-inclusive rate override extracts GST after the existing discount', inclusive.success && Number(nextLine.taxable_amount) === 180 &&
        Number(nextLine.total_tax_amount) === 32.4 && Number(nextLine.line_total) === 212.4);
};
