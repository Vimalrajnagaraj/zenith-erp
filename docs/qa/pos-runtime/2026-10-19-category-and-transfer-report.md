# POS category and Inventory transfer QA — 19 October 2026

## Source and scope

The only unfinished bug report in Vimal Raj's `POS [Round 2]` Drive folder was
`ZERP-POS-004-04`: new products had no category choice, so the POS category tabs
could not show newly assigned products. `Inventory [Round 2]` and `Sales [Round 2]`
contained no reports. The POS credit due-date/reminder feature request is already
implemented in PR #128; actual message delivery still needs a configured provider,
so that report remains open.

The code audit also found that stock transfers offered services in the product
picker and accepted them as transfer lines. A warehouse transfer requires a
physical product. The new guard applies both when adding a line and when shipping
an older draft line, so neither path can move a service through inventory.

## Candidate behavior

- Inventory → New Product offers active-organization categories. An assigned
  physical product appears in its POS category tab and in All Items. A forged
  category from another organization is rejected before product creation.
- POS category-filtered grids exclude services and digital products, matching
  the existing All Items physical-product filter.
- Stock Transfer's picker offers physical products only. The service validates
  this independently of the picker on add and ship. The Received column uses
  the current row's transit state when displaying a pending full receipt.

## Verification

All tests below used synthetic organizations and products in a disposable native
Moqui runtime on loopback with an in-memory H2 database. No production writes
were made.

| Check | Result |
| --- | --- |
| Full POS runtime regression (`verify-runtime.cjs`) | 806 checks passed, 0 failures; 56 screen renders, 100 responsive layouts, 0 browser console errors |
| Category flow (`verify-product-category.cjs`) | Passed: tenant-scoped options, forged-category rejection, saved membership, physical-only category grid, All Items restoration |
| Native stock transfer (`verify-native.cjs`) | Passed: physical-only picker, service/foreign-product rejection, ship/receive balances, repeated-action safety |
| XML parse and JavaScript syntax | Passed for changed XML and test scripts |
| CSS comment, cross-module transition, form DOM, party-picker guards | Passed |
| `git diff --check` | Passed |

The full POS suite ran after the POS/category changes and before the final stock
service guard; both focused tests ran with the combined candidate. The existing
Docker/PostgreSQL stock-transfer regression could not run locally because Docker
Desktop was unavailable. Its fixtures and assertions were updated for the service
case, and the native H2 test exercised the affected workflow end to end. Hardware
printing, payment devices, and external messaging delivery were outside this
local test.

## Remaining dependency

PR #128's per-customer credit terms and reminder outbox await a configured
SMS/WhatsApp/email delivery provider. Do not mark that Drive feature request
complete until messages can actually be delivered and verified.
