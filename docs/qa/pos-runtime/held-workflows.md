# Held bill mode and explicit session close

Hypothesis: recall redirects inherited the currently displayed bill's mode and tax parameters. Terminal rendering interpreted those parameters as a mode change and repriced the recalled bill. A disposable Retail → hold → Wholesale payment → recall reproduced a Retail bill changing from 100 tax-off to Wholesale 90 plus tax. The existing recall service already preserved the original transaction and line prices; the redirect and browser context were the fault.

The recall transition now redirects with the recalled transaction's mode and tax setting. Both visible recall paths use native POST/navigation so customer, mode, pricing grid, payment controls and tax switch initialize together. This replaces partial HTML reconciliation that retained the newer bill's client-side mode.

Manual session close now voids unpaid held transactions and held snapshots in the same transaction as cash reconciliation. Numbered or partially paid drafts remain blocked. Completed bills, tenders, stock and invoices are preserved. Idle-session and automatic reopening policies are unchanged. The close transition catches service rejection, retains rollback/error state and returns JSON instead of an empty response.

Both the closing popup and native POST fallback return to Terminal's Open Session screen. Keeping the closed session ID in that destination skips the generic automatic lookup of another open counter. Returning does not create a new session or cart. A separate before-fix browser check reproduced the wrong PosSessions destination.

The before-fix close regression returned HTTP 200 with an empty body while an unpaid held bill blocked closing. Regression coverage exercises the actual Hold Bills, customer picker and close popup, all three standard pricing modes, tax-off preservation, explicit shop minimum/customer policies, a zero minimum, repeated close, completed bill preservation, paid-held rejection and cross-tenant access. The tests use a dedicated synthetic counter in a disposable runtime. No production rule or customer record is changed.

Shop order requirements remain opt-in. An explicitly configured minimum is enforced; zero removes that minimum. The regression completes a Wholesale sale for 90 with the shop minimum set to zero. This change does not silently erase stored shop policies.

Run through the full POS staging profile (`docs/qa/pos-runtime/verify-runtime.cjs`), which invokes `verify-held-workflows.cjs`. Runtime evidence includes recalled-retail and close-with-held-bill screenshots.
