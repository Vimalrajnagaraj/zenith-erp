# Stock Transfers: functional fixes and reference UI

Scope: Inventory → Stock Transfers, New Stock Transfer and Edit Stock Transfer.
Branch: `codex/stock-transfers-fixes-ui`, based on current `origin/master`.
Functional fixes precede the UI commit. Stock Levels UI PR #41 merged while this work was underway; the branch is refreshed against that merge without changing the Stock Levels implementation.

## Functional corrections

- Creation validates two different, existing warehouses owned by the active organization; posted owner, status, invoice and totals cannot override server decisions. Creating a transfer now redirects to its generated ID and displays a generated transfer number.
- Every write checks Inventory write permission, active organization, membership for non-platform administrators and transfer ownership at service level. List, totals and warehouse choices return no organization data when none is selected; administrators also remain scoped to the selected organization.
- Adding/removing lines and editing the header require Draft status and lock the parent. Shipped/received line quantities and locations cannot be changed by forging an action request.
- Positive quantities, owned products, batch availability, whole serial quantities and unique serial picks are validated. An explicit zero unit amount stays zero. Fractional quantities are displayed without rounding to integers.
- Logistics updates accept only transporter GSTIN, LR number and vehicle number. The button says **Save logistics**; saving this form does not claim to generate an E-Way Bill.
- Shipping rejects empty transfers, checks combined quantities across duplicate lines, excludes supplies and foreign-owned assets, preserves reserved stock, and locks source stock so competing transfers cannot consume the same units. The batch selection path no longer shadows the `org.moqui` package with a local string.
- Asset movements use the ledger EECA once. An unreconciled opening balance is recorded for the exact locked asset before movement, preserving existing balances and keeping the ledger consistent.
- Batch identity, manufacturing/expiry dates and batch valuation follow the goods. Same batch names with different dates stay separate at the destination.
- Serial identities are fixed at shipping and marked In Transit. Partial receiving requires the exact arrived units; only those relocate, and missing units are marked Lost in Transfer with history records.
- Actual receipt quantities must be from zero through the shipped quantity. Zero records complete transit loss. Parent locks prevent duplicate Ship/Receive and receipt-edit races.
- Editing a draft recomputes E-Way eligibility using the facility GSTIN/state logic already used at creation. The old, inconsistent header-edit placeholder invoice creation was removed. Existing invoices are not rebuilt by replaying the invoice action; deleting a draft cannot cancel an issued or foreign invoice.
- Quick search includes product name/SKU, warehouse names, transfer number and legacy displayed IDs. Search retains existing filters, resets paging and uses a stable secondary ordering. CSV exports retain the same tenant/search scope.
- Date/number/value sorting honors the selected primary field before the ID tie-breaker. Saving logistics returns to the original search/filter context rather than accidentally filtering the list using that row's values.
- Find Options retains the product quick search. Repeated sort parameters from the native multi-select are normalized correctly. CSV has a dedicated eight-column export layout, excluding page headings, dialogs and action menus.

## Reference UI and local review

The supplied Stock Transfers image, components and design-system documents inform the page layout: five tinted KPI cards, search/filter bar, transfer-number pills, compact table, semantic status badges, pagination and overflow actions. Counts, dates, warehouse names, values, tenant/user identity and available actions come from actual application data. Draft is presented as Pending and Received as StxReceived; the underlying status IDs are unchanged. Ship, Receive, View transfer and Logistics remain available where permitted. Native filters, exports and page sizing are accessible through Filters/Table options. Styling and navigation-label adjustments are scoped to this page and restored when leaving it.

Optional `preview-local.sql` creates seven synthetic transfers in **Local ERP Demo**, one dedicated product and two dedicated assets. Five are completed, one is in transit and one is pending; their source/destination ledger balances agree with the preview assets. Existing products and stock are untouched. The preview uses Demo Main Store and Demo Second Store, requires both to belong to the local demo organization, refuses existing record-ID collisions, and never runs automatically. It intentionally uses `ST-DEMO-398`, separate from the Stock Levels `MTC` review search. `preview-cleanup-local.sql` removes these known preview records; restart local Moqui after seed/cleanup to refresh entity caches. Additional user-created transactions using the preview product can cause cleanup to abort safely on foreign keys.

