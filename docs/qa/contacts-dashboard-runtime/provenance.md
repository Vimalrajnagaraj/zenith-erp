# PR #12 exact-image runtime provenance

Verified on 6 October 2026 using the owner's sanitized image archive, with a separate local runtime on `http://localhost:8081`. The existing PR #14 runtime on port 8080 was preserved.

## Image identity

- Archive SHA-256: `2da7d916054bf4fccf9c6d32e97b2b2afa0d9ae3531d2a004a4bd87dcf59b18c`.
- Loaded image: `zetaerp-moqui:local`, `linux/amd64`.
- Image ID: `sha256:5f0314d4183aa6a819c993a0eed8014bd513bd9be1317e366c11a1b1c02b9fe5`.
- Framework: `/opt/moqui/WEB-INF/lib/moqui-framework-4.0.0.jar`.
- Framework MD5 before and after all overlays/restarts: `df7e767ac4dbefdb4aac35fbccb86192`, matching the documented production framework MD5.
- Framework SHA-256: `47c2b9cd86b005437abb75dbfd2d5027c00687ead4c5f7b0c9577b340f9e2e3d`.

## Declared local overlays

The exact framework jar was retained. The runtime used a fresh local Postgres 15 database, a 1 GiB heap, and a local configuration copy with generated HTTP links on port 8081 while the container listener remains 8080. OpenSearch was omitted. No production data, credentials, password changes, or authentication weakening were used.

The five final Contacts UI application files were copied from the PR #12 worktree and match the running container byte for byte:

| Application path | SHA-256 |
| --- | --- |
| component/zenith-erp-app/screen/zenith/ZenithApp.xml | `359d9b302024453109b3c384daccd0387185a811c2f926eab687a8cc620b821c` |
| component/zenith-erp-app/screen/zenithstatic/css/contacts-dashboard.css | `7f2018cb13bb8fd244a903c27b43e9d83c14fe4e6022f2d54f977bd57774ba8c` |
| component/zenith-erp-contacts/screen/zenith/contacts/Contacts/ContactsDashboard.xml | `c4ee38ddd1f22878b10004075f6daf52c28632bea1506a3d468e5520c9a7c612` |
| component/zenith-erp-app/screen/zenithstatic/css/zenith-theme-v4.css | `741a3d0c2bdc7576c99dbf34b093ec4a1b14ae146f3e5249241d064c45e9794a` |
| component/zenith-erp-app/screen/zenithstatic/js/qapps-nav.js | `8b5720e3ecc7c3bb1e1c10dc71e2e3f81219c2c784d011b8385d5e58dfc2d8ce` |

The final theme/nav overlays include the Contacts-only measured header height and responsive toolbar layout, reusing the existing PR #14 fix; cache versions are theme `254` and nav `22`. Header styles are gated by active Contacts navigation, and the measured-height variable is removed outside Contacts. Parent browser acceptance is recorded in the separate QA report.

The imported image's active `runtime/base-component/webroot/screen/webroot/qapps.xml` incorrectly redirected resolved deep routes because `extraPathNameList` was empty. Only its bare-root predicate was overlaid from the already tracked master/PR #12 override:

```groovy
String reqPath = ec.web.request.requestURI
if (reqPath == '/qapps' || reqPath == '/qapps/' || reqPath == '/') { sri.sendRedirectAndStopRender('/qapps/zenith/Dashboard'); return }
```

That predicate was introduced in existing commit `ead5af162670dfafe5a4e84b152aa0e61bd95487`, at `component/zenith-erp-saas/framework-overrides/webroot/screen/webroot/qapps.xml`. It is unchanged between current master and original PR #12 head `4d8faf4e0a938eb8c123c125311a8f3d9bf35137`. The repository was not edited for this environment correction; the supplied original and a minimal diff are preserved in [qapps-local-existing-master-guard.diff](qapps-local-existing-master-guard.diff). The imported authentication guard, scripts and template were retained.

