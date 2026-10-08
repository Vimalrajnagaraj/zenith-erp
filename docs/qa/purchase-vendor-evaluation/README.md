# Vendor Evaluation regression evidence

These helpers are for an explicitly disposable, loopback Moqui runtime. Never deploy or invoke them on production. No production records, legal registrations, prices, tax rates or stock are included.

Use the complete candidate component tree, the repository's staging base overrides and canonical framework UI patches. Enable `-Dpurchase.pricing.qa.disposable=true`, bind HTTP to `127.0.0.1:18085`, and use disposable H2 TCP on `127.0.0.1:19097`, database `mem:purchase-pricing-qa`. Disable jobs and external delivery. The independently compiled JDBC probe accepts SELECT statements only and restricts access to this loopback database.

Copy `fixture.xml` to `runtime/component/zenith-erp-purchase/VendorEvaluationQaFixture.xml` and `qa-screen.xml` to `runtime/component/zenith-erp-pricing/screen/zenith/pricing/VendorEvaluationQaAcceptance.xml`. They are explicitly initialized by the runner; the fixture is not auto-seeded. Initialization refuses existing fixture state and requires the disposable property and platform ADMIN. Only the public Moqui demo authentication is copied to synthetic QA accounts; no deployed credentials are used.

With Node, Playwright, Chrome and a JDK installed, set `EVAL_QA_RUNTIME` to the throwaway runtime root, `EVAL_QA_JAVA` to the JDK executable, and `EVAL_QA_OUT` to a private output directory. Run `node docs/qa/purchase-vendor-evaluation/verify.cjs`. The default `final` mode checks both interfaces, persisted writes, negative cases, actual CSV links, scoped JSON pickers, legacy ratings, mobile dialogs and view-only access. `EVAL_QA_MODE=baseline` records pre-fix behavior without expecting the new presentation hooks.

Cleanup validates captured generated IDs and their synthetic remarks marker, resolves stored fixture and auxiliary composite keys, deletes only those exact rows, and independently asserts zero residue across nine tables. Invoice snapshots must remain unchanged before and after cleanup. A failed run is not cleanup proof; reset the disposable database before retrying.

The local public-framework rebuild is not claimed byte-identical to production. Trusted master staging CI supplies separate image verification. `report.json` and screenshots here contain synthetic evidence only. They do not replace the SOP's owner-approved MARUTHI before/after no-op database report, confirm deployment, or certify the entire Purchase module. Keep the PR draft until the outstanding owner gate is satisfied.
