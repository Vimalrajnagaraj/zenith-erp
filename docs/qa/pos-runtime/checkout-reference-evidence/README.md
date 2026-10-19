# Checkout reference verification

The screenshots and `focused-report.json` were captured from the working terminal
in disposable native Moqui/H2 with real Chrome and synthetic `POS_QA_` fixtures.
They are browser captures of persisted application state, not static mockups.

The focused run passed **71 checks, zero failures and zero JavaScript exceptions**
against application/test commit `85f3fddb1315b8e2c7147172a8e0fe7c5930578b`.
It covers GST on/off, decimal rate and quantity updates, nested trash-icon clicks,
search, payment/credit/split/customer dialogs, tenant and CSRF denial, unpaid-cart
clearing with queued edits, protection of paid/issued bills, hold/recall/void,
cash-review shortcuts, and six screen widths. It explicitly reloads a saved draft
and verifies that its initial quantity/trash controls match the interactive cart
and that its first typed quantity change persists.

The complete native combined run before the final resumed-markup refinement
passed 1,070 checks, 56 page renders, 100 viewport checks and zero JavaScript
exceptions, including the real idle scheduler plus the stock/credit/idle PRs.
The final PR staging run repeats the complete POS profile on the final commit;
its run link and exact counts are recorded in the PR description.

To reproduce, provision the disposable POS profile described in
`docs/qa/pos-runtime/README.md`, then run `verify-runtime.cjs`. The reference helper
is called by that suite; it requires the supplied fixture/actor/database helpers
and is not a standalone production script.

Both navigation shells enter the canonical `/apps/zenith/pos/Terminal` billing
screen. Physical printers, scanners/scales and external payment devices still
need testing with the configured hardware. No live tenant or message-delivery
provider was used. Deploy the complete component tree and restart together; do
not copy the new screen ahead of its checkout services.
