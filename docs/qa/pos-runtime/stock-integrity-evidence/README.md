# POS stock and wastage verification

Reports: POS-11-06-BUG-01, POS-11-05-BUG-02, POS-11-03-01.

The native Moqui runtime used a fresh, loopback-only H2 memory database and the repository's synthetic POS fixtures. `report.json` records **875 passed checks, 0 failures, 56 page renders, 100 viewport checks, and 0 JavaScript exceptions**. `teardown.json` confirms that the runtime was stopped, its database discarded, and no seeded records remain. Production was not accessed.

The targeted checks exercise real HTTP/service calls and independently query the database: positive/fractional/exact/excess/invalid wastage; canonical product identity; selected-shop and batch isolation; duplicate requests; concurrent write-offs; actual expired-stock buttons on both surfaces; empty and stale carts; cumulative quantity edits; concurrent tills; payment rollback on rejected checkout; immediate stock posting for cash and credit; idempotent invoice sync; and the facility's explicit negative-stock policy. Existing tax, payments, bill amendments, receipts, session reconciliation, and export goldens also pass.

New checkout posts stock atomically and stamps `stockPosted`. Invoice sync retains the legacy path only for older completed, unsynced sales; no issued invoice or historical wastage is rewritten. Untracked products retain their existing behavior. Posted wastage cannot be silently deleted.

The stock helper explicitly updates locked balances and writes AssetDetail movements. It suppresses the generic nested entity callback during that detail write, because Mantle otherwise recalculates historical balances and creates "found" stock for negatives regardless of the configured facility policy. Service accounting hooks remain enabled, and the entity callback flag is restored in `finally`.

Screenshots contain synthetic QA data only. The local runtime's connectivity banner is environment status, not a production screenshot.

Run through `docs/qa/pos-runtime/verify-runtime.cjs`; targeted modules are `verify-stock-limits.cjs` and `verify-wastage.cjs`. The standard CI staging acceptance job installs fixtures only in its disposable runtime.
