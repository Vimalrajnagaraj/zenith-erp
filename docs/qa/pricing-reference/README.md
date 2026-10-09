# Pricing reference UI

Compare the Pricing pages against the approved Drive reports and fixed images under
https://drive.google.com/drive/folders/1Qr6EhJzvsu6uzDpJlshp2UYwcDBU9K44.
Keep existing matching detail tabs and create fields, actual currencies and native write forms.
The reference's example records, fake Import Prices control and mismatched active navigation are not application data or working features.

The remaining changes are scoped CSS, dashboard layout classes and removal of the three lists' page-only toolbar opt-in. Native server filters, column controls, exports and pagination remain available. Hover transforms are disabled on those cards because they make nested fixed filter dialogs move under the pointer. Native Bootstrap dialogs fit mobile widths.

`ui-proof.cjs` runs inside the Price List native verifier's guarded synthetic fixture lifecycle; it is not a production script. Run the existing dashboard, Price List, Pricing Rule and History verifiers on an exact-source, disposable loopback memory runtime. Both `/apps` and `/qapps` must render at desktop, tablet and mobile widths. Exercise native Find submits, CSV routes, create open/cancel and detail tabs. Compare independent outside-invoice fingerprints and purge captured synthetic keys before stopping the runtime. A SPA shell 200 alone is not acceptance.

This UI follow-up is stacked on #39. It does not change service/entity/JavaScript code, executable screen actions, tenant queries, row actions or native forms. Rebase and reverify the combined source after the parent merges. Required GitHub checks and the parent's owner MARUTHI before/after acceptance remain deployment gates; local H2 checks do not replace Linux/PostgreSQL acceptance. No merge or deployment is performed by this work.
