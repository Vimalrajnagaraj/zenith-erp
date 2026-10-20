// Real PO status controls against the disposable PurchaseRemaining fixture only.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const {chromium} = require('playwright');
const base = 'http://127.0.0.1:18085', root = process.env.PURCHASE_QA_RUNTIME, java = process.env.PURCHASE_QA_JAVA, out = process.env.PURCHASE_QA_OUT;
assert(root && java && out, 'Configure disposable Purchase runtime');
const classes = path.join(out, 'classes'); fs.mkdirSync(classes, {recursive:true});
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, 'PurchaseRemainingDbProbe.java')], {windowsHide:true});
function q(sql) { assert.match(sql, /^SELECT /i); return JSON.parse(cp.execFileSync(java, ['-cp', path.join(root, 'WEB-INF/lib/h2-2.4.240.jar') + path.delimiter + classes, 'PurchaseRemainingDbProbe'], {input:sql, encoding:'utf8', windowsHide:true})); }
const checks = [];
function check(name, passed, evidence = {}) { checks.push({name, passed:!!passed, evidence}); }
(async () => {
    const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try {
        const admin = await browser.newContext();
        const deadline = Date.now() + 150000;
        for (;;) {
            try { const response = await admin.request.get(base + '/apps/zenith/Purchase/FindPurchaseOrder', {timeout:120000, headers:{Authorization:'Basic ' + Buffer.from('john.doe:moqui').toString('base64')}}); if (response.status()===200) break; }
            catch (error) { if (Date.now()>deadline) throw error; }
            if (Date.now()>deadline) throw Error('Disposable Purchase runtime not ready');
            await new Promise(resolve=>setTimeout(resolve,1000));
        }
        if (!q("SELECT party_id FROM party WHERE party_id='PP_QA_A'").length) {
            const p = await admin.newPage(); await p.goto(base + '/apps/zenith/Purchase/FindPurchaseOrder', {waitUntil:'networkidle', timeout:120000});
            const token = await p.locator('[name=moquiSessionToken]').first().inputValue();
            const response = await admin.request.post(base + '/apps/zenith/pricing/PurchaseRemainingQaAcceptance/initialize', {form:{moquiSessionToken:token}});
            assert((await response.json()).initialized);
        }
        await admin.close();
        for (const shell of ['apps', 'qapps']) {
            const ctx = await browser.newContext({viewport:{width:1366, height:900}});
            try {
                await ctx.request.get(base + '/apps/zenith/Purchase/FindPurchaseOrder', {headers:{Authorization:'Basic ' + Buffer.from('purchase.pricing.qa:moqui').toString('base64')}});
                const page = await ctx.newPage(); page.setDefaultNavigationTimeout(120000);
                await page.goto(base + '/apps/zenith/Purchase/FindPurchaseOrder', {waitUntil:'networkidle'});
                const token = await page.locator('[name=moquiSessionToken]').first().inputValue();
                const post = (action, form) => ctx.request.post(`${base}/${shell}/zenith/Purchase/${action}`, {form:{moquiSessionToken:token, ...form}, maxRedirects:0});
                const response = await post('FindPurchaseOrder/createOrder', {vendorPartyId:'PP_QA_SUPPLIER_A'});
                const id = new URL(response.headers().location, base).searchParams.get('orderId'); assert.match(id, /^[A-Za-z0-9_-]+$/);
                await post('EditPurchaseOrder/addItem', {orderId:id, productId:'PP_QA_PRODUCT_A', quantity:'1', unitAmount:'100'});
                const rejected = await post('EditPurchaseOrder/updateOrder', {orderId:id, statusId:'OrderCompleted'});
                check(shell + ' direct completion from Open is rejected without writes or exception', rejected.status()<500 && q(`SELECT status_id FROM order_header WHERE order_id='${id}'`)[0].status_id==='OrderOpen');
                await page.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseOrder?orderId=${id}`, {waitUntil:'networkidle'});
                const form = page.locator('#StatusForm'); await form.waitFor();
                const allowed = q("SELECT to_status_id FROM status_flow_transition WHERE status_flow_id='Default' AND status_id='OrderOpen'").map(r=>r.to_status_id);
                let offered;
                if (shell === 'apps') {
                    offered = await form.locator('select[name=statusId] option').evaluateAll(els=>els.map(e=>e.value));
                    await form.locator('select[name=statusId]').selectOption('OrderPlaced');
                } else {
                    await form.getByRole('combobox').click();
                    offered = await page.getByRole('option').allTextContents();
                    const validDescriptions = q("SELECT status_id,description FROM status_item WHERE status_type_id='OrderHeader'").filter(r=>r.status_id==='OrderOpen'||allowed.includes(r.status_id)).map(r=>r.description);
                    check(shell + ' shows only current and permitted next statuses', offered.every(t=>validDescriptions.includes(t.trim())), {offered, validDescriptions});
                    await page.screenshot({path:path.join(out, shell + '-order-status-options.png'), fullPage:true});
                    await page.getByRole('option', {name:'Placed by Customer', exact:true}).click();
                }
                if (shell === 'apps') check(shell + ' shows only current and permitted next statuses', offered.every(s=>s==='OrderOpen'||allowed.includes(s)), {offered, allowed});
                const pending = page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes('/updateOrder'));
                await form.getByRole('button', {name:'Update Status', exact:true}).click(); const updated = await pending;
                await page.waitForLoadState('networkidle');
                const header = q(`SELECT status_id FROM order_header WHERE order_id='${id}'`)[0];
                const part = q(`SELECT status_id FROM order_part WHERE order_id='${id}'`)[0];
                check(shell + ' actual Update Status updates canonical header and part', updated.status()<400 && ['OrderPlaced','OrderApproved'].includes(header.status_id) && header.status_id===part.status_id, {httpStatus:updated.status(), header, part});
                for (const [next, description] of [['OrderApproved','Approved'],['OrderCompleted','Completed']]) {
                    await page.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseOrder?orderId=${id}`, {waitUntil:'networkidle'});
                    await page.locator('#StatusForm').waitFor();
                    if (shell==='apps') await page.locator('#StatusForm select[name=statusId]').selectOption(next);
                    else { await page.locator('#StatusForm').getByRole('combobox').click(); await page.getByRole('option', {name:description, exact:true}).click(); }
                    const pendingNext = page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes('/updateOrder'));
                    await page.locator('#StatusForm').getByRole('button', {name:'Update Status', exact:true}).click(); const result=await pendingNext;
                    await page.waitForLoadState('networkidle');
                    const status = q(`SELECT status_id FROM order_header WHERE order_id='${id}'`)[0].status_id;
                    const partStatus = q(`SELECT status_id FROM order_part WHERE order_id='${id}'`)[0].status_id;
                    check(shell + ' actual workflow reaches ' + next, result.status()<400 && status===next && partStatus===next, {httpStatus:result.status(), status, partStatus});
                }
                await page.screenshot({path:path.join(out, shell + '-order-status.png'), fullPage:true});
            } finally { await ctx.close(); }
        }
    } finally { await browser.close(); fs.writeFileSync(path.join(out, 'order-status.json'), JSON.stringify(checks, null, 2)); }
    console.log(JSON.stringify(checks)); assert(checks.every(c=>c.passed), 'Purchase status checks failed');
})().catch(error=>{console.error(error); process.exitCode=1;});
