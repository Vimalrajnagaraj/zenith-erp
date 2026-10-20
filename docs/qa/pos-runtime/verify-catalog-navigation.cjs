// Run after verify-runtime.cjs on the disposable loopback POS QA runtime.
// Response interception tests navigation races without changing business records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const base = process.env.POS_QA_BASE || 'http://127.0.0.1:18084';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const out = process.env.POS_QA_OUT;
const results = [];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
const bounded = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('Expected catalog request did not finish')), 10000))]);
const html = label => `<div class="pos-product-grid"><button data-catalog-proof="${label}">${label}</button></div>`;

(async () => {
    const browser = await chromium.launch({headless: true,
        executablePath: process.env.POS_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try {
        for (const name of ['search-order', 'category-order', 'network-failure', 'http-failure']) {
            const context = await browser.newContext({viewport: {width: 1366, height: 768}, serviceWorkers: 'block',
                extraHTTPHeaders: {Authorization: 'Basic ' + Buffer.from('pos.qa:moqui').toString('base64')}});
            const page = await context.newPage();
            try {
                await page.goto(base + '/apps/zenith/pos/Terminal', {waitUntil: 'networkidle'});
                await page.waitForFunction(() => typeof window._gridSearch === 'function');
                await page.evaluate(() => { if (document.body.classList.contains('pos-mode-normal')) window.posToggleLayout(); });
                const before = await page.locator('.pos-cart tbody').innerText();
                const requested = deferred(), release = deferred(), finished = deferred();
                await page.route(url => /\/Terminal\.qvt$/.test(url.pathname), async route => {
                    const params = new URL(route.request().url()).searchParams;
                    const slow = params.get('searchTerm') === 'old' || (name === 'category-order' && params.get('catId'));
                    if (slow) { requested.resolve(); await release.promise; }
                    if (name === 'network-failure') await route.abort('failed');
                    else await route.fulfill({status: name === 'http-failure' ? 503 : 200,
                        contentType: 'text/html', body: html(slow ? 'old' : 'latest')});
                    if (slow || name.includes('failure')) finished.resolve();
                });
                if (name === 'search-order') {
                    await page.evaluate(() => { window._gridSearch('old'); });
                    await bounded(requested.promise);
                    await page.evaluate(() => { window._gridSearch('latest'); });
                    await page.locator('[data-catalog-proof="latest"]').waitFor();
                    release.resolve(); await bounded(finished.promise);
                    await page.waitForTimeout(150);
                    assert.equal(await page.locator('[data-catalog-proof="latest"]').count(), 1,
                        'A delayed search must not replace the latest search');
                } else if (name === 'category-order') {
                    const links = page.locator('.pos-cat-strip a');
                    await links.filter({hasText: 'Disposable POS A category'}).click();
                    await bounded(requested.promise);
                    await links.filter({hasText: /ALL ITEMS/i}).click();
                    release.resolve(); await bounded(finished.promise);
                    await page.waitForTimeout(150);
                    assert.equal(await page.locator('[data-catalog-proof="old"]').count(), 0,
                        'A delayed category must not replace All Items');
                } else {
                    await page.evaluate(() => { window._gridSearch('failure'); });
                    await bounded(finished.promise); await page.waitForTimeout(150);
                    const state = await page.locator('.pos-product-grid').evaluate(grid => ({
                        opacity: getComputedStyle(grid).opacity, disabled: getComputedStyle(grid).pointerEvents === 'none',
                        badResponse: !!grid.querySelector('[data-catalog-proof]')
                    }));
                    assert.equal(state.disabled, false, 'Failed catalog navigation must restore product controls');
                    assert.equal(state.opacity, '1', 'Failed catalog navigation must restore visible products');
                    assert.equal(state.badResponse, false, 'An HTTP error must not replace the current catalog');
                }
                assert.equal(await page.locator('.pos-cart tbody').innerText(), before, 'Navigation preserves the cart');
                results.push({name, passed: true});
            } catch (error) { results.push({name, passed: false, error: error.message}); }
            finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (out) { fs.mkdirSync(out, {recursive: true}); fs.writeFileSync(path.join(out, 'catalog-navigation.json'), JSON.stringify(results, null, 2)); }
    console.log(JSON.stringify(results, null, 2));
    if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
