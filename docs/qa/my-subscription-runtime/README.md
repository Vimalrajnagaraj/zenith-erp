# My Subscription runtime verification

Scope: tenant SaaS billing (`/apps/zenith/my-subscription` and `/qapps/zenith/my-subscription`), plus the platform invoice settlement caller required by its receipt boundary. Customer recurring subscriptions are a different module.

## Reproduce safely

Use a clean checkout of this branch, Docker, Python 3, and the approved `zetaerp-moqui:clean-staging` image from release `staging-image-clean-v1`. Verify the archive SHA256 against the pinned master staging workflow before loading. This run used archive SHA256 `0305b2d2f7124781c41de04eb8aa8a7847ee5116ee01f09dc52d7f12dc513b93`. This is the sanitized clean staging rebuild; byte identity with the currently deployed production image is not claimed.

```sh
sh docs/qa/my-subscription-runtime/run.sh start
sh docs/qa/my-subscription-runtime/run.sh test
# Perform the browser checks below before cleanup.
sh docs/qa/my-subscription-runtime/run.sh stop
```

The runner refuses an existing project and checks Docker project labels before operating. PostgreSQL uses tmpfs, with no named volume. HTTP starts only after overlays and one fixture load finish. The helper screen is installed only by this runner, requires `-Dmysub.qa.disposable=true`, restricts callers and synthetic IDs, and is absent from the production component tree. Never install this helper or seed on production. The suite requires October 2026 because its documented paid period is 1 October–1 November 2026; refresh dates and expected assertions deliberately for later runs.

Fixtures use `MYSUB_QA_` IDs. Password setup copies the existing public Moqui demo hash inside the disposable DB; no production credentials are used. The synthetic owner can sign in on port 18086 using org `MYSUBQAA`, username `mysub.owner`, and the standard public Moqui demo login. Do not use these fixtures in an existing localhost database.

`/tmp/zenith-mysub-qa/results/services-summary.json` records each assertion. Negative writes compare fingerprints of all SaaS tenants, subscriptions, invoices, payments, audit logs and usage. The suite also fingerprints the separate financial Invoice table. Signed webhook fixtures prove application validation and transaction persistence; they are not real provider capture evidence. Ephemeral generated HMAC settings remain only in the disposable DB.

## Actual browser pass

1. Sign in through the Login page after each fresh rebuild; old sessions/cached SPA pages are not valid authentication evidence.
2. On both surfaces open a plan dialog, dismiss it and assert no DB change; confirm a change and assert the displayed plan agrees with `saas_tenant.plan_id`, one active subscription and its retained renewal date.
3. Test immediate downgrade, cancellation reason/confirmation and retained-period notice. Reload and verify database persistence.
4. Click the specific invoice's Pay Now. With no provider configuration, expect the friendly unavailable message and buttons to be enabled for retry, with no payment record.
5. Measure actual viewport and document/content widths at 375×812, 768×1024 and 1440×900. Inspect header, plan cards, usage and contained scrolling of payment tables. Confirm shared navigation remains available.
6. Use only synthetic screenshots, with no tokens, credentials or real tenants.
7. Compare the My Subscription light header with live white on both surfaces. Keep dev/test mode enabled, check search and dark/light toggle, dismiss native dialogs without submission, and navigate Dashboard → My Subscription through the SPA. The scoped override must not recolor another module.

## Remaining release gates

A Razorpay **test-mode** order/create/reuse → hosted Checkout → captured-payment lookup → callback/webhook positive flow is required before marking the payment integration fully verified. Owner must then perform the production SOP's MARUTHI read-only/no-op deployment assessment on the exact deployment candidate. No live subscription changes, charge, password change, merge or deployment are authorized by these QA scripts. Preserve existing invoices; the new gateway fields and proration basis are nullable and legacy exact `razorpay_order:<id>` bindings remain supported.
