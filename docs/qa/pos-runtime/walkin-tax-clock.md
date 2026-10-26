# Walk-in tax bills and live clock

The failing disposable-runtime regression created a counter through the existing terminal settings form with stateCode=33 and no regionGeoId. Its new walk-in cart had null origin and destination states, and GST could not be enabled. Billing now uses that saved state as a fallback in cart creation, tax switching and offline catalog tax estimates. Explicit supply states, IndiaState validation and tenant access checks remain in place. Buyer GSTIN remains empty for unregistered customers; seller receipt configuration is unchanged.

The clock was frozen at page rendering. A display-only clock uses the server epoch and signed-in timezone, with one timer per page. It updates the date across midnight and accounts for elapsed time when returning to the tab. It makes no requests and does not count as cashier activity.

Local verification: 9 disposable-runtime checks passed, including live ticking, state-only terminal, walk-in CGST/SGST, tax off, named unregistered customer, both Card and UPI completion, and receipt tax totals. The regression failed before the state fallback; the clock regression failed before the updater. The standalone clock test passed timezone, midnight, elapsed time and duplicate initialization assertions. All four repository guards passed. The temporary JVM was stopped and its in-memory database destroyed; no production data was accessed.

Run `node docs/qa/pos-runtime/check-clock.cjs` for the clock unit check. The full POS staging suite invokes `verify-walkin-tax-clock.cjs` with isolated fixtures.
