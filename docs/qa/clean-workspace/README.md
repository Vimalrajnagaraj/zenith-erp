# Clean workspace migration verification

Native application candidate: `e1b21333aa1152cfc12e9dd362be59bfc655d459`.
All data in this verification is synthetic. No live database, customer catalog,
old test-account export or private credential is an input or a committed artifact.

## Results

- **13 conversion unit tests passed** using standard-library SQLite temporary
  files, including unchanged source checksums, selected-company pricing,
  duplicate IDs/codes, missing/zero/negative prices, unit and GST/VAT review,
  explicit exclusions and exclusion of historical transaction/credential tables.
- **67 real service/database/browser checks passed** on loopback Moqui with a new
  in-memory H2 database. Independent JDBC reads establish persisted state.
- A **1,212-product** multipart import commits all 1,212 products and **2,424 mode
  prices**, without overwriting the same source SKUs in a different workspace.
  The exact local elapsed time is recorded in `native-proof.json`; it is not a
  production performance or cross-browser benchmark.
- All three new logins reach POS. Two shops/three counters/three tenant users,
  no platform role assigned to them, editable retail/wholesale columns,
  new-cart mode switching, Auto reset, GST on/off and non-expiring manual access
  are verified. Existing financial rows and shared mode definitions are unchanged.
- Both **/apps and /qapps** execute real preview uploads and reject an incorrect
  apply digest without returning submitted passwords. GET cannot execute either
  operation. Replay cannot provision a second workspace. A tenant administrator
  cannot provision or grant permanent access.
- A second barcode alias conflict occurs after provisioning and partial catalog
  writes. The whole transaction rolls back, including accounts, party records,
  shops, counters, preferences, modes, products, aliases and subscriptions.
- A foreign permanent-access marker fails closed. Restoring the exact active
  subscription marker restores access, and the manual-expiry job leaves it active.

## Fail-before regressions

`docs/qa/pos-runtime/check-owned-default.groovy` executes the actual mode script.
The master definition incorrectly retains the shared Retail default after an
organization explicitly replaces it. It fails the owned-default assertion; the
candidate passes it and preserves the unrelated-tenant fallback.

The original `Terminal/setItemMode` Auto reset hard-codes shared `RETAIL`.
After the imported line switches to its own Wholesale mode, Auto leaves it at
90 with its manual lock. The candidate resolves the counter's available default,
returns the line to Retail 100 and clears the lock. The same real endpoint then
calculates GST 12 when enabled and zero when disabled.

The initial undated grant reached the shell's Account Suspended page. The
explicit tenant/subscription-bound permanent marker fixes this without making
ordinary missing-date grants valid. Large URL-encoded catalog forms exceeded
the server's form-content limit; bounded file uploads handle the full catalog
without globally raising that limit. Private parameters are scrubbed in
`finally`, including service-error returns that bypass XML actions after a
service-call.

## Cleanup and execution limits

The owned JVM was stopped and both loopback listeners were confirmed absent;
its entire in-memory database was destroyed. `native-proof.json` records this.
Raw logs, generated passwords and detailed local responses remain outside Git.
The screenshot is a newly opened, empty operator form with no filled credentials.

The full POS profile invokes the new acceptance helper in staging. GitHub run
results are linked in the PR separately; this native result does not substitute
for Linux/PostgreSQL CI or production owner acceptance. No merge, deployment,
live reset or real-account import was performed. The runbook requires reviewed
private identities, source mappings, legal receipt/tax details and opening
stock/balance reconciliation before trading.

`npm run test` and `npm run build` were attempted and returned ENOENT because the
Moqui repository has no root `package.json`. All four repository guards passed.
