# ZERP-POS-003-05 (suggested): idle session after logout

The reported gap was reproduced on an isolated organization with no billing-config row: the old sweep closed opted-in sessions but excluded new sessions without the hidden opt-in. `before-fix.json` captures that failure. A successful direct close while signed in was insufficient evidence.

New sessions now store a one-hour automatic-close policy by default when the organization has no explicit override. Explicit opt-outs remain respected, and older sessions without a stored policy remain unchanged unless a manager enables the organization policy. Managers can see and change the policy on Sessions; bill-number settings are preserved. The same worker identity is retained, registered if missing, and its old five-minute cadence is upgraded to one minute without overriding an explicit pause or custom schedule. The UI exposes a disabled/paused scheduler.

The idle close locks transactions before the session, matching checkout order, rechecks activity under the lock, and runs each closure in its own transaction. A sale finishing at the idle boundary is retained exactly once and keeps its active session open. Held/unfinished tenders and cash-refund review exceptions remain protected. Completed money and legal numbers are never rewritten; drawer counts remain unverified until reviewed.

Native verification: **847 passed checks, 0 failures; 56 page renders; 100 viewport checks; 0 JavaScript exceptions**. This run enabled the real scheduler in a fresh disposable Moqui/H2 runtime. The test backdated only synthetic activity, logged out an isolated browser context, and waited for an actual ServiceJobRun to close the sold session without calling a browser close endpoint. Both UI surfaces expose the resulting unverified-close status. `report.json` includes independent database assertions.

The ordinary CI runtime disables global scheduled execution. CI still tests anonymous sweep behavior, default/explicit policies, manager controls, checkout-boundary concurrency and all financial/UI regressions. The extra real-timer case is enabled with `POS_QA_REAL_SCHEDULER=true` in a runtime started with scheduled job checks enabled. Its wait includes Moqui's two-minute scheduler startup grace.

The full suite was followed by removal of an unnecessary sweep-result cap so old review-required sessions cannot starve later eligible sessions. Staging acceptance validates the final candidate.

The memory database was discarded and its port closed; `teardown.json` records zero fixture residue. Screenshots and IDs are synthetic only. No production access or deployment occurred.
