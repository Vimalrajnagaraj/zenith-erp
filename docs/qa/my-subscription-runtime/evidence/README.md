# Verification evidence

- `services-summary.json`: **100/100** actual Moqui/service/HTTP/database checks, including manual platform settlement, replay and negative ownership/CSRF cases.
- `browser-summary.json`: actual UI submissions with matching DB state, both surfaces' retry behavior, viewport measurements and known release gates.
- `apps-375.jpg`, `apps-768.jpg`, `apps-1440.jpg`: responsive Bootstrap screenshots.
- `qapps-375.jpg`, `qapps-768.jpg`, `qapps-1440.jpg`: responsive Quasar screenshots.
- `apps-375-dialog.jpg`, `qapps-375-dialog.jpg`: mobile confirmation dialogs.
- `qapps-topbar-before.jpg`: reproduced incorrect framework test-mode header before the correction.
- `qapps-topbar-overlap-before.jpg`: reproduced mobile organization/utility collision before wrapping and height reservation.
- `header-summary.json`: live color comparison, corrected dev/test headers, responsive measurements and preserved controls.

All images contain explicitly synthetic data. My Subscription's light header now matches live white instead of the framework dev/test tint. Development/test mode remains enabled; the Bootstrap test-mode page background is still inherited. Responsive measurements are actual `innerWidth`/`innerHeight`, not resized desktop screenshots. No full HTML, CSRF token, credentials, provider keys or customer records are attached.

Signed synthetic HMAC webhook success is **not** a real provider capture. The payment integration remains draft pending the test-mode provider path documented in the parent README. Standard candidate-SHA CI and cleanup status are recorded in the PR.
