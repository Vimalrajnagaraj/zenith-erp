# Barcode reference UI

Compare Barcode against the approved reports and fixed images in
https://drive.google.com/drive/folders/1Qr6EhJzvsu6uzDpJlshp2UYwcDBU9K44.
Retain matching dashboard statistics, working actions, dialogs and native fields. Do not copy example products, values or fabricated label previews.

The scoped reference stylesheet connects the existing Yes/No controls, aligns the real Edit action and bounds spacing on mobile. The dashboard export card names its actual Product Barcodes/CSV destination rather than implying a separate report screen. Service/entity/JavaScript code, executable actions, queries and native forms match the functional parent #43.

`reference-ui.cjs` executes within `verify.cjs` after the comprehensive native checks and before the independent accounting no-op and captured-key cleanup. Use only the named loopback memory runtime with its disposable flag and synthetic fixtures. Verify both ERP interfaces, decoded barcode pixels (including leading zeroes), actual native handlers, tenant/role/CSRF denial, responsive bounds and unchanged billing/stock/payment fingerprints. Open and cancel preview dialogs; never print, create or toggle real production records for UI verification.

This follow-up is stacked on #43. Rebase and reverify after the parent merges. Owner scanner/printer and MARUTHI acceptance plus required GitHub checks remain gates; local public-runtime H2 verification is not pinned Linux/PostgreSQL or hardware acceptance. The maintainer handles merge and deployment order.
