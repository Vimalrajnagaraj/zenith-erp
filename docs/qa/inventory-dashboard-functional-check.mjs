// Read-only regression checks against the local AUDIT_INV_* fixture described in the report.
// Run: node docs/qa/inventory-dashboard-functional-check.mjs
import assert from 'node:assert/strict';
const base = process.env.INVENTORY_AUDIT_URL || 'http://localhost:8080';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use the local audit environment');
const auth = 'Basic ' + Buffer.from(`${process.env.SMOKE_USER || 'john.doe'}:${process.env.SMOKE_PASS || 'moqui'}`).toString('base64');
const route = '/apps/zenith/Inventory/InventoryDashboard';
async function page(query = '') {
  const response = await fetch(base + route + query, { headers: { Authorization: auth }, redirect: 'manual' });
  assert.equal(response.status, 200, query);
  const html = await response.text();
  assert(!/Error rendering|ScreenRenderException|Timestamp format must be/.test(html), query);
  return html;
}
function card(html, id) {
  const match = html.match(new RegExp(`<article[^>]*id="${id}"[\\s\\S]*?</article>`));
  assert(match, `Missing card ${id}`);
  return match[0];
}
const scoped = '?dashFacilityId=AUDIT_INV_A';
const all = await page(scoped);
assert(all.includes('AUDIT_INV_A'), 'Load the AUDIT_INV_* fixture first');
assert(all.includes('All time · 80 in · 0 out'), 'All-time includes January and February 2025 movements');
assert.match(all, /href="[^"]*FindProduct"[\s\S]{0,500}Add New/);
assert.match(all, /StockLevels\?facilityId=AUDIT_INV_A/);
assert.equal((card(all, 'invRecent').match(/<tr>/g) || []).length, 9, 'Eight nonzero movements survive sixty newer zero changes');
assert(!card(all, 'invLowStock').includes('Audit Untracked Item'));
assert(card(all, 'invLowStock').includes('Audit Tracked Item'));
const october = await page(scoped + '&dashDate=2026-10-01&dashDateTo=2026-10-06');
assert(october.includes('2026-10-01 to 2026-10-06 · 5 in · 0 out'));
const reversed = await page(scoped + '&dashDate=2026-10-06&dashDateTo=2026-10-01');
assert(reversed.includes('2026-10-01 to 2026-10-06 · 5 in · 0 out'));
assert((await page('?dashDate=invalid')).includes('Enter valid dates in YYYY-MM-DD format.'));
assert.match(await page('?showSettings=1'), /<details class="inv-additional"\s+open/);
const page1 = card(await page(scoped + '&showList=recent&movementPage=0'), 'invRecent');
const page2 = card(await page(scoped + '&showList=recent&movementPage=1'), 'invRecent');
assert.equal((page1.match(/<tr>/g) || []).length, 51);
assert.equal((page2.match(/<tr>/g) || []).length, 8);
assert(page1.includes('Next') && page2.includes('Previous') && !page2.includes('>Next</a>'));
const products = card(await page('?showList=products'), 'invProducts');
assert(products.includes('Audit Tracked Item') && products.includes('Audit Untracked Item'));
assert(products.includes('EditProduct?productId=AUDIT_INV_TRACKED'));
console.log('PASS: dashboard date validation, all-time totals, warehouse drilldown, tracked-only alerts, zero-change exclusion, pagination, settings disclosure, and product drilldown.');
