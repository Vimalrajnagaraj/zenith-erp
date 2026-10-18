# POS-01-07 (provisional): stable transaction Columns dialog

The report filename uses POS-02, while its internal bug ID is POS-01-07 (provisional). Current master reproduced the dialog jumping when the pointer entered the transaction list card: the native modal sits inside the card and its hover transform changes the containing block for a fixed dialog.

Disable transforms only on list cards, keeping other card styles. No transaction, query, organization scope or payment behavior changes. Bump the shared theme asset version so browsers receive the fix.

Disposable native Moqui/H2 with real Chrome: **17 targeted checks passed**, zero failures. Both `/apps` and `/qapps` retained identical viewport-fixed dialog bounds across eight pointer positions, accepted keyboard Save, reset columns successfully and kept headers readable. No browser errors. The database was discarded and its port closed; zero test records remain. The full staging profile calls the same regression.

The screenshots show the real native dialogs with synthetic data. `report.json` and `teardown.json` record verification. No production connection or deployment was used.
