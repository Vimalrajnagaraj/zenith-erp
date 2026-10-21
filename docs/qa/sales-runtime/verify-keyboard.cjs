// Focused, real keyboard/submission regression. Fresh disposable native H2 only.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { chromium } = require('playwright');
const openItemDialog = require('./dialog-ready.cjs');
const base = process.env.SALES_QA_BASE || 'http://127.0.0.1:18083';
const runtime = process.env.SALES_QA_NATIVE_ROOT, java = process.env.SALES_QA_JAVA, out = process.env.SALES_QA_OUT;
if (!/^http:\/\/(localhost|127\.0\.0\.1):18083$/.test(base) || !runtime || !java || !out) throw Error('Disposable native Sales paths required');
fs.mkdirSync(out, { recursive: true });
const classes = path.join(out, 'classes'); fs.mkdirSync(classes, { recursive: true });
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, 'SalesDbProbe.java')], { windowsHide: true });
const q = sql => {
    if (!/^SELECT /i.test(sql)) throw Error('SELECT only');
    return JSON.parse(cp.execFileSync(java, ['-cp', classes + path.delimiter + path.join(runtime, 'WEB-INF/lib/h2-2.4.240.jar'), 'SalesDbProbe'], {
        input: sql, encoding: 'utf8', windowsHide: true,
        env: { ...process.env, SALES_QA_DB_URL: 'jdbc:h2:tcp://127.0.0.1:19095/mem:sales-qa-sop;IFEXISTS=TRUE' }
    }));
};
const checks = [];
function check(name, passed) { checks.push({ name, passed: !!passed }); if (!passed) throw Error(name); }
(async () => {
    let browser, page;
    try {
        for (let i = 0; ; i++) {
            try { if ((await fetch(base + '/Login')).status === 200) break; } catch {}
            if (i >= 120) throw Error('Disposable Sales runtime not ready');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        browser = await chromium.launch({ headless: true, executablePath: process.env.SALES_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
        const admin = await browser.newContext();
        await admin.request.get(base + '/apps/zenith/sales/CreateInvoice', { headers: { Authorization: 'Basic ' + Buffer.from('john.doe:moqui').toString('base64') } });
        const adminPage = await admin.newPage(); await adminPage.goto(base + '/apps/zenith/sales/CreateInvoice');
        const adminToken = await adminPage.locator('[name=moquiSessionToken]').first().inputValue();
        if (!q("SELECT * FROM party WHERE party_id='SALES_QA_A'").length) {
            const response = await admin.request.post(base + '/apps/zenith/sales/SalesQaAcceptance/initialize', { form: { moquiSessionToken: adminToken } });
            if (!(await response.json()).initialized) throw Error('Synthetic fixture initialization failed');
        }
        await admin.close();
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.request.get(base + '/apps/zenith/sales/FindInvoice', { headers: { Authorization: 'Basic ' + Buffer.from('sales.qa:moqui').toString('base64') } });
        page = await context.newPage(); page.setDefaultTimeout(30000);
        await page.goto(base + '/apps/zenith/sales/FindInvoice', { waitUntil: 'networkidle' });
        const token = await page.locator('[name=moquiSessionToken]').first().inputValue();
        for (const shell of ['apps', 'qapps']) for (const width of [390, 1440]) for (let repeat = 0; repeat < 3; repeat++) {
            const created = await context.request.post(base + '/apps/zenith/sales/CreateInvoice/createInvoice', { form: { moquiSessionToken: token, toPartyId: 'SALES_QA_CUST_A' }, maxRedirects: 0 });
            const id = new URL(created.headers().location, base).searchParams.get('invoiceId');
            if (!/^\d+$/.test(id)) throw Error('Synthetic invoice was not created');
            const prefix = shell + '-' + width + '-' + repeat;
            const rowCount = () => Number(q(`SELECT count(*) AS n FROM invoice_item WHERE invoice_id='${id}'`)[0].n);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(base + '/' + shell + '/zenith/sales/EditInvoice?invoiceId=' + id, { waitUntil: 'networkidle' });
            await openItemDialog(page, shell);
            check(prefix + ' waits for the real shown event', await page.evaluate(() => window.__salesItemDialogReady === true));
            const fill = async marker => {
                await page.locator('input[name=quantity]:visible').fill('1');
                await page.locator('input[name=amount]:visible').fill('100');
                await page.locator('input[name=description]:visible').fill(marker);
            };
            await fill('KEYBOARD_QA_' + prefix + '_enter');
            await page.locator('input[name=quantity]:visible').focus();
            await page.keyboard.press('Tab');
            await page.waitForFunction(() => document.activeElement?.name === 'amount');
            check(prefix + ' Tab reaches Unit Price', await page.evaluate(() => document.activeElement?.name === 'amount'));
            await Promise.all([page.waitForResponse(r => r.url().includes('/EditInvoice/addItem') && r.request().method() === 'POST'), page.keyboard.press('Enter')]);
            await page.getByText('KEYBOARD_QA_' + prefix + '_enter', { exact: true }).filter({ visible: true }).waitFor();
            await page.waitForLoadState('networkidle'); check(prefix + ' Enter persists one row', rowCount() === 1);
            await openItemDialog(page, shell); await fill('KEYBOARD_QA_' + prefix + '_double');
            if (shell === 'apps' && width === 1440 && repeat === 0) {
                await page.screenshot({ path: path.join(out, 'invoice-modal-after.png') });
            }
            await Promise.all([page.waitForResponse(r => r.url().includes('/EditInvoice/addItem') && r.request().method() === 'POST'), page.locator('#AddItemForm_submitButton').filter({ visible: true }).dblclick({ timeout: 15000 })]);
            await page.getByText('KEYBOARD_QA_' + prefix + '_double', { exact: true }).filter({ visible: true }).waitFor();
            await page.waitForLoadState('networkidle'); check(prefix + ' double-click persists one additional row', rowCount() === 2);
            console.log('PASS ' + prefix);
        }
    } catch (error) {
        checks.push({ name: 'Keyboard verification completes', passed: false, error: error.stack });
        if (page) await page.screenshot({ path: path.join(out, 'keyboard-failure.png'), fullPage: true }).catch(() => {});
    } finally {
        if (browser) await browser.close();
        const report = { productionAccess: false, checks, failures: checks.filter(c => !c.passed) };
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ checks: checks.length, failures: report.failures.length }));
        if (report.failures.length) process.exitCode = 1;
    }
})();
