const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

// Exercise the real offline module with a disposable loopback page and browser DB.
const js = fs.readFileSync(process.env.POS_QA_SOURCE || path.resolve(__dirname, '../../../component/zenith-erp-app/screen/zenithstatic/js/pos-terminal.js'), 'utf8');
const begin = js.indexOf('window._posOffline = (function() {');
const end = js.indexOf('\n})();', begin);
assert(begin >= 0 && end > begin, 'offline module exists');
const offlineModule = js.slice(begin, end + 6);
let synced = 0;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/offline-module.js') {
    response.setHeader('content-type', 'application/javascript');
    response.end(offlineModule);
  } else if (url.pathname.endsWith('/exportPosCatalog')) {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({products:[{productId:'P1',productName:'Item',listPrice:100,taxRate:18}]}));
  } else if (url.pathname.endsWith('/syncOfflineTransactions')) {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const sales = JSON.parse(Buffer.concat(chunks).toString()).transactions.map(JSON.parse);
      synced += sales.length;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({syncedIds:sales.map(sale => sale.offlineId)}));
    });
  } else {
    const hasDraft = url.searchParams.get('draft') === '1';
    response.setHeader('content-type', 'text/html');
    response.end(`<!doctype html><title>POS offline regression</title>
      <form id="cartInlineAddForm"><input name="posOrganizationPartyId" value="QA_ORG"><input name="sessionId" value="QA_SESSION"><input name="transactionId" value="${hasDraft ? 'TX-1' : ''}"><input name="moquiSessionToken" value="test"></form>
      <input name="posTerminalId" value="QA_TERMINAL"><div class="pos-product-grid"><button id="add-product">Add</button></div>
      <div class="pos-cart"><table><tbody>${hasDraft ? '<tr><td>Item</td><td><input class="aj-qi" value="1"></td></tr>' : '<tr><td>Tap products to add items</td></tr>'}</tbody></table></div>
      <div class="pos-summary"><strong id="total">${hasDraft ? '118.00' : '0.00'}</strong><form id="payment"><button id="pay">Pay</button></form></div>
      <script src="/offline-module.js"></script>`);
  }
});

(async () => {
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({executablePath:process.env.POS_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  try {
    const draft = await browser.newContext();
    const page = await draft.newPage();
    let submitted = 0;
    await page.goto(base + '/apps/zenith/pos/Terminal?draft=1');
    await page.evaluate(() => {
      document.querySelector('#payment').addEventListener('submit', event => event.preventDefault());
      window.testSubmits = 0;
      document.querySelector('#payment').addEventListener('submit', () => window.testSubmits++);
      document.querySelector('#add-product').addEventListener('click', () => window.testSubmits++);
    });
    await draft.setOffline(true);
    await page.waitForFunction(() => { const banner = document.querySelector('#pos-offline-banner'); return banner && banner.style.display !== 'none'; });
    assert.equal(await page.locator('.pos-cart .aj-qi').count(), 1, 'server cart line stays visible');
    assert.equal(await page.locator('#total').innerText(), '118.00', 'server total stays visible');
    await page.locator('.aj-qi').press('ControlOrMeta+A');
    await page.locator('.aj-qi').press('2');
    assert.equal(await page.locator('.aj-qi').inputValue(), '1', 'server cart quantity is read-only offline');
    assert.match(await page.locator('#pos-offline-banner').innerText(), /current bill is paused/);
    assert.doesNotMatch(await page.locator('#pos-offline-banner').innerText(), /sales saved/);
    await page.locator('#pay').click();
    await page.locator('#add-product').click();
    submitted = await page.evaluate(() => window.testSubmits);
    assert.equal(submitted, 0, 'payment and product controls stay blocked');
    await page.evaluate(() => window._posOffline.add('P1',100));
    assert.equal(await page.locator('.pos-cart .aj-qi').count(), 1, 'direct offline add cannot replace server cart');
    assert.equal((await page.evaluate(() => window._posOffline.getQueue())).length, 0, 'no duplicate offline bill');
    await draft.setOffline(false);
    await page.waitForFunction(() => !window._posOffline.paused(), null, {timeout:10000});
    assert.equal(await page.locator('.pos-cart .aj-qi').count(), 1, 'server bill is shown after reconnect');
    await draft.close();

    const fresh = await browser.newContext();
    const offlinePage = await fresh.newPage();
    await offlinePage.goto(base + '/apps/zenith/pos/Terminal');
    await offlinePage.waitForFunction(() => window._posOffline?.lookup('P1')?.taxRate === 18);
    await fresh.setOffline(true);
    await offlinePage.waitForSelector('#pos-offline-banner');
    await offlinePage.waitForFunction(() => document.querySelector('.pos-cart tbody')?.textContent.includes('Offline'));
    assert.equal(await offlinePage.evaluate(() => window._posOffline.paused()), false, 'fresh offline cart remains usable');
    await offlinePage.evaluate(() => window._posOffline.add('P1',100));
    await offlinePage.evaluate(() => { const button = document.querySelector('.ofl-pay[data-m="Cash"]'); button.click(); button.click(); });
    await offlinePage.waitForFunction(() => !document.querySelector('.ofl-qi'), null, {timeout:5000});
    assert.equal((await offlinePage.evaluate(() => window._posOffline.getQueue())).length, 1, 'offline sale is durably queued');
    assert.equal(await offlinePage.locator('.ofl-qi').count(), 0, 'queued sale clears local draft');
    await fresh.setOffline(false);
    for (let attempt = 0; attempt < 50 && synced !== 1; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(synced, 1, 'queued sale syncs once');
    assert.equal((await offlinePage.evaluate(() => window._posOffline.getQueue())).length, 0, 'acknowledged sale leaves queue');
    await fresh.close();
    process.stdout.write('PASS: server cart preserved and payment blocked offline; reconnect restores it; fresh offline sale queues and syncs once.\n');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
