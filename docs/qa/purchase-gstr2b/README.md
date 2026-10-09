# Purchase GSTR-2B / eligible-credit report verification

Based on master `1997a90f97fb1743b88c8d51a4e2aee418aab2b5`. Final disposable acceptance: **87 checks, zero failures**; see `report.json` and synthetic mobile screenshots. This certifies the changed report/view/export/UI paths, not the entire Purchase, Pricing or GST filing workflow.

## Reproduced problems and fixes

- The baseline credited CGST/SGST 63 each, including explicit `itcEligible=N` and supplier-composition snapshots. Eligible/default-Y bills contribute 18 each; outward charged tax remains 90 each and net payable becomes 72 each. The purchase register still includes all four inward bills and all charged tax (63 each). Only inward-credit aggregation changes; current registration configuration does not rewrite historical invoice eligibility.
- An own portal record pointing to a foreign bill exposed that bill's number and taxable amount. The optional view join now also matches the buyer organization; missing/foreign books contribute no matched credit.
- No active organization could export fixture portal records. Lists, counts, dialog organization choices and both export paths now fail closed; forged organization search fields cannot bypass scope.
- Matched credit omitted cess and ignored the stored book's explicit ITC exclusion. Matched ITC now requires a same-org book, Matched status, portal availability Y, and no stored exclusion/composition flag. This is a display/export calculation, not a statutory filing approval.
- Importer status `Mismatch` was absent from the Unmatched counter/filter and the UI advertised a rupee tolerance instead of the existing 0.01 per-component comparison. Those labels and counters now match the existing importer.
- Quasar's responsive `lg` utility hid size-labelled icons. A local icon-size class preserves all five icons at 1366/768/390/360. Header controls do not overlap, content clears navigation, and both mobile reconciliation dialogs fit and close by a real pointer click. Bootstrap dialogs now sit above the fixed header. Scoped leaf assets and status colors preserve readable controls.
- Native standalone exports use real field values and omit page chrome; custom and native CSV retain zero-row headers. The difference column describes taxable difference and stays blank without a matched book.

## Evidence and isolation

`verify.cjs` drives real Moqui services and both `/apps` and `/qapps` screens. `Gstr2bDbProbe.java` accepts one SELECT only and connects exclusively to `jdbc:h2:tcp://127.0.0.1:19097/mem:purchase-pricing-qa;IFEXISTS=TRUE`. It confirms posted fixture existence, flags, unchanged invoice headers/lines/portal rows and exact cleanup across 13 fixture tables plus unchanged outside invoices.

`fixture.xml` contains only disposable arithmetic, synthetic ownership and public demo authentication derived at runtime. It contains no GSTIN, PAN, HSN, customer data or business default. The default-Y legacy fixture does not claim to test a stored NULL eligibility flag. Unsupported legacy/current legal cases remain owner review decisions.

`qa-screen.xml` is **disposable only**: it requires `purchase.pricing.qa.disposable=true`; initialization/cleanup require platform ADMIN, and the operation allowlist requires the synthetic account. Copy it only to the disposable Pricing screen directory as `Gstr2bQaAcceptance.xml`; the fixture belongs at `component://zenith-erp-purchase/Gstr2bQaFixture.xml`. Never deploy these helpers.

Configure `GSTR_QA_RUNTIME`, `GSTR_QA_JAVA` and `GSTR_QA_OUT`, then run `node docs/qa/purchase-gstr2b/verify.cjs` with Playwright and local Chrome. Use the named loopback disposable runtime with the complete candidate component tree, committed CI base overrides and canonical framework UI patches. The local public framework rebuild is not byte-identical production evidence. Trusted master-dispatched GitHub staging must independently validate the exact committed candidate SHA.

## Deployment gates

This is the reporting companion to Vendor Bills PR #34. Review their deployment order and reverify the combined tree after rebasing shared asset registrations. Do not merge or deploy from this task.

Keep draft until the owner supplies the SOP-required MARUTHI organization 100000 before/after no-op DB evidence. Live inspection is read-only and the site displays a cached/offline notice, so it does not prove deployed source parity. The import parser is unchanged; approved sanitized portal input is still needed for a separate positive import audit. Negative foreign/missing-CSRF import requests are checked here, without writing production records.
