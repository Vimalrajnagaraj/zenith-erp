// CI MARUTHI-shaped billing no-op driver (Phase-1 deeper acceptance).
//
// Rings up four POS sales on the seeded CITEST_ORG_A tenant (docs/infra/ci/seed/billing.xml) by
// replaying the exact screen-transition POSTs the /apps terminal makes — there is no REST endpoint
// for the mint. It drives:
//   A  RETAIL   cash   — CITEST_BW18 (mrp 100, GST 18%)         -> grand 118.00
//   B  WHOLESALE cash  — CITEST_BW12 x3 (mode price 180, GST12) -> grand 604.80, payable 605
//   C  EMPLOYEE cash   — CITEST_BW5  (mode price 80, GST 5%)    -> grand 84.00
//   D  RETAIL   split  — CITEST_BW18 (cash 60 + card 58 = 118)
// then writes <scenario>=<transactionId> to $BILLING_OUT so the workflow asserts the stored
// pricing/tax/tenders against a golden baseline via psql (DB ground truth, not this script's word).
//
// Usage:  BILLING_OUT=path node docs/infra/ci/billing.mjs [baseUrl]
// Notes: unitPrice is deliberately NOT sent on addItem so the server resolves the mode price
// (sending 0 would be a manual 0 -> free line). Cash scenarios over-tender (10000) so the mint always
// completes regardless of the math; the DB assert is what checks the totals. Split pays the exact
// golden total so its tender-reconcile guard is meaningful.

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const OUT  = process.env.BILLING_OUT || process.argv[3] || 'billing_txns.env';
const USER = process.env.SMOKE_USER || 'john.doe';
const PASS = process.env.SMOKE_PASS || 'moqui';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const SESS = 'CITEST_A_SESS';            // the data-loaded open session

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
});

function fail(msg) { console.error('BILLING DRIVER FAIL: ' + msg); }

try {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ Authorization: AUTH });
  await page.setViewport({ width: 1400, height: 1000 });

  // Load the terminal once: establishes the authenticated session cookie + the CSRF token.
  await page.goto(BASE + '/apps/zenith/pos/Terminal', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(
    () => !!((window.moqui && window.moqui.webrootVue && window.moqui.webrootVue.moquiSessionToken) ||
             document.querySelector('input[name=moquiSessionToken]')),
    { timeout: 30000 }
  ).catch(() => {});
  const token = await page.evaluate(() =>
    (window.moqui && window.moqui.webrootVue && window.moqui.webrootVue.moquiSessionToken) ||
    (document.querySelector('input[name=moquiSessionToken]') || {}).value || '');
  if (!token) { fail('no moquiSessionToken on the Terminal page (login/session failed?)'); await browser.close(); process.exit(1); }
  console.log('moquiSessionToken acquired (len ' + token.length + ')');

  // POST a transition from the page context: same-origin cookies + Basic-auth header are sent.
  async function post(path, fields) {
    return await page.evaluate(async (base, path, fields) => {
      const body = new URLSearchParams(fields).toString();
      const r = await fetch(base + path, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      });
      const text = await r.text();
      let json = null; try { json = JSON.parse(text); } catch (e) {}
      return { status: r.status, text: text.slice(0, 500), json };
    }, BASE, path, fields);
  }

  async function addItem(productId, qty, salesModeId) {
    const r = await post('/apps/zenith/pos/Terminal/ajaxCart',
      { action: 'addItem', sessionId: SESS, productId, addQty: String(qty), salesModeId, taxOn: 'Y', moquiSessionToken: token });
    console.log(`  addItem ${productId} x${qty} ${salesModeId} -> [${r.status}] ${r.text}`);
    const j = r.json || {};
    if (j.success === false) throw new Error(`addItem blocked: ${j.error || j.errorMessage || r.text}`);
    const txn = j.transactionId || j.transactionId || (j.cart && j.cart.transactionId);
    if (!txn) throw new Error(`addItem returned no transactionId: ${r.text}`);
    return txn;
  }

  async function mintCash(txn, salesModeId, amount) {
    const r = await post('/apps/zenith/pos/Terminal/payAndComplete',
      { transactionId: txn, sessionId: SESS, paymentMethod: 'Cash', amount: String(amount), salesModeId, customerPhone: '', moquiSessionToken: token, wantJson: '1' });
    console.log(`  mintCash ${txn} ${salesModeId} amount ${amount} -> [${r.status}] ${r.text}`);
    if (!r.json || r.json.success !== true) throw new Error(`mintCash failed: ${(r.json && (r.json.error || r.json.errorMessage)) || r.text}`);
  }

  async function mintSplit(txn, salesModeId, cash, card) {
    const r = await post('/apps/zenith/pos/Terminal/splitPayAndComplete',
      { transactionId: txn, sessionId: SESS, taxOn: 'Y', salesModeId, customerPhone: '',
        cashAmount: String(cash), cardAmount: String(card), upiAmount: '0', cardRef: 'CITESTCARD', upiRef: '', moquiSessionToken: token, wantJson: '1' });
    console.log(`  mintSplit ${txn} cash ${cash} + card ${card} -> [${r.status}] ${r.text}`);
    if (!r.json || r.json.success !== true) throw new Error(`mintSplit failed: ${(r.json && (r.json.error || r.json.errorMessage)) || r.text}`);
  }

  const out = {};
  console.log('A: RETAIL cash, CITEST_BW18');
  let t = await addItem('CITEST_BW18', 1, 'RETAIL');   await mintCash(t, 'RETAIL', 10000);      out.A = t;
  console.log('B: WHOLESALE cash, CITEST_BW12 x3');
  t = await addItem('CITEST_BW12', 3, 'WHOLESALE');    await mintCash(t, 'WHOLESALE', 10000);   out.B = t;
  console.log('C: EMPLOYEE cash, CITEST_BW5');
  t = await addItem('CITEST_BW5', 1, 'EMPLOYEE');      await mintCash(t, 'EMPLOYEE', 10000);    out.C = t;
  console.log('D: RETAIL split, CITEST_BW18 (cash 60 + card 58)');
  t = await addItem('CITEST_BW18', 1, 'RETAIL');       await mintSplit(t, 'RETAIL', 60, 58);    out.D = t;

  writeFileSync(OUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  console.log('WROTE ' + OUT + ': ' + JSON.stringify(out));
  console.log('MINTS OK');
  await browser.close();
  process.exit(0);
} catch (e) {
  fail(e.message);
  await browser.close();
  process.exit(1);
}
