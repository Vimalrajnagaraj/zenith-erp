# All Contacts runtime verification

The final local integration of PR13's UI with PR14's tenant-safe filters, exports and Contacts header correction was checked on a fresh native Moqui runtime using the supplied framework JAR. The check reproduced one introduced keyboard defect: Enter opened the custom New Contact menu, but Escape left it open. The fix closes only the All Contacts menu, resets `aria-expanded` and returns focus to the trigger. The `cpe-tabs.js` cache version advances to 14.

`evidence/checks.json` records **145 passing checks, zero failures and zero browser page errors** after that fix. Four final screenshots show `/apps` and `/qapps` at 1366 × 900 and 390 × 844. Failed exploratory runs and raw DOM/log dumps are excluded.

## What was proved

- Both renderers at widths 1920, 1366, 1024, 768, 390, 360 and 320: no document/page-control overflow, contained table scrolling, one module menu, compact title and hidden Excel link. At 390, 360 and 320 pixels, the full visible header also stays in bounds, its regions do not overlap, and each visible control receives the actual topmost pointer hit. These mobile assertions were enabled for this run.
- Default 20 rows; changing page size from the last page resets index to zero and preserves search. Disabled and empty-result states render correctly.
- Select-all checks 20 visible rows; clearing one makes the header indeterminate. Selection sends no contact POST. All captured database records remain unchanged after the full run.
- The last row's action menu is visible and receives the actual topmost pointer hit; profile/edit URLs retain the captured contact ID. Enter/Escape and focus restoration work in both shells.
- Browser CSV downloads complete. The nine-column file contains exactly 24 active Tenant A rows (23 profile contacts and the foundation contact), with no disabled or Tenant B row. Downloaded files were removed after parsing.
- Add Person and Add Company dialogs fit mobile width. The actual escaped apostrophe/ampersand name appears literally in its checkbox's accessible name; long names retain their full title and truncate locally.
- Removing only All Contacts CSS rules in the browser leaves the separate Customers controls' computed styles unchanged.
- Seven source/runtime SHA-256 pairs match the final combined native overlay, including `qapps-nav.js`, `cpe-tabs.js`, both Contacts parent files, `FindContact.xml`, the theme and `ZenithApp.xml`.

This profile makes no persisted contact writes. PR14's hardened conditions, search skips and export behavior are present in the tested source; security-specific no-active-org, forged-owner and foreign-group assertions belong to the separate Contacts security profile. Both profiles must be run against the final staging source.

## CI fixture compatibility — 7 October 2026

