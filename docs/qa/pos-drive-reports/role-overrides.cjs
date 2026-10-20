// Real memberships on the fixed disposable cashier account; always restore them.
module.exports = async function ({ a, actor, q, check, base }) {
    const line = q("SELECT i.* FROM pos_transaction_item i INNER JOIN pos_transaction t ON t.transaction_id=i.transaction_id WHERE t.organization_party_id='POS_QA_A' AND t.status_id='PtCreated' ORDER BY i.transaction_id DESC LIMIT 1")[0];
    const session = q(`SELECT session_id FROM pos_transaction WHERE transaction_id='${line.transaction_id}'`)[0].session_id;
    const scope = { transactionId: line.transaction_id, itemSeqId: line.item_seq_id, sessionId: session, action: 'updatePrice', taxOn: 'Y' };
    const price = () => Number(q(`SELECT unit_price FROM pos_transaction_item WHERE transaction_id='${line.transaction_id}' AND item_seq_id='${line.item_seq_id}'`)[0].unit_price);
    const original = price();
    const change = async (account, value) => {
        const response = await account.post('Terminal', 'ajaxCart', { ...scope, newPrice: String(value) });
        return (response.headers()['content-type'] || '').includes('application/json') ? response.json() : { success: false, status: response.status() };
    };
    let page, writer;
    try {
        if (!(await (await a.post('PosQaAcceptance', 'priceRoleProbe', { role: 'hybrid' })).json()).updated) throw Error('Synthetic role setup failed');
        writer = await actor('pos.cashier.qa');
        const written = await change(writer, 149);
        check('Cashier with a second role retains the configured POS write grant', written.success === true && price() === 149);
        await change(a, original);

        if (!(await (await a.post('PosQaAcceptance', 'priceRoleProbe', { role: 'view' })).json()).updated) throw Error('Synthetic read-only setup failed');
        const denied = await change(writer, 149);
        check('Revoking POS write permission denies the existing signed-in session', denied.success === false && price() === original);
        const auditCount = q(`SELECT * FROM pos_item_price_override WHERE transaction_id='${line.transaction_id}'`).length;
        const legacy = await writer.post('Terminal', 'updateItemPrice', { ...scope, newPrice: '149' });
        const blocked = legacy.status() === 403 || (legacy.status() >= 300 && legacy.status() < 400 &&
            /\/zenith\/Dashboard(?:\?|$)/.test(legacy.headers().location || ''));
        check('Read-only role cannot bypass permission through the legacy form', blocked && price() === original &&
            q(`SELECT * FROM pos_item_price_override WHERE transaction_id='${line.transaction_id}'`).length === auditCount,
            { status: legacy.status(), redirectedToAccessFallback: /\/zenith\/Dashboard/.test(legacy.headers().location || '') });

        if (!(await (await a.post('PosQaAcceptance', 'priceRoleProbe', { role: 'manager' })).json()).updated) throw Error('Synthetic manager setup failed');
        const manager = await actor('pos.cashier.qa');
        page = await manager.c.newPage();
        await page.goto(base + '/apps/zenith/pos/Terminal?sessionId=' + session + '&transactionId=' + line.transaction_id + '&taxOn=Y', { waitUntil: 'networkidle' });
        const input = page.locator('.pos-cart .aj-p').first();
        check('Separate Store Manager grant enables the rate control', await input.getAttribute('readonly') === null);
        await input.fill('126');
        const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('ajaxCart'));
        await input.press('Enter');
        check('Store Manager confirmation persists the actual typed rate', (await (await response).json()).success && price() === 126);
    } finally {
        if (page) await page.close();
        await a.post('PosQaAcceptance', 'priceRoleProbe', { role: 'restore' });
        await a.post('Terminal', 'ajaxCart', { ...scope, newPrice: String(original) });
    }
    try {
        const restored = await change(writer, 149);
        check('Restoring the cashier POS write grant permits edits again', restored.success === true && price() === 149);
    } finally { await change(a, original); }
};