Review route: `/qapps/zenith/Inventory/StockTransfers?pageSize=20` with Local ERP Demo selected. The sample totals are seven / one / five / one, with one Today on the seed date. Sample amounts and names are illustrative; production figures are never hardcoded. Ship, Receive and Delete draft use an in-page confirmation; cancelling sends no stock movement request. Menus stay visible even when the result contains a single row.

The shared local ERP server was being rewritten/restarted by another task during validation. The stable review instance therefore uses `http://127.0.0.1:8081`, container `zenith-erp-stock-transfers-review`, and a separate cloned local database `moqui_stock_transfers_review`. Its repository components come from this branch's isolated checkout; no main checkout changes were copied. Using 127.0.0.1 also keeps browser cookies separate from the normal localhost session. Preview-only URL configuration points all generated redirects back to this instance. This configuration is not part of the PR or production deployment.

## Verification

Integration script: `docs/infra/ci/stock-transfer-regression.mjs`.
Seed: `docs/infra/ci/seed/stock-transfer-local.sql`.
Only localhost/127.0.0.1 hosts are accepted. Import the seed into the local Moqui database and restart local Moqui to invalidate cached users and memberships before running the script. Set `SMOKE_PASS` through your local environment. `STOCK_TRANSFER_URL` and `STOCK_TRANSFER_DATABASE` select an isolated local instance/database; defaults remain localhost:8080 and moqui. The script captures generated transfer, asset, ledger, serial-history and invoice IDs and removes its disposable fixtures in `finally`; `STOCK_TRANSFER_MANIFEST` may specify an ignored local audit-output path.

The fixture uses its own organization, party membership, users, facilities and products. Deliberately non-legal GSTIN markers exercise the existing inter-state branch with an exempt product; no external provider is called. No real tenant or issued customer invoice is used for write testing.

Verified locally on 8 October 2026: **34 integration checks passed** against the isolated instance, including native `/qapps` Ship/Receive followed by `/apps` replay checks. Disposable fixture records were removed. The retained preview has five received, one in transit and one draft transfer; source quantity/ledger both equal 140 and destination quantity/ledger both equal 50.

Browser checks covered both `/apps` and `/qapps`, New Transfer entry/cancel, product search, status filters, logistics save/return context, pagination retaining product/status filters, single-row action menus and cancellation of Ship without movement. The actual filtered CSV download parsed as one header plus five completed transfers, with eight columns on every row and no page headings/action markup. At 1535×1023 the desktop table shows all seven preview rows; at 390×844 the table scrolls inside its region without horizontal document overflow. Existing application branding and account controls are retained.

XML parsing, JavaScript syntax checks and all four repository guards below passed. The branch is based on `origin/master` at `ba5143a3`; GitHub CI and mergeability must be checked after the user approves pushing the eventual PR.

Run the repository guards:

```
node docs/infra/lint-css-comments.js
node docs/infra/lint-cross-module-transitions.js
node docs/infra/lint-form-dom-collisions.js
bash docs/infra/lint-party-picker.sh
```

## Review and deployment

Local preview data is an explicit user-requested exception to routine test-fixture removal. It is optional, separately documented, never loaded automatically and must never be imported into a real tenant. Disposable regression fixtures are removed.

The SOP deployment gate applies: stock movements, organization guards and the inter-state invoice path require maintainer review before production deployment. Deploy the two new serial statuses (`SnInTransit`, `SnTransferLost`) from entity seed data and the `StockTransferItemSerial.received` field through the normal schema/seed update. Existing in-transit serial transfers without recorded serial picks require reconciliation of their actual unit identities; the receive service fails closed instead of guessing.

External E-Way provider success and production deployment are outside this local verification. Re-fetch `master`, check conflicts, run exact-head staging acceptance and PR checks before marking the eventual PR ready. Mergeability is a point-in-time result and can change when another PR merges.
