# Checkout confirmation regression found during POS-09-01-02 verification

Native cash/card/UPI forms have an inline confirmation handler, but the summary's capture-phase AJAX submit handler ran first and completed payment before the cashier confirmed. Gate the capture handler first; Confirm uses requestSubmit to return through the existing AJAX checkout once. Cancel sends no checkout. AJAX-rendered digital forms retain the same confirmation handler and actual payable amount.

Disposable native Moqui/H2 with real Chrome: **27 checks passed**, zero failures. Cash/Card/UPI open and Cancel write no payment; Confirm posts once and persists exact tender/change. Cash below the due amount is disabled. Product-click AJAX rebuilding retains Card confirmation and its payable amount. No browser exceptions. The test cart was voided, session reconciled, in-memory database discarded and port closed; zero test records remain.

All four repository guards, syntax and whitespace checks passed. The full PostgreSQL POS profile calls the same regression. No production connection or deployment was used. This change does not alter payment services, organization scope or issued records. Owner verification remains the production deployment gate.
