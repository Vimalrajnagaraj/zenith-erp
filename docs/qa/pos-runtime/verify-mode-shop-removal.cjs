// Disposable POS QA fixture only; all generated records disappear with the in-memory runtime.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const base = process.env.POS_QA_BASE || 'http://127.0.0.1:18084';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const root = process.env.POS_QA_NATIVE_ROOT, java = process.env.POS_QA_JAVA, out = process.env.POS_QA_OUT;
assert(root && java && out, 'Set disposable runtime and evidence paths');
const classes = path.join(out, 'db-probe'); fs.mkdirSync(classes, {recursive: true});
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, 'PosDbProbe.java')], {windowsHide: true});
function q(sql) {
    assert.match(sql, /^SELECT /i);
    return JSON.parse(cp.execFileSync(java, ['--class-path', path.join(root, 'WEB-INF/lib/h2-2.4.240.jar') + path.delimiter + classes, 'PosDbProbe'],
        {input: sql, encoding: 'utf8', windowsHide: true, env: {...process.env, POS_QA_DB_URL: 'jdbc:h2:tcp://127.0.0.1:19096/mem:pos-qa;IFEXISTS=TRUE'}}));
}
const quote = s => "'" + String(s).replaceAll("'", "''") + "'";
const count = where => Number(q('SELECT count(*) AS n FROM pos_sales_mode_shop WHERE ' + where)[0].n);
const checks = [];
function check(name, truth) { assert(truth, name); checks.push(name); }
(async () => {
    const browser = await chromium.launch({headless: true, executablePath: process.env.POS_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const contexts = [];
    async function actor(user) {
        const context = await browser.newContext({viewport: {width: 1366, height: 768}});
        contexts.push(context); const page = await context.newPage();
        await context.request.get(base + '/apps/zenith/pos/SalesMode', {headers: {Authorization: 'Basic ' + Buffer.from(user + ':moqui').toString('base64')}});
        await page.goto(base + '/apps/zenith/pos/SalesMode', {waitUntil: 'networkidle'});
        const terminal = await context.request.get(base + '/apps/zenith/pos/Terminal');
        const token = (await terminal.text()).match(/name="moquiSessionToken" value="([^"]+)"/)?.[1];
        assert(token, 'Authenticated actor has a CSRF token');
        const post = (screen, action, params, csrf = true) => context.request.post(`${base}/apps/zenith/${screen}/${action}`, {form: {...(csrf ? {moquiSessionToken: token} : {}), ...params}, maxRedirects: 0});
        return {context, page, token, post};
    }
    try {
        const a = await actor('pos.qa');
        const card = a.page.locator('.smode-tile').filter({hasText: 'Employee'});
        check('Shared mode exposes shop-specific removal', !await card.locator('.smode-delete').isDisabled());
        await card.locator('.smode-delete').click();
        check('Removal asks which shop', await card.locator('.smode-shop-dialog').isVisible());
        await card.locator('.smode-shop-dialog button').filter({hasText: 'Cancel'}).click();
        const marker = 'Disposable mode shop ' + Date.now();
        await a.post('Inventory/FindFacility', 'createFacility', {facilityName: marker, facilityTypeEnumId: 'FcTpRetailStore'});
        const facility = q(`SELECT facility_id FROM facility WHERE facility_name=${quote(marker)} AND owner_party_id='POS_QA_A'`)[0]?.facility_id;
        check('Second shop fixture created', !!facility);
        const terminalId = 'POS_QA_MODE_' + Date.now();
        await a.post('pos/PosTerminals', 'createTerminal', {terminalId, terminalName: marker, facilityId: facility, organizationPartyId: 'POS_QA_A', stateCode: '33', isActive: 'Y'});
        check('Second shop terminal created', q(`SELECT terminal_id FROM pos_terminal WHERE terminal_id=${quote(terminalId)} AND facility_id=${quote(facility)}`).length === 1);
        await a.post('Inventory/FindFacility', 'createFacility', {facilityName: marker + ' third', facilityTypeEnumId: 'FcTpRetailStore'});
        const thirdFacility = q(`SELECT facility_id FROM facility WHERE facility_name=${quote(marker + ' third')} AND owner_party_id='POS_QA_A'`)[0]?.facility_id;
        check('Third shop fixture created', !!thirdFacility);
        const completedBefore = q("SELECT transaction_id, status_id, transaction_number, payable_amount FROM pos_transaction WHERE status_id='PtCompleted' ORDER BY transaction_id");
        const where = "organization_party_id='POS_QA_A' AND sales_mode_id='EMPLOYEE'";
        await a.post('pos/SalesMode', 'removeFromShops', {salesModeId: 'EMPLOYEE', facilityIds: 'POS_QA_B_FAC'});
        check('Foreign shop selection rejected before writes', count(where) === 0);
        const cashier = await actor('pos.cashier.qa');
        await cashier.post('pos/SalesMode', 'removeFromShops', {salesModeId: 'EMPLOYEE', facilityIds: facility});
        check('Cashier cannot remove modes', count(where) === 0);
        await a.post('pos/SalesMode', 'removeFromShops', {salesModeId: 'EMPLOYEE', facilityIds: facility}, false);
        check('CSRF-less removal rejected', count(where) === 0);
        await a.post('pos/SalesMode', 'removeFromShops', {salesModeId: 'RETAIL', facilityIds: facility});
        check('Default Retail remains available', count("sales_mode_id='RETAIL'") === 0);
        const invoke = async (op, params) => (await (await a.post('pos/PosQaAcceptance', 'invoke', {op, ...params})).json()).result;
        const openSession = await invoke('open', {terminalId, openingCash:'0'});
        const openCart = await invoke('cart', {sessionId:openSession.sessionId});
        await invoke('add', {transactionId:openCart.transactionId, productId:'POS_QA_A_P18', salesModeId:'EMPLOYEE', quantity:'1', unitPrice:'13', taxOn:'N'});
        await a.post('pos/SalesMode', 'removeFromShops', {salesModeId:'EMPLOYEE', facilityIds:facility});
        check('Open cart prevents removing its line mode', count(where) === 0);
        const held = await invoke('hold', {transactionId:openCart.transactionId});
        await a.post('pos/SalesMode', 'removeFromShops', {salesModeId:'EMPLOYEE', facilityIds:facility});
        check('Held cart prevents removing its line mode', count(where) === 0);
        await invoke('recall', {heldId:held.heldId, sessionId:openSession.sessionId});
        await invoke('void', {transactionId:openCart.transactionId});
        await invoke('close', {sessionId:openSession.sessionId, closingCash:'0'});
        for (const shell of ['apps', 'qapps']) {
            await a.page.goto(`${base}/${shell}/zenith/pos/SalesMode`, {waitUntil: 'networkidle'});
            const tile = a.page.locator('.smode-tile').filter({hasText: 'Employee'});
            await tile.locator('.smode-delete').click();
            const dialog = tile.locator('.smode-shop-dialog');
            for (const width of [1366,390]) {
                await a.page.setViewportSize({width,height:768});
                const rect = await dialog.boundingBox();
                check(shell + ' shop picker fits ' + width + 'px', rect && rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= 769);
                await a.page.screenshot({path:path.join(out, shell + '-shop-picker-' + width + '.png')});
            }
            check(shell + ' picker excludes another organization', await dialog.locator('[value="POS_QA_B_FAC"]').count() === 0);
            for (const choice of await dialog.locator('[name=facilityIds]').all()) await choice.uncheck();
            await dialog.locator(`[name=facilityIds][value="${facility}"]`).check();
            await dialog.locator(`[name=facilityIds][value="${thirdFacility}"]`).check();
            await dialog.getByRole('button', {name: 'Remove from selected shops', exact: true}).click();
            await a.page.waitForLoadState('networkidle');
            check(shell + ' only the two chosen shops are removed', count(where + ' AND facility_id=' + quote(facility)) === 1 && count(where + ' AND facility_id=' + quote(thirdFacility)) === 1 && count(where) === 2);
            check(shell + ' shared definition stays active', q("SELECT is_active FROM pos_sales_mode WHERE sales_mode_id='EMPLOYEE'")[0].is_active === 'Y');
            const payload = await a.post('pos/PosQaAcceptance', 'invoke', {op: 'open', terminalId, openingCash: '0'});
            const sessionId = (await payload.json()).result?.sessionId;
            check(shell + ' session opens in removed-mode shop', !!sessionId);
            const cartResponse = await a.post('pos/PosQaAcceptance', 'invoke', {op: 'cart', sessionId});
            const transactionId = (await cartResponse.json()).result?.transactionId;
            await a.page.goto(`${base}/apps/zenith/pos/Terminal?sessionId=${sessionId}`, {waitUntil: 'networkidle'});
            check(shell + ' removed mode absent from terminal choices', await a.page.locator('.nb-modes__item').filter({hasText: 'Employee'}).count() === 0);
            const forged = await a.post('pos/PosQaAcceptance', 'invoke', {op: 'add', transactionId, productId: 'POS_QA_A_P18', salesModeId: 'EMPLOYEE', quantity: '1', unitPrice: '13', taxOn: 'N'});
            check(shell + ' manual-price request cannot reuse removed mode', (await forged.json()).errors?.length > 0 && q(`SELECT item_seq_id FROM pos_transaction_item WHERE transaction_id=${quote(transactionId)}`).length === 0);
            await a.post('pos/PosQaAcceptance', 'invoke', {op: 'close', sessionId, closingCash: '0'});
            const futureTerminal = terminalId + shell;
            await a.post('pos/PosTerminals', 'createTerminal', {terminalId:futureTerminal, terminalName:marker + shell, facilityId:thirdFacility, organizationPartyId:'POS_QA_A', stateCode:'33', isActive:'Y'});
            const futureSession = await invoke('open', {terminalId:futureTerminal, openingCash:'0'});
            await a.page.goto(`${base}/apps/zenith/pos/Terminal?sessionId=${futureSession.sessionId}`, {waitUntil:'networkidle'});
            check(shell + ' newly created terminal inherits shop removal', await a.page.locator('.nb-modes__item').filter({hasText:'Employee'}).count() === 0);
            await invoke('close', {sessionId:futureSession.sessionId, closingCash:'0'});
            await a.post('pos/SalesMode', 'restoreForShop', {salesModeId: 'EMPLOYEE', facilityId: facility});
            check(shell + ' restore removes only this shop override', count(where + ' AND facility_id=' + quote(facility)) === 0 && count(where + ' AND facility_id=' + quote(thirdFacility)) === 1);
            await a.post('pos/SalesMode', 'restoreForShop', {salesModeId: 'EMPLOYEE', facilityId: thirdFacility});
            check(shell + ' second restore clears remaining override', count(where) === 0);
        }
        assert.deepEqual(q("SELECT transaction_id, status_id, transaction_number, payable_amount FROM pos_transaction WHERE status_id='PtCompleted' ORDER BY transaction_id"), completedBefore);
        check('Issued bill history is unchanged', true);
        console.log('PASS ' + checks.length + ' shop-mode checks');
    } finally { for (const context of contexts) await context.close(); await browser.close(); fs.writeFileSync(path.join(out, 'mode-shop-checks.json'), JSON.stringify(checks, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
