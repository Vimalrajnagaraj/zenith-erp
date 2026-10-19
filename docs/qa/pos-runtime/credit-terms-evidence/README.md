# Credit repayment dates and customer terms

POS-10-05-FR-01 is implemented: each real payment retains its timestamp, method/reference, recorded-by identity and running balance. Last payment and final settlement dates are distinct from bill creation. Legacy payments without an actor are labelled honestly.

Customer credit days reuse the existing Contacts field. A customer may have two days, another thirty; checkout snapshots the term and an inclusive calendar due date in the issuing user's configured timezone. Changing customer defaults never redates issued bills. Manager overrides require a reason and retain an audit record. Cashiers cannot change customer defaults, issued due dates or reminder consent.

POS-10-05-FR-02's due dates, list statuses, consent/preferences and idempotent scheduled preparation are implemented. **Actual customer delivery remains blocked: no supported SMS/WhatsApp/email provider is configured in this codebase or supplied for this task.** The UI and outbox explicitly say "Awaiting provider" / no message sent. Nothing is reported delivered. Opt-out, settlement and cancellation stop pending reminders; partial repayments update the remaining amount. The combined Drive report must not be labelled fully Completed while this delivery dependency remains.

Verification used native Moqui, real Chrome and fresh disposable loopback H2 databases:

- Full regression run: **847 passed checks; 56 page renders; 100 viewport checks; no JavaScript exceptions** (`regression-report.json`).
- Final targeted verification after the audit/settings additions: **61 passed checks**, including actual Save buttons on both UI paths, narrow layouts, immutable date history, financial reconciliation, idempotent preparation, provider blocker, opt-out, tenant denial and cashier permission denial (`report.json`).
- Both databases discarded, no production access; final teardown is recorded in `teardown.json`.

The requested credit-period examples are test fixtures only. Screenshots contain synthetic QA data. The report includes deliberately overdue dates to exercise boundaries; no real bill dates, legal numbers or history were altered.
