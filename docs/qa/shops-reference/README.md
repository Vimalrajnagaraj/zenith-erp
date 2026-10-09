# Shops reference UI verification

Compared the approved Drive Stores, New Store and store-detail reports/images with the live read-only UI and latest master. The existing New Store dialog and five detail tabs already match; their fields and write behavior are preserved.

The shared list chrome hides native Find Options, leaving the advanced type/status filters absent from the reference toolbar. Shops now exposes native Find Options/Columns/CSV while retaining the working page-size/pagination footer. The replacement quick-search toolbar is hidden only on Shops. The card hover transform is removed to keep the nested fixed native filter dialog stable; narrow dialog/toolbar layout stays contained. Native filter/column icons match their functions. The native mobile filter dialog and its backdrop sit above the fixed header, keeping its close button reachable.

The narrow Quasar topbar previously overlaps its controls. A Shops-only wrapped toolbar and ResizeObserver measurement keep its module tabs and page actions below the header, including after native sorting/SPA navigation. The observer is disconnected before reinitialization to avoid retaining old SPA pages; it never invokes a service or changes a form. `shops.js?v=6` is requested by both screens; the new stylesheet is registered with `?v=1` in both ZenithApp blocks.

## Reproduce locally

Use the existing `docs/qa/shops-runtime` fixture/helper on a fresh disposable loopback runtime, with `stores.qa.disposable=true`. Never deploy QA helper screens. The verifier requires port 18085 and environment fixture credentials:

```
UI_REFERENCE_USERNAME=shops.qa
UI_REFERENCE_PASSWORD=<public-demo fixture password>
UI_REFERENCE_ADMIN_PASSWORD=<public-demo admin password>
UI_REFERENCE_CHROME=<installed Chromium executable>
UI_REFERENCE_OUT=<private local results directory>
node docs/qa/shops-reference/verify-runtime.cjs
python docs/qa/shops-reference/check-contract.py <reviewed-master-sha>
```

`UI_REFERENCE_SKIP_INIT=1` only repeats read-only checks within an already initialized disposable fixture. The verifier preserves screenshots/DOM locally; none is committed. Source contracts compare all actions, transitions and forms with the reviewed base, and verify that all existing Shops handlers remain byte-identical after excluding the isolated header measurement.

## Results and limits

53 browser checks passed across `/apps` and `/qapps`, at 390/768/1440px: visible native filters, actual applied server searches, empty CSV headers, tenant-scoped CSV rows, native sorting, retained page-size selection, column dialogs, New Store focus/required validation/Escape, all five detail tabs, reversible unsaved operating-hours toggles, mobile native filter/Find/close controls, New Store containment and module tabs below the wrapped header. No browser JavaScript exceptions occurred. No business-write form was submitted.

An independent SELECT-only JDBC probe fingerprinted all columns/rows in 21 business/financial tables before/after. Store/profile/hours/target/holiday/configuration, subscriptions/SaaS invoices/payments/audit/usage, issued invoices, payments and POS transaction/session tables are unchanged. Evidence contains hashes/counts only. All 983 candidate component files match runtime bytes. Named memory-runtime disposal closed both listeners; an independent IFEXISTS reconnect failed, proving no seeded database survives.

Native Windows/H2 evidence is not the pinned Linux/Postgres staging acceptance run. All four local guards pass. GitHub jobs cannot start until the repository account payments/spending restriction is resolved. Maintainer merge/deploy remains gated on successful repo-guards and current candidate-SHA acceptance. No production records were changed and no deployment was attempted.
