# Expiry Risk: functional and UI verification

Scope: Inventory → Expiry Risk (`ExpiryDashboard.xml`) and its receipt/edit, report and preference paths. Branch `codex/expiry-risk-fixes-ui` starts from master `ba5143a3d1d5e97d2182ff7ba535f36862690a2f`. Functional changes precede UI changes in separate commits on this branch. Other PR branches and the 8080/8081/8082 runtimes are untouched.

## Functional changes

- Every report and write requires a real selected organization. Non-admin membership is checked; missing or forged selection fails closed. Admins remain scoped to the selected tenant. Product/facility/asset ownership and Inventory write permission are checked independently.
- Receipts reject invalid dates, negative/zero quantities, negative values, excess decimal precision, foreign selections, unlabeled tracked batches and serial stock requiring Receiving. Stock starts at zero and is posted once through AssetDetail. Request IDs plus a transaction lock prevent duplicate/replayed receipts. Products become inventory-tracked.
- Lot updates lock stock, require its current version and preserve reservations. Zero write-offs work. Damage/expiry/write-off cannot increase quantities. Serial quantity changes and batch identity replacements require their dedicated workflows. Stock changes create an applied adjustment audit; legacy ledger gaps are reconciled before the movement. Stale/concurrent submissions cannot overwrite newer stock.
- Expiry uses calendar dates in the user's time zone. Today is zero days, not expired; boundaries 30/31/60/61/90/91 are consistent. After 90 days is reachable. Explicit zero valuation stays zero; cost/MRP/unvalued bases are distinguished.
- Summary cards distinguish prospective 0–90-day stock from expired stock independently of date-bucket filtering. Owned available inventory only; supplies, scrapped stock and foreign owners are excluded. Search, category/supplier, sorting and exports share the same scoped service.
- CSV quotes values and neutralizes spreadsheet formula strings; selected exports retain filters and sorting. The PDF uses the same scoped filtered list. Invalid period inputs fail safely.
- Alert settings use fresh transition scope and validate their threshold/flags. Saved views and column choices are scoped per user and organization; malformed preferences cannot crash the page. Views retain sorting and page size. POST and framework CSRF checks remain in place for mutations.
- Email Report uses a dedicated current-report template, retains filters and refuses to claim success without a recipient or after a mail error. No external message was sent during verification.

## Presentation

The supplied reference guides the header, two cards, four filters, date chips, saved-view controls, export toolbar, table columns, day/status badges, row controls and pager. All counts/dates/identity remain real. The reference's expired rows and zero expired KPI contradict each other; this implementation shows correct independent totals.

CSS and enhancement scripts are scoped to `#expiryRisk`. Both Bootstrap `/apps` and Quasar `/qapps` have selection, saved columns and native dialogs. Filter submissions navigate with the complete filter state; page-size/sort/chip links retain the relevant state. Wide tables scroll inside their card. Native shell identity and other module navigation stay available. Assets are versioned in ZenithApp.

Browser verification covered a 1537×1023 reference viewport, 768×1024 Bootstrap tablet view and 390×844 Quasar phone view. The phone document remained within the viewport (375 ≤ 390 CSS pixels); its receipt dialog was 311 pixels wide. The tablet document also stayed within its viewport (753 ≤ 768). Search returned the two matching sample lots, select-all/clear worked, and the second-row Edit dialog showed that lot's own ID, date, quantity and value. Browser checks additionally caught and corrected Quasar's swallowed filter submission and missing/native action styling.

## Verification and preview

2026-10-08: **34 native workflow checks passed**, including a real filtered PDF response, exact stock/ledger/reservation assertions, concurrent receipts/edits, permission/isolation checks, saved views/columns and rendering on both surfaces. Four repository guards and JavaScript syntax checks passed. The harness captures created IDs, purges its fixtures and verifies zero fixture assets/parties.

Only container `zenith-erp-expiry-risk-review` at `127.0.0.1:8083`, database `moqui_expiry_risk_review`, was used. Scheduled service jobs are disabled in this disposable runtime. The seed and harness reject non-local URLs and databases outside `moqui_expiry_risk_*`; provide the existing local demo password privately as `SMOKE_PASS`. Do not seed a production or shared database.

Separate `ERPREVIEW` visual fixtures are intentionally retained in the isolated preview while the user reviews six clearly labeled sample lots. They are not production rows or deployment seeds. Capture their exact related IDs and remove them before publication; the local ignored preview manifest records the review scope. Regression fixtures (`ERFIX`) have already been removed and checked independently.

## Publication and rollout

The branch is held locally until the user's confirmation. Prepare the template-compliant PR description locally; a GitHub PR number requires pushing the branch. Run repository CI and exact-candidate staging acceptance after authorized publication, then mark ready only when the required checks pass. Recheck latest master immediately before publication; a clean local merge simulation cannot guarantee conflicts will never arise later.

Maintainer review and the production deployment gate still apply because stock posting and tenant guards changed. Load `EmailExpiryRiskReportTemplateData.xml` through the approved inventory seed process before enabling Email Report. Configure/verify delivery with the approved mail setup; actual email delivery was not tested. This branch adds no entity columns and does not depend on unmerged Stock Adjustments changes. Merge does not deploy.
