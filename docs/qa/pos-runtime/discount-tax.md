# POS billing: discounted GST regression

## Reproduction and root cause

On master `0dbd7a7f`, add one synthetic product at 100 before 18% GST and
another at 200 before 5% GST. Apply a 10% whole-bill discount through the
billing dialog. The bill and line tax amounts become 25.20, but
`TaxLineDetail` still contains 28.00 against taxable bases 100 and 200.
The new browser/database regression fails on that mismatch before the fix.

`Terminal/ajaxCart` previously scaled each saved tax ratio without replacing
the persisted breakdowns. It also treated inclusive prices as exclusive.
It now saves the allocated discounts and reuses `refresh#PosTransactionTax`
to calculate line amounts, breakdowns and totals together. Failed discounts
roll back atomically. Tax-off refresh skips tax calculation and clears details.
Existing access checks, discount limits, manager PIN checks and free-item
approval remain in place. No issued records are migrated or rewritten.

## Automated check

`verify-discount-tax.cjs` runs in the disposable POS profile registered by
`verify-runtime.cjs`. It uses actual billing transitions and independent
database reads, with synthetic organizations, customers, products and counters.

| Case | Expected result |
| --- | --- |
| Browser discount dialog, mixed 18% and 5% GST | Taxable bases 90 and 180; CGST/SGST 8.10, 8.10, 4.50, 4.50; bill tax 25.20 |
| Reapply; `/qapps` transition | Four replacement detail rows; no duplicate or compound discount |
| Remove discount | Original 28.00 tax restored |
| 100% discount | Draft tax and payable zero; no phantom GST amount |
| Card checkout, receipt, linked invoice | All saved tax totals remain 25.20 |
| Discount an issued bill through draft endpoint | Rejected; issued records unchanged |
| Interstate customer selected on empty cart | IGST 16.20 on discounted taxable amount 90 |
| Two units at a manual decimal rate 75.50, fixed discount 10 | Taxable amount 141; GST 25.38 |
| Inclusive mode at gross 118, 10% discount | Taxable 90, GST 16.20, gross 106.20; stored mode unchanged |
| Tax off, including invalid GST destination | Zero GST and no tax detail rows; no GST state requirement |
| Tax on with invalid destination | Useful failure; discount, lines and totals fully rolled back |
| Foreign organization; missing CSRF token | Rejected before modifying the bill |

## Billing audit boundaries

The accompanying local audit exercised only billing workflows: cart entry and
edits, scanner/search, keyboard actions, payment confirmation/cancellation,
cash change, split tender, credit checkout, holds, recall, session close from
billing, stock limits, tenant boundaries, next-bill races, offline replay,
receipt generation and Normal/Advanced layouts. Selected browser journeys
passed in installed Chrome and Edge and Playwright WebKit on Windows.
WebKit is not a claim of testing a physical Safari device.

All new data was confined to a fresh loopback, in-memory database. No real
shop/account data was used or changed. Printing used a test adapter; actual
thermal printer output and payment-provider settlement remain unverified.
The fixture receipt PDF was rendered and visually inspected. No root
`package.json` exists, so npm test/build are unavailable; verification uses
the repository's Moqui runtime, XML/JS checks and repository guards.

The separately reported legacy terminal GST-state bug remains covered by
unmerged PR #154. This discount PR neither includes nor deploys that change.
