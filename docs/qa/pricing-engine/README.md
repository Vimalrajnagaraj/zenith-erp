# Pricing engine regression

Run against a fresh disposable Moqui runtime with this candidate's components. This is a focused engine suite, not certification of Purchase or all Pricing CRUD. The fixture values are mechanical arithmetic cases, never business defaults or legal registrations. The fixture contains no invoices, payments or real tenant records.

Required runtime configuration: loopback HTTP `127.0.0.1:18085`, H2 `jdbc:h2:mem:purchase-pricing-qa;DB_CLOSE_DELAY=-1`, H2 TCP bound to `127.0.0.1:19097`, disabled SMTP/jobs/search, null transaction journal, and JVM property `-Dpurchase.pricing.qa.disposable=true`. Never install the helper or fixture on a production runtime.

Copy `qa-screen.xml` to `runtime/component/zenith-erp-pricing/screen/zenith/pricing/PriceEngineQaAcceptance.xml` and `fixture.xml` to `runtime/component/zenith-erp-pricing/PriceEngineQaFixture.xml` before starting the disposable JVM. Overlay the candidate's complete component tree first; do not overlay another unmerged application branch.

With Node, Playwright, Chromium and JDK 21 available:

```powershell
$env:PRICE_QA_RUNTIME = '<disposable runtime root>'
$env:PRICE_QA_JAVA = '<JDK 21>/bin/java.exe'
$env:PRICE_QA_CHROME = '<Chromium executable>'
$env:PRICE_QA_OUT = '<temporary proof directory>'
node docs/qa/pricing-engine/verify.cjs
```

The runner uses public Moqui demo authentication, initializes once, verifies fixture ownership and organization membership, and then calls the real `calculate#Price` service. It checks the fixed-price baseline, zero-price volume precedence, inactive/expired/foreign/currency-invalid lists, historical item validity, a zero discount cap, single rule application after parent fallback, and nonpositive quantity rejection. All invoice rows and stored prices must remain unchanged. Cleanup removes the fixture rows by exact captured primary keys in reverse dependency order; independent JDBC queries must show zero residue. Stop the disposable JVM afterward to destroy its memory database.

The master-owned staging acceptance remains a separate required check against the exact pushed candidate. It covers the repository's shared isolation and billing goldens; it does not execute this focused suite or establish a real MARUTHI no-op. The owner must supply that production evidence and approve the pricing behavior before deployment.
