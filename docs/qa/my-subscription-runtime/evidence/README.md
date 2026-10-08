# Verification evidence

- `services-summary.json`: **100/100** actual Moqui/service/HTTP/database checks, including manual platform settlement, replay and negative ownership/CSRF cases.
- `browser-summary.json`: actual UI submissions with matching DB state, both surfaces' retry behavior, viewport measurements and known release gates.
- `apps-375.png`, `apps-768.png`, `apps-1440.png`: responsive Bootstrap screenshots.
- `qapps-375.png`, `qapps-768.png`, `qapps-1440.png`: responsive Quasar screenshots.
- `apps-375-dialog.png`, `qapps-375-dialog.png`: mobile confirmation dialogs.

All images contain explicitly synthetic data. The inherited staging theme is preserved; green/different shared chrome is not a new My Subscription style. Responsive measurements are actual `innerWidth`/`innerHeight`, not resized desktop screenshots. No full HTML, CSRF token, credentials, provider keys or customer records are attached.

Signed synthetic HMAC webhook success is **not** a real provider capture. The payment integration remains draft pending the test-mode provider path documented in the parent README. Standard candidate-SHA CI and cleanup status are recorded in the PR.
