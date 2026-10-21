# Disposable Tax verification

Never install these fixtures or the QA screen in production. They use deliberately synthetic identifiers and values, not customer data or statutory registrations. The helper refuses requests unless the JVM has `-Dtax.qa.disposable=true`, requires authentication, allowlists services and confines record selectors to synthetic tenants.

## Reproduce

Use `.github/workflows/staging-acceptance.yml`, manually dispatch the candidate branch with its exact commit SHA and verification profile `tax`. The workflow loads the SHA256-pinned `staging-image-clean-v1` clean image, overlays the candidate components, installs the hidden helper and fixture only into the disposable container, runs existing POS goldens, the Tax service/browser cases and independent SQL assertions, then removes and asserts absence of all project containers/volumes. Evidence is retained for 14 days. Standard PR CI does not substitute for this Tax profile.

For an already prepared disposable loopback runtime:

```sh
TAX_QA_BASE=http://localhost:8080 python3 docs/qa/tax-runtime/acceptance.py
TAX_QA_BASE=http://localhost:8080 node docs/qa/tax-runtime/ui.cjs
# Run assert.sql with ON_ERROR_STOP against that disposable database only.
```

Python uses the standard library. Browser tests use the existing staging Puppeteer dependency. `TAX_QA_OUT` controls the output folder. The tests reject non-loopback hosts and ports other than 8080/8087. Public Moqui demo authentication is copied into temporary QA accounts inside the guarded helper; no production credentials are used. Do not copy session-bearing HTML/logs into the repository.

## Required review gates

See [audit report](REPORT.md). These tests cover specified synthetic cases, not legal correctness for every tenant, GSTN upload certification, provider connectivity or production deployment approval. A clean release runtime is not a byte-identical production image. Never use a supplied image with embedded production database/journal layers.

## Native dropdown contrast regression (POS-07-07)

`ui.cjs` runs `verify-dropdowns.cjs` on both shells as part of the Tax profile. To check installed Chrome, Edge and Playwright WebKit against an already initialized disposable fixture:

```sh
TAX_QA_BASE=http://localhost:8087 TAX_QA_OUT=/tmp/tax-dropdowns node docs/qa/tax-runtime/verify-dropdown-browsers.cjs
```

Install the existing pinned Playwright QA dependency and its WebKit browser first. `TAX_QA_BROWSERS=chrome,edge,webkit` selects engines; Chrome/Edge must be installed. For the Puppeteer suite, `TAX_QA_CHROME` optionally chooses a local executable. The cross-browser runner is read-only and rejects non-loopback targets. Its dark-theme cases apply the shared theme classes directly to test CSS inheritance. Native OS popup/device acceptance remains manual. See [report and screenshots](dropdown-report.md).
