# Cash Entry and session-close evidence

These screenshots are from the disposable native Moqui/H2 POS QA runtime on
19 October 2026. All names, terminals, sessions, and cash movements are
synthetic fixture data. No production environment was accessed.

- `cash-entry-desktop.png`: `/apps` Cash Entry at 1366 px, including the filter
  actions aligned with the fields and the native Cash In/Out forms.
- `cash-entry-mobile.png`: `/qapps` Cash Entry at 390 px, including the date
  controls and footer after the form.
- `auto-closed-sessions.png`: `/apps` Sessions after the real anonymous idle
  sweep, showing auto-closed sessions with cash not counted and reviewed.

Verification: `POS_QA_REAL_SCHEDULER=true` with
`docs/qa/pos-runtime/verify-runtime.cjs` passed 872 checks, 56 page renders,
100 responsive layouts, and no failures. The disposable database was discarded
after the run.
