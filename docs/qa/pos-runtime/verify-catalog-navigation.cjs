// Run after verify-runtime.cjs on the disposable loopback POS QA runtime.
// Response interception tests navigation races without changing business records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const base = process.env.POS_QA_BASE || 'http://127.0.0.1:18084';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out = process.env.POS_QA_OUT;
const sessionId=process.env.POS_QA_SESSION_ID || '';
if(sessionId)assert.match(sessionId,/^[A-Za-z0-9_-]{1,40}$/);
const results = [];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const bounded = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('Expected catalog request did not finish')), 10000))]);
const catalog = label => JSON.stringify({success:true,products:[{productId:'CATALOG_PROOF_'+label,name:label,
    price:10,priceText:'10',stockText:'Stock: not tracked',blocked:false}],hasMore:false,nextOffset:1});

(async () => {
    const browser = await chromium.launch({headless: true,
        executablePath: process.env.POS_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try {
        for (const name of ['search-order', 'category-order', 'network-failure', 'http-failure', 'cache-reuse']) {
            const context = await browser.newContext({viewport: {width: 1366, height: 768}, serviceWorkers: 'block'});
            await context.request.get(base+'/apps/zenith/pos/Terminal',{
                headers:{Authorization:'Basic '+Buffer.from('pos.qa:moqui').toString('base64')}
            });
            const page = await context.newPage();
            const requested = deferred(), release = deferred(), finished = deferred();
            try {
                await page.goto(base + '/apps/zenith/pos/Terminal'+(sessionId?'?sessionId='+encodeURIComponent(sessionId):''), {waitUntil: 'networkidle'});
                await page.waitForFunction(() => typeof window._gridSearch === 'function',undefined,{timeout:10000});
                await page.evaluate(() => { if (document.body.classList.contains('pos-mode-normal')) window.posToggleLayout(); });
                const before = await page.locator('.pos-cart tbody').innerText();
                let allRequests=0;
                await page.route(url => /\/Terminal\/productGrid$/.test(url.pathname), async route => {
                    const params = new URLSearchParams(route.request().postData()||'');
                    if(name==='cache-reuse'){
                        const all=!params.get('searchTerm');
                        if(all&&++allRequests===2){requested.resolve();await release.promise;}
                        await route.fulfill({contentType:'application/json',body:catalog(all?'cached-all':'search')});
                        if(allRequests===2)finished.resolve();
                        return;
                    }
                    const slow = params.get('searchTerm') === 'old' || (name === 'category-order' && params.get('catId'));
                    if (slow) { requested.resolve(); await release.promise; }
                    if (name === 'network-failure') await route.abort('failed');
                    else await route.fulfill({status: name === 'http-failure' ? 503 : 200,
                        contentType: 'application/json', body: catalog(slow ? 'old' : 'latest')});
                    if (slow || name.includes('failure')) finished.resolve();
                });
                if (name === 'search-order') {
                    await page.evaluate(() => { window._gridSearch('old'); });
                    await bounded(requested.promise);
                    await page.evaluate(() => { window._gridSearch('latest'); });
                    await page.locator('[data-product-id="CATALOG_PROOF_latest"]').waitFor({state:'attached'});
                    release.resolve(); await bounded(finished.promise);
                    await page.waitForTimeout(150);
                    assert.equal(await page.locator('[data-product-id="CATALOG_PROOF_latest"]').count(), 1,
                        'A delayed search must not replace the latest search');
                } else if (name === 'category-order') {
                    const links = page.locator('.pos-cat-strip a');
                    await links.filter({hasText: 'Disposable POS A category'}).click();
                    await bounded(requested.promise);
                    await links.filter({hasText: /ALL ITEMS/i}).click();
                    release.resolve(); await bounded(finished.promise);
                    await page.waitForTimeout(150);
                    assert.equal(await page.locator('[data-product-id="CATALOG_PROOF_old"]').count(), 0,
                        'A delayed category must not replace All Items');
                } else if(name==='cache-reuse'){
                    await page.evaluate(()=>window._gridSearch(''));
                    await page.evaluate(()=>window._gridSearch('changed'));
                    await page.locator('.pos-cat-strip a').filter({hasText:/ALL ITEMS/i}).click();
                    await bounded(requested.promise);
                    const state=await page.locator('.pos-product-grid').evaluate(grid=>({
                        cached:!!grid.querySelector('[data-product-id="CATALOG_PROOF_cached-all"]'),
                        usable:getComputedStyle(grid).pointerEvents!=='none'
                    }));
                    release.resolve();await bounded(finished.promise);
                    assert.ok(state.cached&&state.usable,'Repeated All Items navigation must restore the refreshed cache before the network replies');
                } else {
                    await page.evaluate(() => { window._gridSearch('failure'); });
                    await bounded(finished.promise); await page.waitForTimeout(150);
                    const state = await page.locator('.pos-product-grid').evaluate(grid => ({
                        opacity: getComputedStyle(grid).opacity, disabled: getComputedStyle(grid).pointerEvents === 'none',
                        badResponse: !!grid.querySelector('[data-product-id^="CATALOG_PROOF_"]')
                    }));
                    assert.equal(state.disabled, false, 'Failed catalog navigation must restore product controls');
                    assert.equal(state.opacity, '1', 'Failed catalog navigation must restore visible products');
                    assert.equal(state.badResponse, false, 'An HTTP error must not replace the current catalog');
                }
                assert.equal(await page.locator('.pos-cart tbody').innerText(), before, 'Navigation preserves the cart');
                results.push({name, passed: true});
            } catch (error) { results.push({name, passed: false, error: error.message}); console.error(name+': '+error.message); }
            finally { release.resolve(); await context.close(); console.log(name+' navigation check finished'); }
        }
    } finally { await browser.close(); }
    if (out) { fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'catalog-navigation.json'), JSON.stringify(results, null, 2)); }
    console.log(JSON.stringify(results, null, 2));
    if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
