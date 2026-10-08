# Barcode module verification

This candidate fixes the Barcode lifecycle and the connected POS/Inventory code, label and exact-scan paths. It does not merge or deploy, create billing records, alter persisted table schema, or seed production data.

## Reproductions and fixes

The unmodified `1997a90f97fb1743b88c8d51a4e2aee418aab2b5` baseline was exercised on a disposable native Moqui runtime. Its initial 18 assertions had six failures: foreign-product assignment, untrimmed values, lowercase Code39 acceptance, foreign-template job creation, negative quantities creating jobs, and no-organization lookup leakage. Failed harness setup attempts are excluded from that baseline.

The resulting boundaries use the stored record owner and an authorized active organization. No organization or a forged non-member preference returns no tenant records. The Barcode detail view also checks its product owner, hiding inconsistent legacy references. Product codes/GTIN aliases cannot ambiguously identify different products in the same organization. Primary replacement and pseudoId mirroring roll back together; product-code reservations lock organization then product. Platform ADMIN retains stored-record maintenance access. Read-only Barcode roles receive working read services and no write controls.

Print jobs validate the entire request before creating rows, aggregate repeated products, preserve captured barcode values, and reject edits after completion. Empty/invalid jobs cannot be completed. Templates validate dimensions/flags, retain their owner, support editing, and keep one default per organization.

Rendering preserves each assigned barcode's symbology and leading zeros. Template layout flags control visible fields; an existing template's format metadata does not reinterpret an assigned EAN/UPC/QR value. JSON and HTML escaping preserve values without executable markup. UPC-E uses its own encoder. A Barcode-only fork of the bundled QR library fixes UTF-8 encoding/capacity accounting; other users of the original QR library are unchanged. Preview/print reject invalid or clipped layouts, preserve iframe geometry while loading, and check readiness before invoking print.

External scoped JS/CSS fixes cached-page initialization, SPA event binding, modal controls/focus, and mobile layout. POS Enter saving uses a session-token fallback on /apps, marks unsaved edits, and keeps Remove available after a new code is saved. Uncoded products are not selectable in the POS label picker. Scanner Enter resolves exact codes, including standardized GTIN forms, and never guesses a partial-name match. Type-ahead filters in SQL before limiting its suggestions.

## Ground-truth suite

`verify.cjs` invokes actual screens/services on both `/apps` and `/qapps`. `BarcodeDbProbe.java` independently checks H2 with a SELECT-only connection. `decode.py` independently decodes rendered PNG pixels using ZXing, rather than trusting SVG attributes or encoder metadata. Mechanical fixtures contain organization/product metadata and codes only: no invented amounts, stock, tax, legal identifiers, customer records, or billing rows.

The suite covers four Barcode screens plus POS Barcodes/BarcodeLabels at 1920, 1366, 768, 390 and 360 pixels on both surfaces (60 layout checks), real form submissions, exact/unknown/ambiguous/inactive scans, leading zeros and GTIN equivalents, Code128 escaping and Unicode QR, tenant/CSRF/read-only boundaries, template defaults, captured jobs, completed-job immutability, a 3000-row catalogue, independent billing/stock/payment fingerprints, and exact-key cleanup. See the final report and SOP coverage table for results and limits.

The QA helper and fixture live under `docs/qa/`, never the deployed component tree. Install them only in a disposable runtime. Every helper path refuses to run without `-Dpurchase.pricing.qa.disposable=true`; setup/fixture updates/cleanup also require a disposable platform ADMIN. Cleanup first validates all independently captured keys and owners, then removes child and parent rows by those exact keys. Afterwards SELECT verifies zero residue. Destroying the isolated in-memory database removes the remaining disposable identity/organization metadata.

## Reproduce locally

Use a disposable native runtime with the repo's canonical webroot/macro patches, classes and complete candidate component tree. The local run uses HTTP 18085, H2 TCP 19097, database `mem:purchase-pricing-qa`, Java 21, H2 2.4.240, Playwright/Chrome, Python/Pillow and `zxing-cpp==3.1.1`. The framework jar in that native runtime was rebuilt from public framework sources and is not byte-identical to the production jar.

Copy `fixture.xml` to `component/zenith-erp-barcode/BarcodeQaFixture.xml` and `qa-screen.xml` to `component/zenith-erp-barcode/screen/zenith/barcode/BarcodeQaAcceptance.xml` **only in that disposable runtime**. Supply these environment variables and run `node docs/qa/barcode-runtime/verify.cjs`:

- `BARCODE_QA_RUNTIME`: disposable runtime containing `WEB-INF/lib/h2-2.4.240.jar`
- `BARCODE_QA_JAVA`: Java executable (with adjacent javac)
- `BARCODE_QA_PYTHON`: Python executable
- `BARCODE_QA_PYTHON_DEPS`: optional directory containing ZXing/Pillow
- `BARCODE_QA_OUT`: output directory outside the checkout
- `BARCODE_QA_MODE=final`
- `NODE_PATH`: directory containing Playwright

The public demo account is used only inside the isolated runtime to initialize disabled synthetic fixture users. Do not expose that runtime or helper to a live tenant.

## SOP deployment gates

Keep the PR draft until the owner supplies the required approved production-tenant before/after database no-op evidence and a staged cashier/cart regression. Local database fingerprints and decoded pixels do not replace that evidence. Physical printer calibration, browser print-dialog cancellation and real handheld/phone scanning also require owner verification; no physical printing or real billing was attempted here. The native runtime proof is supplemented by the repository's trusted `master` staging workflow with the full candidate SHA and `contacts_profile=none`; that workflow has no dedicated Barcode profile, so its core smoke result must not be presented as this full Barcode suite.

The production browser was inspected read-only. The live `/apps` Barcode routes loaded; `/qapps` was observed stuck in the shell's offline/progress state. No customer records, live screenshots, credentials or database output are included in the evidence. Merge does not deploy. Amal controls deployment sequencing and should rebase overlapping POS PR #27 or this PR against the actual merged base before deployment.

Deployment must load the Barcode view definition together with its screens/services/assets and reload entity/screen/service caches (or restart the app). The added owner alias is a view definition, with no database DDL or data migration. Do not copy a new screen onto a runtime that still caches the old view definition.
