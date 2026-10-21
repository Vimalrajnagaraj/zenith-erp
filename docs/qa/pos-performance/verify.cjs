// Run only on the disposable POS runtime, with its guarded QA helper installed.
const fs = require('fs'), path = require('path');
const { chromium, webkit } = require('playwright');
const base = process.env.POS_QA_BASE || 'http://127.0.0.1:18084';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Disposable loopback required');
const out = process.env.POS_PERF_OUT;
if (!out) throw Error('POS_PERF_OUT is required');
fs.mkdirSync(out, { recursive: true });
const report = { productionAccess: false, checks: [], timings: [], browsers: [], errors: [] };
const performanceTerminal='POS_QA_PERF_'+Date.now().toString(36);
function check(name, passed, evidence) { report.checks.push({ name, passed: !!passed, evidence }); }
async function login(browser, username = 'pos.qa') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers:'block' });
    if (process.env.POS_PERF_SOURCE_SCRIPT) {
        await ctx.route('**/*pos-terminal.js*', r => {
            report.sourceOverrides=(report.sourceOverrides||0)+1;
            return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.POS_PERF_SOURCE_SCRIPT,'utf8')});
        });
    }
    const screen = username === 'john.doe' ? '/apps/zenith/Contacts/Customers' : '/apps/zenith/pos/Terminal';
    const r = await ctx.request.get(base + screen, {
        headers: { Authorization: 'Basic ' + Buffer.from(username + ':moqui').toString('base64') }
    });
    if (r.status() !== 200) throw Error('Disposable login failed: ' + r.status());
    const p = await ctx.newPage();
    await p.goto(base + screen, { waitUntil: 'networkidle' });
    const token = await p.locator('[name=moquiSessionToken]').first().inputValue();
    return { ctx, p, token };
}
async function invoke(a, op, params = {}) {
    const r = await a.ctx.request.post(base + '/apps/zenith/pos/PosQaAcceptance/invoke', {
        form: { moquiSessionToken: a.token, op, ...params }
    });
    const b = await r.json();
    if (r.status() !== 200 || b.errors?.length) throw Error(op + ': ' + JSON.stringify(b));
    return b.result || {};
}
(async () => {
    const bootstrap = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        if (process.env.POS_PERF_INITIALIZE === 'true') {
            const a = await login(bootstrap, 'john.doe');
            const r = await a.ctx.request.post(base + '/apps/zenith/pos/PosQaAcceptance/initialize', { form: { moquiSessionToken: a.token } });
            if (!(await r.json()).initialized) throw Error('Fixture initialization failed');
            await a.ctx.close();
        }
        const a = await login(bootstrap);
        const terminal=await a.ctx.request.post(base+'/apps/zenith/pos/PosTerminals/createTerminal',{
            form:{terminalId:performanceTerminal,terminalName:'Disposable browser performance counter',facilityId:'POS_QA_A_FAC',
                organizationPartyId:'POS_QA_A',stateCode:'33',isActive:'Y',moquiSessionToken:a.token},maxRedirects:0
        });
        if(terminal.status()>=400)throw Error('Disposable performance terminal creation failed');
        if (process.env.POS_PERF_SEED === 'true') {
            for (let n = 0; n < 75; n++) await invoke(a, 'importProduct', {
                sku: 'POS_PERF_' + String(n).padStart(3, '0'), productName: 'Disposable performance product ' + n,
                listPrice: '10', mrp: '10'
            });
        }
        await a.ctx.close();
    } finally { await bootstrap.close(); }
    const engines = [
        ['Chrome', chromium, { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }],
        ['Edge', chromium, { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }],
        ['WebKit', webkit, {}]
    ];
    for (const [name, engine, options] of engines) {
        if (process.env.POS_PERF_ENGINES && !process.env.POS_PERF_ENGINES.split(',').includes(name)) continue;
        const browser = await engine.launch({ headless: true, ...options });
        try {
            const a = await login(browser), p = a.p;
            report.browsers.push({ name, version: browser.version(), safariDeviceTest: false });
            p.on('pageerror', e => report.errors.push({ browser: name, message: e.message, stack:e.stack,
                phase:report.checks.at(-1)?.name || 'initial load' }));
            p.on('dialog', d => d.dismiss());
            const s = await invoke(a, 'open', { terminalId: performanceTerminal, openingCash: '0' });
            const t = await invoke(a, 'cart', { sessionId: s.sessionId });
            await invoke(a, 'add', { transactionId: t.transactionId, productId: 'POS_QA_A_P18', quantity: '1', taxOn: 'N' });
            await invoke(a, 'add', { transactionId: t.transactionId, productId: 'POS_QA_A_P5', quantity: '1', taxOn: 'N' });
            await p.goto(`${base}/apps/zenith/pos/Terminal?sessionId=${s.sessionId}&transactionId=${t.transactionId}&taxOn=N`, { waitUntil: 'networkidle' });
            await p.waitForFunction(() => typeof window._posRefreshCart === 'function');
            await p.evaluate(() => window._posRefreshCart());
            const burst = await p.evaluate(async () => {
                const row = Array.from(document.querySelectorAll('.pos-cart tbody tr')).find(r => r.textContent.includes('POS_QA_A_P18'));
                const startQty = Number(row.querySelector('.aj-qi').value), start = performance.now();
                for (let n = 0; n < 20; n++) window._posAjax('POS_QA_A_P18', 100, 'Disposable POS A P18');
                // Mix a relative row edit with additions before the scheduled frame.
                Array.from(document.querySelectorAll('.pos-cart tbody tr')).find(r => r.textContent.includes('POS_QA_A_P18')).querySelectorAll('.aj-q')[1].click();
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const current = Array.from(document.querySelectorAll('.pos-cart tbody tr')).find(r => r.textContent.includes('POS_QA_A_P18'));
                return { ms: performance.now() - start, quantity: Number(current.querySelector('.aj-qi').value), expected: startQty + 21 };
            });
            report.timings.push({ browser: name, operation: '20-add-burst-plus-edit-to-frame-ms', ms: burst.ms });
            check(name + ' burst paints the complete cart including an immediate quantity step', burst.quantity === burst.expected, burst);
            // Keep an unsaved rate draft in the second row while another product is tapped.
            await p.evaluate(() => {
                const rows = document.querySelectorAll('.pos-cart tbody tr');
                window.perfRow = rows[1];
                window.perfInput = rows[1].querySelector('.aj-p');
                window.perfInput.value = '207.25';
                window.perfInput.focus();
                window.perfMutations = 0;
                new MutationObserver(ms => { window.perfMutations += ms.filter(m => m.type === 'childList').length; })
                    .observe(document.querySelector('.pos-cart tbody'), { subtree: true, childList: true });
            });
            for (let n = 0; n < 10; n++) {
                const timing = await p.evaluate(() => {
                    const start = performance.now();
                    window._posAjax('POS_QA_A_P18', 100, 'Disposable POS A P18');
                    return performance.now() - start;
                });
                report.timings.push({ browser: name, operation: 'optimistic-add-js-ms', ms: timing });
            }
            // Payment gate drains the existing queue; refresh after it is idle for authoritative state.
            await p.waitForFunction(() => document.querySelector('.aj-q')?.dataset.seq?.indexOf('t#') !== 0);
            await p.waitForTimeout(1500);
            const identity = await p.evaluate(() => ({
                sameRow: window.perfRow === document.querySelectorAll('.pos-cart tbody tr')[1],
                draft: window.perfInput.value, focused: document.activeElement === window.perfInput,
                connected: window.perfInput.isConnected, mutations: window.perfMutations
            }));
            check(name + ' keeps unaffected cart rows, draft and input focus', identity.sameRow && identity.connected && identity.focused && identity.draft === '207.25', identity);
            // Leave draft editing, then ensure the authoritative refresh remains available.
            await p.evaluate(() => document.activeElement.blur());
            await p.evaluate(() => window._posRefreshCart());
            const catalog = [];
            p.on('response', async r => {
                if (r.url().includes('Terminal.qvt') || r.url().includes('Terminal/productGrid')) {
                    try { catalog.push({ url: new URL(r.url()).pathname, bytes: (await r.body()).length, status: r.status() }); } catch (_) {}
                }
            });
            const cat = p.locator('.pos-cat-strip a').filter({ hasText: 'Disposable POS A category' });
            const before = Date.now();
            await cat.click();
            await p.waitForFunction(() => document.querySelector('.pos-product-grid')?.getAttribute('aria-busy') === 'false');
            report.timings.push({ browser: name, operation: 'category-ready-ms', ms: Date.now() - before });
            await p.waitForTimeout(100);
            check(name + ' category uses bounded catalog response without full terminal render', catalog.length === 1 && catalog[0].url.endsWith('/productGrid') && catalog[0].bytes < 50000, JSON.parse(JSON.stringify(catalog)));
            const response = await a.ctx.request.post(base + '/apps/zenith/pos/Terminal/productGrid', {
                form: { sessionId: s.sessionId, salesModeId: 'RETAIL', moquiSessionToken: a.token }
            });
            let data; try { data = await response.json(); } catch (_) { data = {}; }
            check(name + ' catalog pagination is bounded and has no tenant credentials', response.status() === 200 && data.success && data.products?.length <= 60 && !JSON.stringify(data).includes('moquiSessionToken'), { status: response.status(), size: data.products?.length, hasMore: data.hasMore });
            if (data.success) {
                const more = await a.ctx.request.post(base + '/apps/zenith/pos/Terminal/productGrid', {form:{sessionId:s.sessionId,salesModeId:'RETAIL',productOffset:String(data.nextOffset),moquiSessionToken:a.token}});
                const next = await more.json();
                check(name + ' second catalog page has no repeated products', data.hasMore && next.success && next.products.length > 0 && !next.products.some(x => data.products.some(y => x.productId === y.productId)));
                await p.evaluate(() => {
                    document.getElementById('cartInlineSearch').value='Disposable performance product';
                    return window._gridSearch('Disposable performance product');
                });
                const all = p.locator('.pos-product-grid .pos-load-more');
                const count = await p.locator('.pos-product-grid form').count();
                await all.click();
                await p.waitForFunction(n => document.querySelectorAll('.pos-product-grid form').length > n, count);
                check(name + ' Load more keeps the existing cards and appends the next page', await p.locator('.pos-product-grid form').count() === 75);
                const tile=p.locator('.pos-product-grid button[type=submit]').first();
                await tile.dispatchEvent('pointerdown', {pointerType:'touch'});
                check(name + ' product press has no delayed scale animation', await tile.evaluate(el=>el.style.transform===''));
                for(const taxOn of ['N','Y']) {
                    const r=await a.ctx.request.post(base+'/apps/zenith/pos/Terminal/ajaxCart',{form:{action:'refresh',sessionId:s.sessionId,transactionId:t.transactionId,salesModeId:'RETAIL',taxOn,moquiSessionToken:a.token}});
                    const b=await r.json();
                    check(name+' authoritative cart remains readable with tax '+taxOn,r.status()===200&&b.success&&b.items.length===2);
                }
            }
            await p.evaluate(()=>{
                document.querySelectorAll('.aj-p').forEach(input=>{input.value=input.defaultValue;});
                document.querySelector('.pos-product-grid').scrollTop=0;
            });
            await p.screenshot({ path: path.join(out, name + '-terminal.png'), fullPage: false });
            for(const width of [390,800]){
                await p.setViewportSize({width,height:900});
                const dimensions=await p.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,grid:document.querySelector('.pos-product-grid').getBoundingClientRect().width}));
                const pay=p.locator('#pos-pay-cash');await pay.scrollIntoViewIfNeeded();
                check(name+' '+width+'px catalog and payment controls fit',dimensions.document<=width+2&&dimensions.grid>0&&await pay.isVisible(),dimensions);
            }
            await p.setViewportSize({width:1440,height:900});
            await p.evaluate(()=>document.activeElement.blur());
            await p.keyboard.press('Tab');await p.keyboard.press('7');await p.keyboard.press('Enter');
            await p.waitForLoadState('networkidle');
            check(name+' numeric keyboard quantity entry remains absolute',Number(await p.locator('.pos-cart .aj-qi').first().inputValue())===7);
            await invoke(a, 'void', { transactionId: t.transactionId });
            await invoke(a, 'close', { sessionId: s.sessionId, closingCash: '0' });
            await p.waitForLoadState('networkidle');
            await a.ctx.close();
            console.log(name + ' performance checks complete');
        } finally { await browser.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
    }
    check('no uncaught browser errors', report.errors.length === 0, report.errors);
    if(process.env.POS_PERF_SOURCE_SCRIPT)check('baseline JavaScript override actually ran',report.sourceOverrides>0,report.sourceOverrides);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const failures = report.checks.filter(c => !c.passed);
    console.log(JSON.stringify({ checks: report.checks.length, failures: failures.length }));
    if (failures.length) process.exitCode = 1;
})().catch(e => { console.error(e.stack); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ ...report, fatal: e.message }, null, 2)); process.exitCode = 1; });
