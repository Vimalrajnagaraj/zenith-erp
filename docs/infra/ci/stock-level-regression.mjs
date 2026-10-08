// Read-only checks against a local Moqui. For deterministic edge cases first import
// seed/stock-level-local.sql, run STOCK_LEVEL_FIXTURE=1, then import its cleanup SQL.
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

const base = process.env.STOCK_LEVEL_URL || 'http://localhost:8080';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local verification only');
const route = '/apps/zenith/Inventory/StockLevels';
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const auth = username => 'Basic ' + Buffer.from(`${username}:${process.env.SMOKE_PASS || 'moqui'}`).toString('base64');
async function request(path, username = process.env.SMOKE_USER || 'john.doe') {
  return fetch(base + path, { headers: { Authorization: auth(username) }, redirect: 'manual' });
}
async function page(query = '', suffix = '', username) {
  const response = await request(route + suffix + query, username);
  assert.equal(response.status, 200, query);
  const html = await response.text();
  assert(!/Template Error|Error rendering|Exception running|ScreenRenderException/.test(html), query);
  return html;
}
function summary(html) {
  const values = [...html.matchAll(/class="[^"\n]*xf-summary-num">([^<]+)/g)].map(m => Number(m[1].replace(/[\u20b9,]/g, '')));
  assert.equal(values.length, 5, 'Five summary values render');
  return values;
}
function rows(html) { return html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || ''; }
function csvRows(csv) {
  return csv.trim().split(/\r?\n/).map(line => {
    const cells = []; let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (line[i] === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += line[i];
    }
    cells.push(cell); return cells;
  });
}
// Inspect actual XLSX worksheet/shared strings, rather than accepting a ZIP signature alone.
function workbookXml(buffer) {
  const xml = [];
  for (let offset = 0; offset + 46 <= buffer.length; offset++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32), local = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (/^xl\/(worksheets\/.*|sharedStrings)\.xml$/.test(name)) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      xml.push((method === 8 ? inflateRawSync(data) : data).toString());
    }
    offset += 45 + nameLength + extraLength + commentLength;
  }
  assert(xml.length > 0, 'XLSX contains worksheet XML');
  return xml.join('\n');
}

