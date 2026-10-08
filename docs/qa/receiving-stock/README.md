# Receiving stocks verification

Source: `FindReceipt.xml`, `ReceiveInventory.xml`, and `ReceiptServices.xml` in the Inventory component. Both `/apps/zenith/Inventory/FindReceipt` and `/qapps/zenith/Inventory/FindReceipt` render the same screens.

## Reproduced defects and changes

- A completed delivery of four units appeared as one received and three pending after three units were sold. Receipt totals now use accepted receipt records and the existing retail receipt ledger; current on-hand stock never determines historical delivery. Completed orders are removed before pagination.
- Receipt input validation and ownership checks now run together in a service. PO product, price, and currency come from the stored order line. Remaining quantity accounts for cancellations, and a database order lock prevents concurrent final receipts from exceeding the order quantity.
- Receipt assets retain quantity accounting, cost, batch, manufacturing/expiry dates, and MRP without changing the product's inventory tracking setting. This retains the existing retail Asset/AssetDetail receipt model and introduces no new accounting posting path.
- Incoming transfers validate their stores, products, and quantities before using the existing idempotent transfer service.
- The date filter used the nonexistent `orderDate` field. It now uses `OrderHeader.entryDate`, with bounded filter/sort inputs and consistent pagination after fully received orders are removed.
- The receiving page follows the latest supplied reference and base theme palette: a header action, separate filter card, compact order table, outlined receipt buttons, status badges, CSV export, and pagination. Styles are scoped to receiving. Native receipt forms, dialog actions, access-based visibility, and navigation remain in use.

## Local verification, 2026-10-08

Testing used the loopback Docker Moqui/Postgres environment and disposable synthetic organizations with the `RCVQA_` prefix. Synthetic sample data was explicitly requested for visual review. No production write or deployment occurred.

| Check group | Result |
| --- | --- |
| Direct/PO receipts, validation, receipt history, cancellation, concurrent receipt, and request protection | 32/32 passed |
| Order/supplier/date filters, sorting, malformed filters, and pagination bounds | 9/9 passed |
| Transfer receipt/idempotency and invalid transfer boundaries | 7/7 passed |
| Native receipt forms with DB assertions and final HTTP method/session-token boundaries | 10/10 passed |
| Receiving page at 360, 390, 768, 1280, and 1731 px on both renderers | 10/10 viewport checks passed |
| XML parsing | 40 Inventory/app XML files passed |
| Repository guards | CSS comments, party picker, cross-module transitions, and form DOM collisions passed |
| Diff whitespace validation | Passed |

Browser interaction also verified the Apply filters button on both renderers and the direct/PO receipt dialogs on narrow screens. Tables scroll within their cards. The Bootstrap modal now stacks above the sticky header; the Quasar mobile header separates search and toolbar controls. Native Quasar forms resolve their action transition during GET-time rendering, so the transition remains discoverable and checks the actual request method before writing.

The baseline reproduction and the summarized local results are in `results.json`. They are local evidence, not a GitHub CI result or an exhaustive guarantee for every device.

## UI reference revision

The second supplied screenshot replaces the earlier green callout. The existing receipt service, all receiving transitions, and the direct receipt form were compared with their pre-redesign snapshots and remain identical. The PO receipt screen changed only its stylesheet version. The additional screen actions prepare a read-only view: product-line counts, outstanding quantities, a partial-receipt badge, and a bounded status filter applied before pagination. They use the existing receipt totals and cancellation calculations and do not modify order statuses or stock.

The legacy conditional “Stock transfers on the way to your stores” panel was removed from the Receiving widgets after review. Transfers remain accessible through the Stock Transfers navigation and link. The receiving transitions and stock services were preserved.

Eight read-only checks passed for status, order number, supplier, date range, invalid status, and pagination bounds. CSV attachments were checked for all six orders and a filtered partial order on both routes; the final Export button also downloaded the CSV successfully in the in-app browser. Partial receipt history still shows 5 received and 15 pending for the 20-unit line. Its order has a second 6-unit line, so the summary correctly shows 2 items and 21 units outstanding.

The revised layout passed ten viewport checks across 360, 390, 768, 1280, and 1731 px on both renderers. Filter controls and the header action stay within the available page width; wide tables scroll inside their native wrappers. Both receipt dialogs were opened at mobile width. XML parsing, all four repository guards, and diff whitespace validation passed. The prior functional test results above remain separate from these UI checks.

## Review and release gates

The requested visual review is complete and the user authorized pushing the branch. Operational test receipts, transfers, negative-case fixtures, and the final visual-review fixtures were removed by exact captured keys. The latter included one organization, three suppliers, one store, four products, six purchase orders, and one partial receipt (5 of 20 units received). Cleanup assertions confirmed zero remaining rows for every captured key across the eleven affected tables. The review user's original organization preference was already restored and was preserved. The temporary local QA screen is removed from the runtime and is not part of the change. Screenshots remain local review artifacts and are not committed.

The change uses explicit staged paths and one PR against `master`. A merge dry run against the freshly fetched `master` succeeded, including the shared app stylesheet registration. GitHub checks and a maintainer review of the write/organization boundary are required before merge. The local MARUTHI asset fingerprint was unchanged during tests, but that local tenant has no assets: this is not evidence of a production tenant no-op test. Production deployment and production tenant verification remain maintainer work.

Rollback is a normal revert of the receiving commit followed by the existing deployment process. There are no schema migrations or changes to issued invoices.
