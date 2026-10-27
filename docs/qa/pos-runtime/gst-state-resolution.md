# POS GST state resolution

## Defect and scope

The terminal editor saves the numeric GST `stateCode`. Cart creation and offline
catalog export previously preferred `regionGeoId`, even when it was an obsolete,
non-GST geographic identifier. The toggle then preferred the same invalid value
already inherited by the cart, so adding a `stateCode` fallback did not help.

An authenticated live UI reproduction confirmed the warning on an unpaid walk-in
cart despite the visible terminal GST state being configured and present in the
state picker. The live legacy field is not exposed by that editor; no live database
dump or customer data is included here. The precise stored live values require
the maintainer's read-only verification at deployment.

## Correction

- New carts and offline catalogs prefer the terminal's editable GST state.
- An open cart can repair an invalid origin inherited from that same terminal's
  legacy region field. An inherited local destination follows the repaired origin.
- An explicit different destination is preserved. Invalid destinations still fail
  validation before tax or cart-state writes. Completed bills are untouched.
- Existing organization and POS access checks remain in place. No default state,
  buyer GSTIN, tax rate, shop policy or production configuration is introduced.

## Reproduction and regression

`verify-gst-state-resolution.cjs` runs through the existing disposable POS suite.
Its synthetic terminal has `stateCode=33` and `regionGeoId=LEGACY_GEO_TN`.
Unchanged master `af982bf5` fails the first database assertion: both new cart states
contain `LEGACY_GEO_TN` instead of `33`. The candidate must pass that exact case.

Additional checks cover offline catalog tax, walk-in CGST/SGST, tax off, repair of
an old inherited cart, explicit interstate IGST, preservation of an interstate
destination during repair, and atomic rejection of an invalid destination. Both
entry shells render the tax-enabled terminal; `/qapps` uses its native POS handoff.
Fixtures and the legacy-state helper require the loopback disposable runtime.

Run the existing POS profile in `staging-acceptance.yml` for PostgreSQL acceptance.
Local verification uses the isolated in-memory H2 adapter with SELECT-only probes.
Stopping that owned process removes its database; never install the QA screen or
fixtures on a live server. `npm run test` and `npm run build` are unavailable in
this Moqui repository because it has no root `package.json`; use runtime acceptance
and the repository guards rather than treating those ENOENT results as passes.

## Deploy gate

This is a billing-state change. Before deployment, the maintainer must compare the
affected terminal's configured state/legacy region and the open cart's origin and
destination. Confirm the stored invalid origin is inherited from that terminal,
verify the intended GST state, deploy the complete reviewed component tree, and
recheck GST without modifying any issued bill. A merged PR or synthetic pass is
not a claim that the fix has been deployed or that live GST now works.
