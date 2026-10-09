# Purchase reference UI verification

Compare the ten Purchase pages with the approved [reports](https://drive.google.com/drive/folders/1BI6tEWlHrNpEZpEoD4Eh6SSTAgul40dL) and [fixed images](https://drive.google.com/drive/folders/1wWgzdTASaufz7D30q_yulB2Q4aWCp1gi). Reference customer records, counts and registrations are never copied into application code.

Only install `fixture.xml` as `PurchaseUiQaFixture.xml` in the Purchase component and `qa-screen.xml` as `PurchaseUiQaAcceptance.xml` in the Pricing screen directory of a **fresh disposable loopback runtime**. The helper requires authentication, platform ADMIN for setup/cleanup, and `-Dpurchase.ui.qa.disposable=true`. It must never be installed in production. Use an in-memory H2 database named `purchase-ui-qa`, loopback TCP 19107, HTTP 8088, scheduled jobs disabled and SMTP/search endpoints empty. The public Moqui demo password is copied into a temporary disabled-until-initialized account by the guarded helper; production credentials are not used.

```sh
python docs/qa/purchase-ui/check-source.py origin/master
python docs/qa/purchase-ui/acceptance.py --initialize
python docs/qa/purchase-ui/acceptance.py
# Real-browser verification is separate: an HTTP SPA shell 200 is insufficient.
python docs/qa/purchase-ui/acceptance.py --cleanup
```

The source comparison verifies that executable screen actions/transitions, queries, row actions, native write forms and role predicates match the base. The HTTP suite checks ten Bootstrap renders. In a browser verify all ten pages on `/apps` and `/qapps` at desktop, tablet and mobile widths; check native filter apply, sorting, loaded-row search, page sizes, pager boundaries, CSV, creation dialog open/cancel, bill form layout and actual read links. Do not create, update, delete, pay or reconcile production records during UI verification.

Use `PurchaseUiDbProbe.java` with the disposable H2 driver for independent SELECT-only before/after assertions. The probe is pinned to the loopback in-memory database and rejects writes and multiple statements. Compare Purchase RFQ, evaluation, GRN, job work, portal record, order/part and invoice rows, including a separate aggregate for unrelated demo invoices. Capture exact fixture keys, purge in dependency order with the helper, verify zero business/party/user residue, then stop the runtime and confirm its ports are closed.

Run the trusted master `staging-acceptance.yml` workflow with the exact candidate SHA (profile `none`) plus the automatic PR staging and repository guards. There is currently no trusted Purchase-specific workflow profile; generic CI does not substitute for the documented browser and SQL checks.

This presentation PR is rebased on master containing the Purchase functional fixes, including #34, #35 and #40. It preserves current invoice behavior, GRN guidance and the ₹0.01 reconciliation tolerance. Parent billing/authentication/isolation deployment gates remain applicable. Merge and production deployment are separate maintainer actions.

The latest native reverification records 60 layouts, twelve dialog open/cancel pairs, real filter submits, eight pagination assertions (ten rows, the remaining three, disabled last-page next, and first-page restoration on both interfaces), and unchanged snapshots of eight business tables plus unrelated demo invoice aggregates. Stored synthetic business/identity keys were cleaned to zero and the disposable runtime was stopped; independent IFEXISTS reconnect failed. Scoped CSS also keeps native dialogs on mobile and disables the card hover transform that made nested filter submits move under the pointer. See `review-reverification.json` for source and report fingerprints. Required GitHub checks remain pending while the repository account cannot start jobs.
