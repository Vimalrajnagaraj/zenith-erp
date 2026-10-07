# Disposable POS regression verification

This suite runs only against a loopback, disposable runtime. Never install the QA
screen or fixtures on production. Live MARUTHI inspection is read-only and does
not establish that an un-deployed candidate is running there.

The two `POS_QA_*` organizations, products, prices and three users are synthetic
test fixtures. They have no legal registration numbers, real contact details,
provider credentials or production data. The bootstrap password is the public
Moqui demo password, copied from the disposable runtime's demo user. The screen
requires `-Dpos.qa.disposable=true`; its initializer requires platform ADMIN and
refuses to reinitialize an existing fixture. Only the three synthetic users can
invoke its fixed service/parameter allowlist. Do not expose this runtime publicly.

`staging-acceptance` selects this profile for POS PRs. It overlays the candidate
components on the checksum-pinned clean staging image, runs the existing four
billing goldens unchanged, then this suite. A dispatch can select `pos` with an
exact candidate SHA. The fixture/helper paths exist only in the disposable runtime.

Native testing uses an in-memory H2 database with a loopback, SELECT-only probe.
CI uses the staging compose tmpfs PostgreSQL database. Evidence consists of
`report.json`, synthetic screenshots/PDFs, and a separate teardown proof after
the staging stack and its volumes are removed. No test report is a production
deployment claim. Never reuse a database containing customer records.

## Regressions covered

- Reject empty checkout/credit, nonpositive quantities, negative price/discount,
  invalid tenders, zero non-free tender and non-cash overpayment before writing.
  Permit a legitimate zero-payable item without manufacturing a payment row.
- Reconcile cash change, split payments, actual gift-card redemption, partial/full credit, drawer cash entries,
  float-in/out and bank deposits; safe-count is an observation. Late cash credit collections
  belong to the receiving drawer. Payment Wise page/CSV/PDF subtract change once
  and count distinct bills for each method, retaining the billing-date filter contract.
- Preserve recorded partial tenders and held carts at session boundaries.
- Preserve held sale identity, customer, manual price, line mode and tax toggle.
- Calculate customer place-of-supply GST without repricing the cart; clearing the
  customer restores the terminal region. Assert invoice header totals and GST.
- Independent, idempotent offline imports, partial acknowledgements, rollback of
  invalid items/money, and preservation of the interactive cart. Browser checks retain
  unacknowledged queue entries after partial/legacy/failed responses, check GST cache
  and receipt markup, and preserve invalid-quantity lines. A differing
  historical offline total stays unacknowledged for review; no cash is invented.
- Concurrent completion numbers and synthetic-only amendment validation, linked
  invoice totals, tax detail and audit. No production issued bill is amended.
- Tenant service/detail/receipt denial, CSRF, cashier permissions, child report
  rendering, one search-add POST, active till layouts and both app shells. Normal
  and Advanced layouts retain cart height, contain wrapped headers and scroll
  to both the cart and payment controls at five widths; the fullscreen icon uses SVG.

Render checks do not certify every business operation in a screen. Physical QZ
printers, scales, handheld scanners, external payment providers and Safari dark
mode need owner/device verification. Browser PDF output is not a hardware test.
The [coverage register](coverage.md) retains duplicate SOP ids with their titles;
unverified steps are not recorded as passes.

## Owner deployment handoff

Merge and deployment are separate. Only Amal deploys, following
[`SOP-commit-and-deploy.md`](../../SOP-commit-and-deploy.md). This candidate depends
on latest master `9ca9a96`, including `9ed3612`'s tax-inclusive Sales invoice contract. Deploy the reviewed,
complete component tree in one maintenance operation and restart Moqui so the new
POS access/services and their callers become available together. Do not copy a
child screen or JavaScript ahead of its service dependency.

One nullable column, `pos_payment.collection_session_id`, and its optional
session relationship are added. Before exposing the new services, the owner must
apply/verify this entity change using the repository's Moqui schema-update process
while POS is quiescent. Do not deploy service callers against an old schema.
Existing payment rows remain null and are interpreted as legacy original-session
tenders; no historical payments are rewritten or guessed into a new drawer.
Do not deploy `docs/qa/pos-runtime`.

Before deploying the offline change, preserve any pending legacy
`ZenithPosOffline` IndexedDB queue on each till. New queues/catalogs are stored in
an organization-specific database. Legacy data is deliberately retained and is
not automatically assigned to whoever next logs in; owner-assisted review/import
must confirm its original terminal, session and collected total. Failed imports
remain on the device. Validate each till's pending queue before closing its shift.

After deployment, use a disposable organization for write acceptance, verify
both shells and direct PDF permissions, and have the owner validate actual till
hardware. PR checks passing do not automatically deploy or replace this step.
