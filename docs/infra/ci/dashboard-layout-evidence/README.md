# Dashboard preference regression: wait for the workflow result

The existing Puppeteer check unconditionally waited for document navigation after Save/Reset. Quasar can refresh the subscreen instead, so CI timed out even when the preference saved. The extracted helper verifies the actual POST path/status, resulting KPI visibility, persistence after refresh, Reset and persisted defaults. No assertion is removed and no server/app behavior is mocked. It supports both document navigation and SPA refresh.

The helper passed Save/persist/Reset on both `/apps` and `/qapps` using real Chrome against disposable native Moqui/H2 with the existing synthetic POS owner. The same helper is imported by the full staging account regression. Remaining account, theme and Remember Me checks are unchanged. In-memory database discarded, zero records retained; no production connection or deployment. Local JavaScript syntax, whitespace and all four guards passed.