- Imported active qapps SHA-256: `5bc28a02ca2dc1c39e7febc2a031dd79018e7b8e4d38f9d04fe7a9f2c954f466`.
- Local active qapps SHA-256: `1a180778126c6d2a4c9551e89d60e7c1185373fff7ddc55d8661e273be2cce6f`.
- `docs/infra/deploy/Dockerfile` line 17 copies the tracked component override into `runtime/component`, but has no step activating this qapps override into `runtime/base-component`. Its other explicit framework patches do not fix that predicate. Current master `fc38f48` separately adds the existing qapps override to the staging acceptance workflow; this does not change the five tested application files or retroactively alter the imported archive. The image-versus-tracked comparison is in [qapps-image-versus-tracked.diff](qapps-image-versus-tracked.diff). A deployment owner should verify the active qapps guard when deploying; these results describe the image plus this declared existing-master overlay.

## Database setup and test outcome

The bundled seed command exited 0 and reported 7,950 loaded records, but skipped 37 files after errors. Skips included entity-definition XML registered as data and missing geography/status/demo foreign keys. This is a partial bundled demo load, not a full seed pass.

The existing synthetic Contacts fixture and local user fixture were then imported into the fresh verification database in one successful transaction: **52 records across 16 allowed tables**. The existing public demo user's password fields were preserved. All referenced dependencies needed by these fixtures were present. Org A initially had three contacts, one active customer, one supplier, one warehouse, ₹130 outstanding credit and ₹80 overdue; org B had a separate contact and ₹9,99,999 credit sentinel.

The final native HTTP/PostgreSQL suite passed **194 assertions, zero failed** on the warmed five-file version after the final header restart and actual browser writes. The final XML includes the Customize Close parameter correction (`showSettings=0`). It verified:

- Authenticated Apps HTML and native qapps shell plus its actual `/apps/zenith/Contacts/ContactsDashboard.qvt` content request, with an origin guard preventing redirects to the old port 8080 runtime.
- Both organizations and no-organization behavior; stat/credit/overdue totals against independent database queries; foreign-tenant labels and credit sentinel excluded.
- All five dashboard panels, documented SVG colors, empty states, actual date-preset links, custom/reversed/invalid date inputs, and prior-year contact growth.
- Active organization A restored through the native preference endpoint and confirmed in the database.

The parent browser checks created Person `100001` through qapps at 390 px, edited its last name to `Person Verified`, and created Company `100051` through Apps at 1440 px. Both persisted under org A with the Customer role. The post-write suite confirmed org A has five contacts and org B still has one. The parent also confirmed Customize Close, Save/Reset layout preference controls, and all eight shell/viewport combinations with no document overflow. See the separate browser QA report for that UI evidence.

See [checks-exact.json](checks-exact.json), [final-overlay-parity.json](final-overlay-parity.json), [fixture-import-result.json](fixture-import-result.json), and [qapps-guard-provenance.json](qapps-guard-provenance.json).

## Limits

The final five-file restart was slow under amd64 emulation on the ARM Mac: its first anonymous Login probe timed out at 120 seconds before application readiness. No authentication or organization changes ran in that failed attempt. Login later returned HTTP 200; the complete warmed suite then passed. The preserved startup-only result is [dashboard-exact-header-cold-start-timeout.json](dashboard-exact-header-cold-start-timeout.json). This local cold-start delay does not establish production performance.

The final startup/test log window had no dashboard render exception markers. It did contain omitted-OpenSearch retries, existing invalidated-login-session warnings, and a slow entity-cache read during startup; these are disclosed in [final-runtime-log-summary.json](final-runtime-log-summary.json). Therefore the entire runtime log is not claimed error-free.

This suite does not prove production deployment success, broad GST/demo integration, search indexing, or unrelated ERP behavior. Responsive browser and native create/edit persistence checks are recorded separately in the parent QA report. No production deployment or merge was performed.

## Disposal

After collecting evidence, the owned `zeta-contacts-prod12` containers, network and fresh database volume were removed, deleting all synthetic fixtures and browser-created contacts. The never-started image inspection container was also removed. The original port 8080 Moqui/PostgreSQL runtime remained running, and the supplied image/archive were retained.
