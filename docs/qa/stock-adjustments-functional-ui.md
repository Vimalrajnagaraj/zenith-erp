# Stock Adjustments: functional and presentation verification

Scope: Inventory → Stock Adjustments list and its count/approval detail. Branch `codex/stock-adjustments-fixes-ui`, based on master `ba5143a3d1d5e97d2182ff7ba535f36862690a2f`. Functional changes precede presentation changes. Stock Transfers PR #46 and its separate checkout/runtime were not modified.

## Functional corrections

- Creating an adjustment forwards its generated ID to the detail page. New dialog fields cannot inherit warehouse/reason list filters. Native mutation forms resolve as POST transitions on both surfaces; GET is rejected explicitly and framework CSRF checks remain enabled.
- List, warehouse/product/asset selectors, detail and mutations require the active organization. Missing/forged organization selection fails closed; admins cannot mutate another selected tenant's adjustment. Inventory view-only users cannot write.
- Draft counts sum all inventory assets at the selected warehouse, exclude supplies/foreign owners, preserve decimal counts, reject invalid/duplicate counts and prevent removal of reserved quantities. Damage, expiry and write-off cannot increase stock.
- Approval validates and locks nonempty counts. Only approved counts can apply; applied records cannot be reset, reopened, edited or replayed. Parent and stock locks serialize concurrent requests. Approved counts can reopen for correction without posting stock.
- Stored count snapshots detect stock changes between count, approval and apply. Every line is validated before any stock movement, so one stale line stops the whole adjustment.
- Stock posts through AssetDetail once, allowing the existing ledger EECA to recompute totals. Legacy opening ledger gaps are reconciled for moved assets; the previous direct quantity update plus ledger movement could double-post. New opening assets are usable (`AstAvailable`).
- Batch counts require an exact existing owned lot and preserve its expiry and valuation. Serial counts require explicit unique identities, whole units and reserved inclusion. Omitted available serials are audited as scrapped; only identified registered returned units can be restocked. Per-asset identities, quantities and reservations must agree.
- Detail quantities retain up to six decimals; the undefined formatting helper is removed. Counted lot and serial identities are visible for approval. Sorting adds an ID tie-breaker without overriding requested primary sorts.

## Presentation

Reference six-column list (ID, Date, Warehouse, Type, Status, Remarks), purple controls/links, tinted header, amber/blue reason badges and green applied badges. Native find dialog, top/bottom pagination, page-size choices and instruction collapse remain usable. Native account identity and existing navigation destinations are retained; screenshot customer IDs and identity are not embedded.

Styles are scoped to the list/detail roots. Mobile controls wrap, wide tables scroll inside their cards, and both Quasar and Bootstrap native dialogs fit small screens. The native sidebar/account tools and AI Copilot remain available. Static assets are cache-busted in ZenithApp.

## Verification environment

Only the isolated `zenith-erp-stock-adjustments-review` container at `127.0.0.1:8082`, with database `moqui_stock_adjustments_review`, was changed. The shared 8080 runtime and Stock Transfers 8081 runtime were untouched. No production or MARUTHI writes.

`docs/infra/ci/stock-adjustment-regression.mjs` checks database state with disposable SAFIX fixtures. The SQL seed and harness require a dedicated `moqui_stock_adjustments_*` database and localhost URL. Set `SMOKE_PASS` privately to the existing local demo password, import `seed/stock-adjustment-local.sql` into that disposable database, then run the harness with `STOCK_ADJUSTMENT_DATABASE` / `STOCK_ADJUSTMENT_URL` pointing to it. Never run this fixture seed on a shared or production database. Cleanup captures exact created IDs, removes only fixture rows and asserts zero residue. Audit manifests and screenshots remain local/ignored.

Final local run on 2026-10-08: **34 checks passed**, then cleanup verified zero fixture adjustments, assets and parties. Native Quasar browser workflow created a draft, added a count, approved/reopened/reapproved it and applied once. Filters and instruction collapse were exercised. Quasar list/detail and Bootstrap list/create dialog were checked at 1719×915, 768×1024 and 390×844; phone tables remained wider than their card while the document width stayed within the viewport. Both native dialog variants fit the phone viewport. Bootstrap modal accessibility is synchronized with native open/close events.

The four repository pre-commit guards passed. Latest-master local merge simulation and final working-tree status are checked before handing the branch back. GitHub CI has not run because this branch has not been pushed.

## Maintainer rollout/review requirements

This changes stock posting and organization checks: maintainer review is required before merge/deployment. Do not self-merge or bypass the production DEPLOY-GATE. Load the inventory seed update containing `AdjApproved → AdjApplied` and `AdjApproved → AdjPending` transitions through the normal approved deployment process; restart alone is not evidence that seed rows were loaded. Apply the new `StockAdjustmentItem.stockSnapshot` and `serialSnapshot` entity columns before exercising the workflow.

Existing legacy count lines with no snapshot must be reopened, removed and recounted; they are deliberately blocked rather than silently applied. New batch lots and new serial identities must be registered through Receiving first. Screenshots use disposable fixtures, not production examples.

The branch is held for user review before push. GitHub guards and exact candidate staging acceptance can only be reported after an authorized push; current local mergeability cannot guarantee future master changes remain conflict-free.
