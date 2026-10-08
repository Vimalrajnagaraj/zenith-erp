# Serial Number Tracking review

Scope: Inventory / SerialNumbers on both /apps and /qapps. Functional changes and UI are on `codex/serial-number-tracking-fixes-ui`; earlier PR branches are not edited. Based on the supplied Serial Number Tracking screenshot and existing Inventory styling; no component/design Markdown was supplied for this page.

## Functional fixes

- Scope table, summary cards, product/location choices and CSV to a real selected organization. Non-admins must belong to it. Missing/forged selections return no serials and reject writes; foreign warehouse references are excluded.
- Replace generic entity writes with guarded registration/status services. Validate serial-tracked owned asset products, owned required warehouse, owned supplier role, serial length/control characters, receipt/warranty dates and mandatory batches.
- Trim serials and prevent case-insensitive duplicates, including concurrent submissions across owned products using the organization row lock.
- Fix initial status to In Stock and whitelist input fields. A registration creates identity metadata plus one audit event; stock quantities must come from Receiving.
- Lock status changes, require the expected current state and validate transition rules. Asset-linked serials and sales/reservation/return/restock/scrap movements must use the inventory/sales workflows. This page cannot fake a sale, move a warehouse or overwrite a stale state.
- Query search/sort/pagination on the server, preserve filters across paging, and restore saved finds into the report query. Export all filtered rows across pages and quote/neutralize CSV formula content.
- Keep native CSRF/POST/write-role protection. Separate the registration serial field from the search serial field so searches do not pre-fill registration.

## UI/components/design

Scoped `#serialTracking` only; the shared ZenithApp file registers three assets without changing other module behavior. Assets use cache versions. Native registration, column configuration and saved-find dialogs are preserved, including their wrappers and event handling.

Components: title/subtitle and violet Register Serial; four live-count white cards with violet/green/blue/red icon tiles; search/Columns/Saved Finds/CSV/Reset toolbar; eight-column Tracked Serials table with semantic status badges; entries and server pagination footer.

Typography follows the existing Inventory pages: 26px desktop title (24px phone), 13px body/controls, 12px table headers/status badges, 18px section heading and 28px summary values (26px phone).

Tokens: action violet #7C3AED, text #101029, secondary #50536F, border #E6E7EE, page #F7F7F8. Desktop four cards; narrower layouts two cards and wrapping controls; phone title/action stack. The wide table scrolls inside its card. Dialogs are bounded by the viewport. No duplicate serial identity is deliberately reproduced from the reference image.

## Verification and current limits

- 25 HTTP/database regression checks using `docs/infra/ci/serial-tracking-regression.mjs` in the disposable local review DB. Includes organization/membership isolation, concurrent duplicates, field validation, audit writes, stale/invalid/asset-linked status guards, CSRF/view-only denial, saved finds, search, pagination and full safe CSV.
- Actual /qapps dialog registration was exercised: exactly one In Stock identity and one Register audit record. Captured IDs removed afterward. Native Columns and Saved Finds open; a saved search restored one matching record. Both /apps and /qapps toolbar and report were reviewed.
- All four static source guards and JavaScript syntax checked. No customer data, credentials, taxes, amounts, invoices or stock quantities are in this change.
- Responsive /qapps previews verified at 1280px, 768px and 375px after rebasing onto master 8054b6af. Cards/controls wrap, text remains inside the viewport, and the wide table scrolls internally; document width stays within the viewport. /apps desktop render also verified. These checks do not claim pixel parity at every device size.
- Existing shell/offline diagnostics are not hidden by this change. Sales, receiving and stock transfer posting workflows are outside this page's change.

## Local preview and publication gate

Review URL: http://127.0.0.1:8084/qapps/zenith/Inventory/SerialNumbers?pageSize=10
Container: `zenith-erp-serial-number-tracking-review`; DB: `moqui_serial_number_tracking_review`. Scheduled jobs disabled in this disposable review. Other local ERP previews are untouched.

Six clearly synthetic SNREVIEW identities were used only in the separate local review database for visual review: 2 In Stock, 1 Sold, 1 Reserved, 1 Defective, 1 Under Warranty. After the user approved the UI, all captured preview identities, products, warehouses and accounts were purged; zero residue verified. No stock quantities or accounting entries were seeded. Screenshots remain local evidence, not production defaults.

Regression SNFIX fixtures, history, empty linked-asset guard, saved finds and associated accounts/parties are removed by captured or exact IDs, with zero residue checked. Evidence files and preview cleanup manifest are local ignored artifacts under `C:/Projects/zenith-erp/tmp/serial-number-tracking/`.

Follow `docs/SOP-commit-and-deploy.md` and the PR template. Publication checks completed: fresh rebase onto master 8054b6af with upstream asset registrations preserved; 25 HTTP/DB regression checks repeated and passed; four static guards and JavaScript syntax passed; responsive previews checked; all SNFIX/SNREVIEW fixtures removed by exact captured IDs with zero residue. The user authorized publishing. GitHub CI and reviewer approval remain required before merge. A current conflict-free check cannot guarantee future mergeability if master advances.
