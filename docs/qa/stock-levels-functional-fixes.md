# Stock Levels functional fixes

Screen: `component/zenith-erp-inventory/screen/zenith/inventory/Inventory/StockLevels.xml`

## Corrected behavior

- Warehouse selection scopes units, product counts, row values, and total value together.
- An explicit All Warehouses selection overrides the global shop and persists through search, sort, pagination, and exports. Warehouse changes preserve product filters and restart paging.
- HSN is available in the stock view; its displayed values and search filter now work.
- Products in stock counts unique products with positive net on-hand quantity within the warehouse scope. Out of stock counts unique products with nonpositive net on-hand quantity. Empty lots no longer count a stocked product as out of stock.
- Recently updated counts unique products, excluding future timestamps. Row badges use the same time rule.
- Stock rows and totals exclude non-inventory assets and foreign-owned assets/products. An absent active organization yields no inventory rows rather than an unscoped query.
- CSV starts with column headers rather than page labels or template errors; exports include all matching rows, regardless of the current page.
- XLSX downloads through a read-only screen transition, because the deployed framework does not provide an XLSX widget renderer. It reuses this screen's CSV query and valuation, and writes numeric quantities/prices/values as workbook numbers; identifiers remain text.
- Product IDs in pencil links are URL encoded; products without a SKU retain a usable identifier link. Pencil actions honor the existing Inventory write flag.

The existing page styling is retained. An XLSX download control is added to expose the corrected export. No stock transactions or valuation-policy changes are introduced: positive valuation rate, then positive acquisition cost, then product MRP remains the existing fallback. Counts cover inventory asset-backed products, not every unstocked catalogue item.

## Verification

`node docs/infra/ci/stock-level-regression.mjs` performs read-only localhost checks.

For deterministic edge cases, import `docs/infra/ci/seed/stock-level-local.sql` into a disposable local Moqui demo database, run with `STOCK_LEVEL_FIXTURE=1`, and apply `stock-level-local-cleanup.sql` afterward. Fixtures fail atomically on ID collisions and cleanup uses exact fixture IDs. The dedicated fixture user avoids changing the reviewer account's active shop.

Coverage: authentication; SKU/HSN search; warehouse and global-shop overrides; All scope persistence; pagination-independent summaries; CSV/XLSX pagination and tenant isolation; valuation-rate/acquisition-cost/MRP fallback; batches; zero/negative balances; facility-less stock; future timestamps; and encoded product-action destinations. XLSX was also loaded independently with openpyxl to check rows and numeric values. The four repository guards and XML parsing pass.

These checks verify the Stock Levels read/report workflow. Stock receipt, transfer, sale, and adjustment write workflows are separate submodules.