The original CSV assertion expected 24 active Tenant A contacts. The current staging billing foundation also sets `CITEST_ORG_A.ownerPartyId=CITEST_ORG_A`, so that organization is a legitimate additional directory/export row. The [integrated UI run](https://github.com/amalnathkp13-boop/zenith-erp/actions/runs/37568109707) stopped at the stale assertion after 65 successful checks, with nine CSV columns and 25 data rows.

The portable profile now compares the complete sorted CSV ID list with an independent SELECT-only query of active Tenant A parties, on both PostgreSQL and native H2. Exact list equality rejects missing IDs, duplicates, disabled contacts and foreign-owner rows. This changes verification code only; directory/export behavior and foundation fixtures are unchanged. The 145-check report above remains historical evidence from its original fixture set. Current final-head CI results are linked in the dashboard PR.

## Runtime provenance and limits

The isolated native run used Java 21.0.12.1, Chrome 147.0.7727.56, H2 2.4.240 and Moqui 4.0.0. Framework MD5 **`df7e767ac4dbefdb4aac35fbccb86192`** matches the supplied production framework. The clean runtime's public assets, local loopback launcher and the known safe CI infrastructure overrides were used; the final combined PR13 + PR14 application source and keyboard fix were overlaid. HTTP and H2 were bound only to loopback on ports 18081 and 19093, with a 1GB maximum heap and external SMTP/search/signing disabled. No original Docker image, production environment, image history, private key or customer database was loaded.

This proves exact-framework compatibility and native UI behavior. **Linux/Docker/PostgreSQL acceptance is a separate final gate**: run this profile on the clean pinned staging image before treating the original image/runtime gate as discharged. The inherited Contacts header correction passed the new small-screen bounds, non-overlap and topmost-pointer checks on both shells. The screenshots show the resulting shared shell.

## Disposable fixture

Load the normal seed/demo data and CI staging foundation fixture first. This profile's `fixture.xml` adds 26 contacts through 78 entity records: 23 active and one disabled under `CITEST_ORG_A`, plus two under `CITEST_ORG_B`. IDs are `PR13QA_A_01` through `PR13QA_A_24` and `PR13QA_B_01`/`PR13QA_B_02`. Names are clearly synthetic and include Unicode, a long name, and an apostrophe/ampersand. No legal/tax, price, stock, credential or user-security values are included.

The profile leaves foundation organizations, demo login and `ACTIVE_ORGANIZATION=CITEST_ORG_A` intact. `verify-runtime.cjs` requires all 26 expected rows/owners and the exact disabled row before browser checks. Use only a new disposable database; never load this fixture into production or an existing tenant database.

## Run the portable profile

Install Playwright and Chromium in a disposable Node workspace, or provide an installed Chrome path. The script uses `require('playwright')` and has no host-specific paths or login password defaults. CI can install Playwright at the checkout root; Node resolves it from this nested script through its normal parent-directory lookup, without `NODE_PATH`. Linux browser launch uses the standard flags for an ephemeral runner. Keep outputs, local configuration, database files and credentials outside the repository.

| Environment variable | Meaning |
| --- | --- |
| `CONTACTS_QA_BASE_URL` | Isolated `http://127.0.0.1:8080` for Linux staging, or loopback port 18081 for native checks |
| `CONTACTS_QA_USERNAME`, `CONTACTS_QA_PASSWORD` | Disposable seeded login, supplied through the environment |
| `CONTACTS_QA_CHROME` | Optional Chrome executable; otherwise Playwright's installed Chromium |
| `CONTACTS_QA_OUTPUT_DIR` | External evidence folder |
| `CONTACTS_QA_DB_MODE` | `postgres` for staging Docker, or `native` for H2 |
| `CONTACTS_QA_DB_CONTAINER` | Disposable PostgreSQL container ID/name in postgres mode |
| `CONTACTS_QA_APP_CONTAINER` | Optional disposable staging app container ID/name, for source/runtime SHA comparisons |
| `CONTACTS_QA_RUNTIME_DIR` | Native isolated runtime root containing `WEB-INF` and `runtime` |
| `CONTACTS_QA_H2_JAR` | Optional explicit H2 JAR instead of deriving it from the native root |
| `CONTACTS_QA_DB_URL`, `CONTACTS_QA_DB_USER`, `CONTACTS_QA_DB_PASSWORD` | Native H2 TCP19093 connection and disposable local credentials; URL includes `IFEXISTS=TRUE` |
| `CONTACTS_QA_JAVA` | Java 21 executable; defaults to `java` |
| `CONTACTS_QA_SOURCE_DIR` | Optional checkout root for source parity with the native runtime or staging app container |
| `CONTACTS_QA_REQUIRE_MOBILE_HEADER` | Set to `1` for final combined-source verification; requires mobile header bounds, non-overlap and topmost-pointer assertions |
| `CONTACTS_QA_HEADER_BASELINE_FILE` | Optional previous actual checks JSON containing header geometry, for before/after comparisons |

Run `node verify-runtime.cjs`. HTTP is restricted to loopback 8080/18081. Native JDBC is restricted to loopback TCP19093 and requires an existing database. `ContactsDbProbe.java` uses only SELECT statements. PostgreSQL uses `docker exec` and a read-only transaction to query the captured IDs. When app-container/source variables are supplied, one `docker exec sha256sum` call compares the checked-out source with the exact files served by that container. Passwords, session tokens, cookies and raw request bodies are not recorded.

Header geometry is recorded in every viewport entry. Set `CONTACTS_QA_REQUIRE_MOBILE_HEADER=1` for the final combined-source profile, as done for the packaged 145-check report. It adds 18 checks across 390, 360 and 320 pixels on both shells. Hit testing uses `document.elementFromPoint` and accepts only the real topmost target or its descendant. A before/after comparison is produced only when an actual earlier report contains matching header geometry; no baseline is fabricated. Container/source parity supports the subsequent Linux staging run without requiring personal paths or `NODE_PATH`.

## Cleanup

`evidence/cleanup.json` confirms final cleanup after the 145-check integrated run: the owned JVM stopped, loopback ports 18081/19093 closed, both exact fresh H2 database files and both transaction journals were removed, and no database or journal residue remains. All captured synthetic contacts were purged with that disposable database.

Close browsers and JDBC connections, stop the isolated JVM/stack, and remove the entire fresh database. For Docker staging, tear down its disposable Compose volumes. For native H2, first verify the resolved exact database path belongs to the fresh runtime, then remove only the captured database files. Preserve a small cleanup confirmation without credentials or production data. Source fixtures are reproduction instructions; no live test records should remain.
