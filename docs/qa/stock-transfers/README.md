# Stock Transfers: functional fixes and reference UI

Scope: Inventory → Stock Transfers, New Stock Transfer and Edit Stock Transfer.
Branch: `codex/stock-transfers-fixes-ui`, based on current `origin/master`.
Functional fixes precede the UI commit; this work has no dependency on unmerged Stock Levels UI PR #41.

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

## Verification

Integration script: `docs/infra/ci/stock-transfer-regression.mjs`.
Seed: `docs/infra/ci/seed/stock-transfer-local.sql`.
Only localhost/127.0.0.1 hosts are accepted. Import the seed into the local Moqui database and restart local Moqui to invalidate cached users and memberships before running the script. Set `SMOKE_PASS` through your local environment. The script captures generated transfer, asset, ledger, serial-history and invoice IDs and removes its disposable fixtures in `finally`; `STOCK_TRANSFER_MANIFEST` may specify an ignored local audit-output path.

The fixture uses its own organization, party membership, users, facilities and products. Deliberately non-legal GSTIN markers exercise the existing inter-state branch with an exempt product; no external provider is called. No real tenant or issued customer invoice is used for write testing.

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
