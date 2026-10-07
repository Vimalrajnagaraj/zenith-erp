// Read-only checks against the LOCAL_ERP_ORG synthetic inventory fixture.
// Seed docs/infra/ci/seed/inventory-dashboard-local.sql in the local demo DB,
// restart Moqui to refresh caches, then run this script. Never use production.
// Browser interactions (both /apps and /qapps) are verified separately.
import assert from 'node:assert/strict';

const base = process.env.INVENTORY_AUDIT_URL || 'http://localhost:8080';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local audit environment required');
const auth = 'Basic ' + Buffer.from(`${process.env.SMOKE_USER || 'john.doe'}:${process.env.SMOKE_PASS || 'moqui'}`).toString('base64');
const root = base + '/apps/zenith/Inventory/';
async function page(path) {
  const response = await fetch(root + path, { headers: { Authorization: auth }, redirect: 'manual' });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert(!/Error rendering|ScreenRenderException|freemarker\.core|Exception running/.test(html), path);
  return html;
}
const facility = 'dashFacilityId=AUDIT_INV_A';
const dashboard = await page('InventoryDashboard?' + facility);
const defaultRoute = await page('?' + facility);
assert.match(defaultRoute, /href="[^"]*\/Inventory\/FindProduct"[\s\S]{0,500}Add New/, 'Default Inventory route keeps valid sibling links');
assert.match(dashboard, /StockLevels\?facilityId=AUDIT_INV_A/);
assert.match(dashboard, /href="[^"]*FindProduct"[\s\S]{0,500}Add New/);
assert(!dashboard.includes('No stock movements recorded yet.'), 'Real movements survive 60 newer zero-quantity records');
assert(dashboard.includes('last 6 months · 5 in · 0 out'));
assert((await page('InventoryDashboard?' + facility + '&dateMode=all')).includes('All time · 80 in · 0 out'), 'Older history included');
for (const dates of [
  'dashDate=2026-10-01&dashDateTo=2026-10-06',
  'dashDate=2026-10-06&dashDateTo=2026-10-01',
]) assert((await page('InventoryDashboard?' + facility + '&' + dates)).includes('2026-10-01 to 2026-10-06 · 5 in · 0 out'));
await page('InventoryDashboard?dashDate=invalid');
const monthEnd = await page('InventoryDashboard?' + facility + '&dashDate=2025-01-31&dashDateTo=2025-05-31');
assert(monthEnd.includes('55 in · 0 out') && monthEnd.includes('Feb 25'), 'Month-end range includes February');

const movementPath = 'DashboardDetails?' + facility + '&listType=movements';
const first = await page(movementPath);
assert(first.includes('57 records') && first.includes('Page 1 of 2'));
const second = await page(movementPath + '&pageIndex=1');
assert(second.includes('Page 2 of 2') && second.includes('01 Jan 2025'), 'Older records accessible on next page');
assert((await page(movementPath + '&pageIndex=999999999')).includes('Page 2 of 2'));
assert((await page(movementPath + '&pageIndex=-1')).includes('Page 1 of 2'));

const lowStock = await page('DashboardDetails?' + facility + '&listType=lowstock');
assert(lowStock.includes('Audit Tracked Item') && !lowStock.includes('Audit Untracked Item'));
for (const path of [
  'DashboardDetails?dashFacilityId=AUDIT_INV_B&listType=lowstock',
  'DashboardDetails?dashFacilityId=AUDIT_INV_B&listType=movements',
  'DashboardDetails?listType=lowstock',
]) assert((await page(path)).includes('No matching records.'), path);
const products = await page('DashboardDetails?' + facility + '&listType=products');
assert(products.includes('Organization catalog · 2 records') && products.includes('Audit Untracked Item'));

const dateContext = '&dashDate=2026-10-01&dashDateTo=2026-10-06';
assert((await page('InventoryDashboard?' + facility + dateContext + '&showSettings=1')).includes('showSettings=0'), 'Close exits settings');
const details = await page(movementPath + dateContext);
assert(details.includes('InventoryDashboard?dashFacilityId=AUDIT_INV_A&amp;dashDate=2026-10-01&amp;dashDateTo=2026-10-06'), 'Return link keeps filter context');
console.log('PASS: inventory ranges, recent movements, full-list pagination, warehouse scope, tracked alerts, completeness, date validation, and settings context.');
