# My Subscription reference UI verification

The Drive `My_subscription.png` and its component/design reports identify the remaining launcher/card gaps. Latest master already supplies the plan/usage layouts, real prices and native confirmations. Live comparison was read-only. No live account figures or screenshots are included here.

The Cancel launcher changed from `CancelDialog` to `MySubscriptionCancelDialog`, leaving the old icon selectors ineffective. Quasar also wraps native dialog launchers in spans, so direct-button width rules miss them. A page-scoped stylesheet restores the trash icon, violet summary border and full-width Upgrade/Downgrade launchers without replacing a form or action. It is registered with `?v=1` in both ZenithApp asset blocks.

`TenantDashboard.xml` is byte-identical to the reviewed master base, including POST-only mutations, CSRF forms, tenant access, management gates and payment signature/replay checks. SaaS services, payment JS and stored values are untouched. This does not depend on #50 or apply the closed #54 revert.

## Reproduce locally

Use the existing `docs/qa/my-subscription-runtime` isolated fixture and helper, with the `mysub.qa.disposable=true` flag. Never install QA helper screens in production. The browser verifier accepts only loopback port 18085 and reads fixture credentials from environment variables:

```
UI_REFERENCE_USERNAME=mysub.owner
UI_REFERENCE_PASSWORD=<public-demo fixture password>
UI_REFERENCE_ADMIN_PASSWORD=<public-demo admin password>
UI_REFERENCE_CHROME=<installed Chromium executable>
UI_REFERENCE_OUT=<private local results directory>
node docs/qa/my-subscription-reference/verify-runtime.cjs
python docs/qa/my-subscription-reference/check-contract.py <reviewed-master-sha>
```

Use a freshly initialized memory database per run; `UI_REFERENCE_SKIP_INIT=1` is only for repeating read-only UI checks within the same disposable fixture. Screenshots and raw DOM stay local and are not committed.

## Results and limits

34 browser assertions passed on `/apps` and `/qapps` at 390, 768 and 1440px. Cancel, Downgrade and Upgrade dialogs opened and dismissed; their effective POST method and CSRF wiring remained intact. The Quasar effective method/token come from its native `mForm` component rather than the browser form element's default GET method. No confirmation or payment was submitted. No JavaScript exceptions occurred.

An independent SELECT-only JDBC probe fingerprinted every column/row of 21 business and financial tables before/after; all fingerprints match, including subscriptions, SaaS invoices/payments/usage/audit, store data, issued invoices and POS transaction/payment/session tables. `verification.json` stores hashes/counts only. All 983 tracked candidate component files matched the installed runtime byte-for-byte. Disposable teardown closed both listeners and an independent `IFEXISTS=TRUE` reconnect failed, proving no test database survives.

This local Windows/native/H2 evidence does not replace the production Linux/Postgres acceptance workflow. All four local repository guards pass. GitHub Actions remains blocked by the repository account billing/spending restriction; the PR must wait for successful repo-guards and candidate-SHA staging acceptance before maintainer merge/deploy. No real-tenant financial mutation or production deployment was performed.