const anonymous = await fetch(base + route, { redirect: 'manual' });
assert([302, 303].includes(anonymous.status), 'Authentication required');
const all = await page('?facilityId=&pageSize=20');
const totals = summary(all);
assert.deepEqual(summary(await page('?facilityId=&pageSize=1&pageIndex=1')), totals, 'Summary independent of paging');
assert.deepEqual(summary(await page('?facilityId=&hsnCode=NO_SUCH_HSN')), totals, 'Summary independent of product search');
assert(!rows(await page('?facilityId=&hsnCode=NO_SUCH_HSN')).includes('StockLevelForm_pseudoId_'), 'HSN filter is applied');
for (const suffix of ['.qvt', '.vuet']) {
  const html = await page('?facilityId=&productName=Sample&pageSize=20', suffix);
  assert.match(html, /id="sl-hdr-export" href="[^"\n]+renderMode=csv/);
  assert(!html.includes(suffix + '?renderMode'), 'Export uses a screen URL, not a fragment URL');
  assert.match(html, /name="productName" value="Sample"/, 'Warehouse form preserves product filter');
}
const headerUrl = decode(all.match(/id="sl-hdr-export" href="([^"]+)"/)[1]);
const multiSort = await page('?facilityId=__ALL_WAREHOUSES__&orderByField=productName&orderByField=-totalQoh');
const multiSortUrl = new URL(decode(multiSort.match(/id="sl-hdr-export" href="([^"]+)"/)[1]), base);
assert.equal(multiSortUrl.searchParams.get('orderByField'), 'productName,-totalQoh', 'Multiple sort fields survive export/warehouse controls');
const csv = await (await request(headerUrl)).text();
assert(csv.startsWith('SKU,Product,HSN,'), 'CSV begins with column headers, without page labels/template errors');
assert(!/Template Error|<svg|Recent/.test(csv));

if (process.env.STOCK_LEVEL_FIXTURE === '1') {
  const a = await page('?facilityId=SLFIX_A&pageSize=20');
  assert.deepEqual(summary(a), [1, 8, 30, 2, 1], 'Warehouse A: unique stocked/out/recent products, inventory only, scoped valuation');
  const b = await page('?facilityId=SLFIX_B&pageSize=20');
  assert.deepEqual(summary(b), [1, 5, 20, 0, 1], 'Warehouse B acquire-cost valuation');
  assert.equal((rows(a).match(/Stock test multi-batch/g) || []).length, 2, 'Distinct lots retained');
  assert(rows(a).includes('text-danger'), 'Zero and negative balances retain semantic availability');
  assert(!all.includes('Stock foreign warehouse'), 'Foreign warehouse omitted from selector');
  assert(!rows(all).includes('Stock foreign product'), 'Foreign product stock omitted');
  assert(rows(all).includes('Stock test no warehouse'), 'Facility-less stock retained');
  const noWarehouse = await page('?facilityId=&pseudoId=SLFIX-003&pageSize=20');
  assert(rows(noWarehouse).includes('63.00'), 'MRP fallback valuation');
  assert(!rows(noWarehouse).includes('zenith-badge success'), 'Future timestamps are not recent');
  assert.deepEqual(summary(await page('?pageSize=20', '', 'stock.level.audit')), [1, 8, 30, 2, 1], 'Global shop is the default');
  assert.deepEqual(summary(await page('?facilityId=&pageSize=20', '', 'stock.level.audit')), totals, 'Explicit All Warehouses overrides global shop');
  const allShops = await page('?facilityId=__ALL_WAREHOUSES__&pseudoId=SLFIX&pageSize=1', '', 'stock.level.audit');
  assert.deepEqual(summary(allShops), totals, 'All selection survives search and paging');
  assert.match(allShops, /facilityId=__ALL_WAREHOUSES__/, 'Generated navigation retains All scope');
  assert.deepEqual(summary(await page('?facilityId=SLFIX_B&pageSize=20', '', 'stock.level.audit')), [1, 5, 20, 0, 1], 'Explicit warehouse overrides global shop');
  const search = await page('?facilityId=SLFIX_A&hsnCode=111111&pageSize=20');
  assert(!rows(search).includes('Stock test zero') && !rows(search).includes('Stock test negative'));
  assert.deepEqual(summary(search), summary(a), 'HSN search does not alter warehouse summary');
  const scoped = decode(search.match(/id="sl-hdr-export" href="([^"]+)"/)[1]);
  const table = csvRows(await (await request(scoped)).text());
  assert.deepEqual(table[0], ['SKU','Product','HSN','Store / Warehouse','In Stock','Free to Sell','MRP','Stock Value','Updated','']);
  assert.equal(table.length, 3, 'Filtered export includes both lots');
  assert.deepEqual(table.slice(1).map(row => Number(row[7])).sort((x,y)=>x-y), [0,30]);
  const paged = await page('?facilityId=SLFIX_A&hsnCode=111111&pageSize=1');
  const pagedExport = decode(paged.match(/id="sl-hdr-export" href="([^"]+)"/)[1]);
  assert.equal(csvRows(await (await request(pagedExport)).text()).length, 3, 'Export includes all filtered pages');
  const workbookUrl = decode(search.match(/href="([^"\n]*\/exportXlsx\?[^"\n]+)"/)[1]);
  const workbook = await request(workbookUrl + '&pageSize=1&pageIndex=1');
  assert.equal(workbook.status, 200);
  const xml = workbookXml(Buffer.from(await workbook.arrayBuffer()));
  assert(xml.includes('Stock test multi-batch') && !xml.includes('Stock test zero') && !xml.includes('Stock foreign product'));
  assert.equal((xml.match(/<row /g) || []).length, 3, 'Workbook includes all filtered pages');
  assert(!/Template Error|<svg/.test(xml));
  const edit = rows(a).match(/class='sup-act-edit' href='([^']+)'/)[1];
  assert(edit.includes('SLFIX_P%261'), 'Product IDs are URL encoded');
  const editResponse = await request(edit);
  assert([302,303].includes(editResponse.status));
  const location = new URL(editResponse.headers.get('location'), base);
  assert.equal(location.searchParams.get('productId'), 'SLFIX_P&1');
  assert(location.pathname.endsWith('/Inventory/EditProduct'));
}
console.log('PASS: authentication, stock search, paging, fragment URLs, clean CSV' +
  (process.env.STOCK_LEVEL_FIXTURE === '1' ? ', warehouse/global shop scope, valuation, unique counts, tenant isolation, batches, negative/zero/facility-less stock, XLSX and encoded product actions.' : '.'));
