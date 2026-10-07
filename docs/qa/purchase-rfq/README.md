# Purchase RFQ regression

Run only against a fresh disposable Moqui runtime with this candidate's complete component tree. The helper requires `-Dpurchase.pricing.qa.disposable=true` and public demo authentication; it is never installed by application startup or deployed to production. Synthetic amounts and quantities are mechanical validation cases, not business defaults. No invoices, payments, tax registrations or legal codes are seeded.

Use loopback HTTP `127.0.0.1:18085` and H2 memory `jdbc:h2:mem:purchase-pricing-qa;DB_CLOSE_DELAY=-1` with H2 TCP bound to `127.0.0.1:19097`; disable SMTP, scheduled jobs and external search. Copy `fixture.xml` to `runtime/component/zenith-erp-purchase/RfqQaFixture.xml`, and `qa-screen.xml` to `runtime/component/zenith-erp-pricing/screen/zenith/pricing/RfqQaAcceptance.xml` in the disposable runtime before boot. The hidden helper uses the Pricing route solely for test setup/scope/cleanup; all tested mutations use the real Purchase RFQ transitions.

With Node, Playwright, Chromium and JDK 21 available:

```powershell
$env:RFQ_QA_RUNTIME = '<disposable Moqui root>'
$env:RFQ_QA_JAVA = '<JDK 21>/bin/java.exe'
$env:RFQ_QA_OUT = '<temporary proof directory>'
node docs/qa/purchase-rfq/verify.cjs
```

The runner requires positive fixture membership before testing. It verifies valid create/update/delete, immutable parent/vendor/organization fields, forged child IDs, product/vendor scope, invalid numeric input, CSRF rejection, actual rendered content on both /apps and /qapps, organization options in the opened SPA dialog, actual UI export URLs, forged filters, no-active-organization rejection, and five viewport sizes from 1920 to 360 pixels. Independent JDBC SELECTs verify writes, rejected-write no-ops and unchanged invoices. The runner captures generated IDs in its local report. Cleanup first resolves rows exclusively under the two disposable organizations/parents and deletes each by its complete primary key, then removes fixture rows in reverse dependency order. Independent queries must show zero residue. Stop the JVM to destroy its memory database after verification.

If the runner stops before cleanup, preserve its failure report and destroy the disposable JVM before retrying with a fresh memory database. Never reuse partial fixtures as a positive verification result. Master-owned staging acceptance and owner-approved live no-op evidence are separate SOP gates. Chromium tests do not establish Safari/device parity or certify every Purchase submodule.
