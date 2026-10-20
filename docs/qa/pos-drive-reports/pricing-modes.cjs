// Browser interaction plus independent persisted-price checks. Disposable fixtures only.
module.exports = async function ({ page, root, shell, url, a, q, check }) {
    const row = root.locator('tr[data-pid="POS_QA_A_P18"]');
    const retail = row.locator('[data-mode-id="RETAIL"]');
    const wholesale = root.locator('.pp-mode-choice[value="WHOLESALE"]');
    const customId = q("SELECT sales_mode_id FROM pos_sales_mode WHERE mode_code='QADRIVE'")[0].sales_mode_id;
    const custom = root.locator(`.pp-mode-choice[value="${customId}"]`);
    let writes = 0;
    const observe = request => { if (request.method() === 'POST' && request.url().includes('/saveModeSelection')) writes++; };
    page.on('request', observe);
    try {
        await retail.fill('123.45');
        await wholesale.check();
        await custom.check();
        await page.waitForResponse(r => r.url().includes('/saveModeSelection') && r.request().method() === 'POST');
        await page.waitForTimeout(250);
        check(shell + ' three selected modes show exactly their price headers',
            await root.locator('th[data-pp-mode]:visible').count() === 4 &&
            await row.locator('.pp-mode-price:visible').count() === 3);
        check(shell + ' rapid mode selections batch one preference write', writes === 1, { writes });
        check(shell + ' hidden-column drafts survive selection changes', await retail.inputValue() === '123.45');

        await root.locator('.pp-mode-choice[value="RETAIL"]').uncheck();
        await custom.uncheck();
        await wholesale.focus();
        await wholesale.press('Space');
        check(shell + ' keyboard cannot remove the final non-Retail mode', await wholesale.isChecked() &&
            await root.locator('.pp-mode-choice:checked').count() === 1 &&
            /at least one/i.test(await root.locator('.pp-mode-message').innerText()));
        await page.waitForTimeout(700);
        await page.goto(url.replace('modeIds=RETAIL&', ''), { waitUntil: 'networkidle' });
        check(shell + ' own preference survives reload without URL mode parameters',
            await wholesale.isChecked() && await root.locator('.pp-mode-choice:checked').count() === 1);

        await root.locator('.pp-mode-picker summary').click();
        await root.locator('.pp-mode-choice[value="RETAIL"]').check();
        await wholesale.uncheck();
        await retail.fill('124.50');
        const before = q("SELECT price,threshold_qty FROM pos_product_mode_price WHERE product_id='POS_QA_A_P18' AND sales_mode_id='WHOLESALE'");
        const save = page.waitForResponse(r => r.url().includes('/savePrices') && r.request().method() === 'POST');
        await row.locator('.pp-save').click();
        const saved = await save;
        check(shell + ' row save excludes unselected mode inputs', (await saved.json()).success &&
            JSON.stringify(before) === JSON.stringify(q("SELECT price,threshold_qty FROM pos_product_mode_price WHERE product_id='POS_QA_A_P18' AND sales_mode_id='WHOLESALE'")) &&
            Number(q("SELECT mrp_amount FROM product WHERE product_id='POS_QA_A_P18'")[0].mrp_amount) === 124.5);

        await page.route('**/ProductPricing/saveModeSelection', r => r.fulfill({ status: 503, contentType: 'text/html', body: 'Temporary fixture failure' }));
        await wholesale.check();
        await root.locator('.pp-mode-retry').waitFor({ state: 'visible' });
        check(shell + ' preference failure preserves drafts and offers retry', await retail.inputValue() === '124.50' &&
            /could not be saved/.test(await root.locator('.pp-mode-message').innerText()));
        await page.unroute('**/ProductPricing/saveModeSelection');
        const retried = page.waitForResponse(r => r.url().includes('/saveModeSelection') && r.request().method() === 'POST');
        await root.locator('.pp-mode-retry').click();
        check(shell + ' preference retry succeeds without reloading the document', (await (await retried).json()).success);
        await page.reload({ waitUntil: 'networkidle' });
        check(shell + ' saved selected modes remain in filter and export URLs',
            await root.locator('[name="modeIds"]').inputValue() === 'RETAIL,WHOLESALE' &&
            await root.locator('a[href*="exportCsv"]').evaluate(e => new URL(e.href).searchParams.get('modeIds') === 'RETAIL,WHOLESALE'));
    } finally {
        page.off('request', observe);
        await a.post('ProductPricing', 'savePrices', { productId: 'POS_QA_A_P18', modePricesJson: '{"RETAIL":"100"}', modeThresholdsJson: '{}' });
    }
};
