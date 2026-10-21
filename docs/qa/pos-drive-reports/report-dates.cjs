// A local day in India is [18:30Z, next 18:30Z). Exercise stored timestamps, CSV/UI/PDF.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:18084', out = process.env.POS_DRIVE_OUT;
const runtime = process.env.POS_QA_NATIVE_ROOT, java = process.env.POS_QA_JAVA;
if (!out || !runtime || !java) throw Error('Disposable native paths required');
fs.mkdirSync(out, { recursive: true });
const classes = path.join(out, 'classes'); fs.mkdirSync(classes, { recursive: true });
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, '../pos-runtime/PosDbProbe.java')], { windowsHide: true });
const q = sql => JSON.parse(cp.execFileSync(java, ['-cp', classes + path.delimiter + path.join(runtime, 'WEB-INF/lib/h2-2.4.240.jar'), 'PosDbProbe'], {
    input: sql, encoding: 'utf8', windowsHide: true, env: { ...process.env, POS_QA_DB_URL: 'jdbc:h2:tcp://127.0.0.1:19096/mem:pos-qa;IFEXISTS=TRUE' }
}));
const checks = [];
function check(name, passed, evidence = {}) { checks.push({ name, passed: !!passed, evidence }); console.log((passed ? 'PASS ' : 'FAIL ') + name); }
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        for (let i = 0; ; i++) {
            try { if ((await fetch(base + '/Login')).status === 200) break; } catch {}
            if (i >= 60) throw Error('Disposable runtime did not become ready');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        async function actor(username) {
            const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
            const auth = await context.request.get(base + '/apps/zenith/Contacts/Customers', { headers: { Authorization: 'Basic ' + Buffer.from(username + ':moqui').toString('base64') } });
            const token = (await auth.text()).match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)[1];
            const post = async (screen, transition, data = {}) => (await context.request.post(base + '/apps/zenith/pos/' + screen + '/' + transition,
                { form: { moquiSessionToken: token, ...data }, maxRedirects: 0 })).json();
            return { context, post, invoke: (op, data) => post('PosQaAcceptance', 'invoke', { op, ...data }) };
        }
        if (!q("SELECT * FROM party WHERE party_id='POS_QA_A'").length) {
            const admin = await actor('john.doe');
            if (!(await admin.post('PosQaAcceptance', 'initialize')).initialized) throw Error('Synthetic fixture initialization failed');
            await admin.context.close();
        }
        const a = await actor('pos.qa');
        const session = (await a.invoke('open', { terminalId: 'POS_QA_A_TERM2', openingCash: '0' })).result.sessionId;
        const ids = [], names = ['before','start','end','next'];
        for (const [index,name] of names.entries()) {
            const amount = 100 + index * 10;
            const bill = await a.invoke('cart', { sessionId: session, customerName: 'TZ QA ' + name });
            const id = bill.result.transactionId; ids.push(id);
            const add = await a.invoke('add', { transactionId: id, productId: 'POS_QA_A_P18', quantity: '1', taxOn: 'N' });
            for (const price of [String(amount + 1), String(amount)]) {
                const changed = await a.post('Terminal', 'ajaxCart', { action: 'updatePrice', transactionId: id, itemSeqId: add.result.itemSeqId, newPrice: price, taxOn: 'N' });
                if (!changed.success) throw Error('Synthetic price fixture failed');
            }
            await a.invoke('pay', { transactionId: id, paymentMethod: 'Cash', amount: String(amount) });
            await a.invoke('complete', { transactionId: id });
        }
        check('Four synthetic bills are placed around local midnight', (await a.post('PosQaAcceptance', 'reportBoundaryFixtures', { transactionIdsJson: JSON.stringify(ids) })).prepared === true);
        const page = await a.context.newPage();
        const query = '?fromDate=2026-01-15&thruDate=2026-01-15';
        for (const shell of ['apps','qapps']) {
            const report = await a.context.request.get(base + '/' + shell + '/zenith/pos/Reports/BillWise/exportCsv' + query);
            const text = await report.text();
            check(shell + ' bill CSV includes start and final millisecond, excludes adjacent days', report.status() === 200 &&
                text.includes('TZ QA start') && text.includes('TZ QA end') && !text.includes('TZ QA before') && !text.includes('TZ QA next'), { csv: text });
            await page.goto(base + '/' + shell + '/zenith/pos/Reports/BillWise' + query, { waitUntil: 'networkidle' });
            const body = await page.locator('body').innerText();
            check(shell + ' bill UI follows the same local day as export', body.includes('TZ QA start') && body.includes('TZ QA end') && !body.includes('TZ QA before') && !body.includes('TZ QA next'));
            await page.screenshot({ path: path.join(out, shell + '-local-day.png'), fullPage: true });
            const items = await a.context.request.get(base + '/' + shell + '/zenith/pos/Reports/ItemWise/exportCsv' + query);
            const itemText = await items.text();
            check(shell + ' item report reconciles two sales and 230 net', items.status() === 200 && /,2(?:\.0+)?,/.test(itemText) && /230\.00/.test(itemText), { csv: itemText });
            const audit = await a.context.request.get(base + '/' + shell + '/zenith/pos/PriceOverrides/exportCsv' + query);
            const auditText = await audit.text(), rows = auditText.split(/\r?\n/).filter(line => /Disposable POS A P18/.test(line));
            check(shell + ' price audit includes four in-day overrides', audit.status() === 200 && rows.length === 4 && rows.every(row => /^"?15-01-2026 /.test(row)), { rows });
            // qapps initially serves the SPA shell; inspect its actual rendered subscreen.
            const owner = await a.context.request.get(base + '/' + shell + '/zenith/pos/OwnerDashboard' + (shell === 'qapps' ? '.vuet' : '') + '?dashDate=2026-01-15&dashDateTo=2026-01-15');
            const ownerHtml = await owner.text();
            const weekly = ownerHtml.match(/week:\{cats:\[[^\]]*\],series:(\[[^\]]*\])/);
            const values = weekly ? JSON.parse(weekly[1]) : [];
            check(shell + ' owner weekly chart includes exact midnight and excludes the next day', owner.status() === 200 && values.length === 7 && values[6] === 230, { values });
        }
        const pdf = await a.context.request.get(base + '/fop/apps/zenith/pos/Reports/BillWisePdf' + query);
        const file = path.join(out, 'local-day-bill-report.pdf'); fs.writeFileSync(file, await pdf.body());
        const text = cp.execFileSync(process.env.POS_QA_PYTHON || 'python', ['-c', 'import pdfplumber,sys; p=pdfplumber.open(sys.argv[1]); print(" ".join((x.extract_text() or "") for x in p.pages))', file], { encoding: 'utf8', windowsHide: true }).replace(/\s+/g, ' ');
        check('PDF follows the same local day as screen and CSV', pdf.status() === 200 && text.includes('TZ QA start') && text.includes('TZ QA end') && !text.includes('TZ QA before') && !text.includes('TZ QA next'));
    } catch (error) { check('Local-day report verification completes', false, { error: error.stack }); }
    finally {
        await browser.close();
        const report = { productionAccess: false, checks, failures: checks.filter(row => !row.passed) };
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
        if (report.failures.length) process.exitCode = 1;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
