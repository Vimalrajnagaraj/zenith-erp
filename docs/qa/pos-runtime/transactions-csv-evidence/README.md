# POS-10-03-01: Transactions CSV

Vimal Raj's export error was reproduced on current master. Standalone CSV skips the parent app's currency-helper setup, but the Transactions row actions called `zinr.inr(...)`. The helper itself was null; this was not evidence of a missing transaction amount. Initialize the existing formatter inside the child screen so both HTML and standalone exports have it. Restrict the visual page title to HTML/Quasar so the CSV starts with its actual column headers.

The query, filters and organization/shop scope remain unchanged. No payment, amount, bill number or transaction is rewritten.

Native disposable Moqui/H2 with real Chrome: **21 targeted checks passed**, zero failures. Both `/apps` and `/qapps` returned a correctly parsed CSV with the expected nine headers, quoted customer text, exact saved tax/payable, filtered results, a header-only empty result and organization-isolated rows. A ledger snapshot remained unchanged by the exports. The in-memory database was discarded and its port closed; zero test records remain. The same regression is called by the full PostgreSQL staging profile.

`actual-transactions.csv` is the real synthetic export. Its screenshot opens those returned bytes as plain text; it is not a redesigned application screen. `report.json` and `teardown.json` contain the local result. No production connection or deployment was used.
