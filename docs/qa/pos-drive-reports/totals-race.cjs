// Force a stale-total calculation to overlap a real add. No SQL writes or mocks.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:18084', out = process.env.POS_DRIVE_OUT;
const runtime = process.env.POS_QA_NATIVE_ROOT, java = process.env.POS_QA_JAVA;
if (!out || !runtime || !java) throw Error('Disposable native fixture paths required');
fs.mkdirSync(out, { recursive: true });
const classes = path.join(out, 'classes'); fs.mkdirSync(classes, { recursive: true });
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, '../pos-runtime/PosDbProbe.java')], { windowsHide: true });
const q = sql => JSON.parse(cp.execFileSync(java, ['-cp', classes + path.delimiter + path.join(runtime, 'WEB-INF/lib/h2-2.4.240.jar'), 'PosDbProbe'], {
    input: sql, encoding: 'utf8', windowsHide: true, env: { ...process.env, POS_QA_DB_URL: 'jdbc:h2:tcp://127.0.0.1:19096/mem:pos-qa;IFEXISTS=TRUE' }
}));
const checks = [];
function check(name, passed, evidence) { checks.push({ name, passed: !!passed, evidence }); console.log((passed ? 'PASS ' : 'FAIL ') + name); }
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        for (let i = 0; ; i++) {
            try { if ((await fetch(base + '/Login')).status === 200) break; } catch {}
            if (i >= 60) throw Error('Disposable runtime did not become ready');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!q("SELECT * FROM party WHERE party_id='POS_QA_A'").length) {
            const bootstrap = await browser.newContext();
            const auth = await bootstrap.request.get(base + '/apps/zenith/Contacts/Customers', { headers: { Authorization: 'Basic ' + Buffer.from('john.doe:moqui').toString('base64') } });
            const token = (await auth.text()).match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)[1];
            const result = await bootstrap.request.post(base + '/apps/zenith/pos/PosQaAcceptance/initialize', { form: { moquiSessionToken: token } });
            if (!(await result.json()).initialized) throw Error('Disposable fixture initialization failed');
            await bootstrap.close();
        }
        const context = await browser.newContext();
        const auth = await context.request.get(base + '/apps/zenith/Contacts/Customers', { headers: { Authorization: 'Basic ' + Buffer.from('pos.qa:moqui').toString('base64') } });
        const token = (await auth.text()).match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)[1];
        const post = async (screen, transition, data) => (await context.request.post(base + '/apps/zenith/pos/' + screen + '/' + transition,
            { form: { moquiSessionToken: token, ...data }, maxRedirects: 0 })).json();
        const invoke = async (op, data) => post('PosQaAcceptance', 'invoke', { op, ...data });
        const control = async (op, transactionId, extra = {}) => post('PosQaTotalsRace', 'control', { op, transactionId, ...extra });
        let session = q("SELECT session_id FROM pos_session WHERE organization_party_id='POS_QA_A' AND status_id='PsOpen'")[0];
        if (!session) session = { session_id: (await invoke('open', { terminalId: 'POS_QA_A_TERM1', openingCash: '0' })).result.sessionId };
        // Clean only synthetic open carts left by the stopped regression run.
        for (const cart of q("SELECT transaction_id FROM pos_transaction WHERE organization_party_id='POS_QA_A' AND status_id='PtCreated'")) await invoke('void', { transactionId: cart.transaction_id });
        const warm = (await invoke('cart', { sessionId: session.session_id })).result.transactionId;
        await invoke('add', { transactionId: warm, productId: 'POS_QA_A_P18', quantity: '1' });
        await invoke('void', { transactionId: warm });
        for (const route of ['totals', 'reprice', 'mode', 'remove']) {
            const created = await invoke('cart', { sessionId: session.session_id });
            const id = created.result.transactionId;
            if (['mode','remove'].includes(route)) await invoke('add', { transactionId: id, productId: 'POS_QA_A_P18', quantity: '1' });
            check(route + ' scheduling barrier is prepared for own open bill', (await control('prepare', id)).prepared === true);
            const calculating = control('pause', id, { path: route }).catch(error => ({ errors: [error.message] }));
            let reached = false;
            for (let i = 0; i < 50; i++) {
                if ((await control('state', id)).reached) { reached = true; break; }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            check(route + ' real calculation reaches the pre-update barrier', reached);
            const adding = invoke('add', { transactionId: id, productId: 'POS_QA_A_P18', quantity: '1' }).catch(error => ({ errors: [error.message] }));
            let committedBeforeRelease = false;
            for (let i = 0; i < 12; i++) {
                if (q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}'`).length) { committedBeforeRelease = true; break; }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            await control('release', id);
            const [calculated, added] = await Promise.all([calculating, adding]);
            const header = q(`SELECT * FROM pos_transaction WHERE transaction_id='${id}'`)[0];
            const lines = q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}'`);
            const quantity = lines.reduce((sum,line) => sum + Number(line.quantity),0);
            const subtotal = lines.reduce((sum,line) => sum + Number(line.taxable_amount),0);
            const tax = lines.reduce((sum,line) => sum + Number(line.total_tax_amount),0);
            check(route + ' both real requests complete without an error', Array.isArray(calculated.errors) && !calculated.errors.length && Array.isArray(added.errors) && !added.errors.length, { calculated, added });
            check(route + ' concurrent add preserves every item and its header total', quantity === (route === 'mode' ? 2 : 1) &&
                Number(header.subtotal) === subtotal && Number(header.total_tax_amount) === tax &&
                (route === 'mode' ? subtotal > 0 : subtotal === 100 && tax === 18 && Number(header.payable_amount) === 118),
                { committedBeforeRelease, header, lines });
            await invoke('void', { transactionId: id });
        }
    } catch (error) { check('Scheduling regression completes', false, { error: error.stack }); }
    finally {
        await browser.close();
        const report = { productionAccess: false, checks, failures: checks.filter(row => !row.passed) };
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
        if (report.failures.length) process.exitCode = 1;
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
