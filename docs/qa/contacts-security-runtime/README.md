# Disposable contacts security acceptance

This profile runs only against a new, isolated localhost database. It must never be installed in production or run against an existing tenant database. The fixture contains two synthetic organizations, synthetic contacts and groups, and disabled test accounts. It preserves the CI foundation account's organization A association. It contains no password or password hash.

The runner enables the four fixture accounts by copying login material from the fresh demonstration account inside that database. Supply the demonstration password through `CONTACTS_QA_PASSWORD`; no login material is exported or written to evidence. Every write targets captured `CITEST_P14_*` records. Group operations execute with the logged-in account's normal authorization and a session CSRF token. The temporary helper is necessary to exercise each service independently of the editor's earlier redirect guard.

On a fresh runtime, install a temporary component with this descriptor and copy `fixture.xml` into its `data` directory before the single discovery loader:

```xml
<component name="ci-contacts-security" version="1.0"><depends-on name="zenith-erp-contacts"/></component>
```

```sh
java -cp . MoquiStart load types=seed,seed-initial,demo no-run-es
```

Do not combine `types` with a fixture `location`: a location selects only that file and skips foundation discovery. Do not run the loader while the HTTP JVM is running. Copy `qa-service-screen.xml` to the temporary runtime path `runtime/component/zenith-erp-contacts/screen/zenith/contacts/Contacts/ContactsQaAcceptance.xml` before starting the HTTP JVM. Keep the helper and fixture component out of deployment images.

Run `node docs/qa/contacts-security-runtime/verify-runtime.cjs` after normal startup/login gates. Required environment:

| Variable | Value |
| --- | --- |
| `CONTACTS_QA_BASE_URL` | `http://127.0.0.1:8080` for CI, or isolated native port `18082` |
| `CONTACTS_QA_PASSWORD` | Password of the fresh demonstration account |
| `CONTACTS_QA_OUTPUT_DIR` | Directory for sanitized JSON and screenshots |
| `CONTACTS_QA_CHROME` | Optional Chromium/Chrome executable |
| `CONTACTS_QA_SOURCE_DIR` | Repository checkout root |
| `CONTACTS_QA_DB_MODE` | `postgres` or `native` |

PostgreSQL mode additionally requires `CONTACTS_QA_DB_CONTAINER` and `CONTACTS_QA_APP_CONTAINER`; it uses local `docker exec` with `psql` and reads installed source bytes from the application container. The CI database is the fresh `moqui` database/account created by the disposable compose profile.

Native mode additionally requires `CONTACTS_QA_RUNTIME_DIR`, `CONTACTS_QA_JAVA`, `CONTACTS_QA_H2_JAR`, and `CONTACTS_QA_DB_URL`. The URL must use loopback H2 TCP port `19094` and `IFEXISTS=TRUE`. `CONTACTS_QA_DB_USER` defaults to `sa`; an optional password comes from `CONTACTS_QA_DB_PASSWORD`. The Java probe permits read-only `SELECT` queries and the one exact fixture account bootstrap statement.

The runner verifies real CSV and OOXML workbook rows, server-side organization scoping, forged search parameters, null/empty/`_NA_` organization preferences, filtered exports across pages, inactive/phone filters, group guards and DB persistence, the deliberate ADMIN bypass, and both browser shells at widths 320, 390, 800 and 1440. It compares six installed application files with their source SHA256 hashes. A failing assertion exits nonzero.

Membership removal reuses the exact instant returned by the guarded member service, including its fractional seconds. Raw SQL timestamp text can use a different calendar from the application JVM; it is retained only as read-only diagnostic evidence and is never reinterpreted as a service key. Removal assertions retain the captured DB/service keys and before/after own-member rows, while keeping denial and persistence checks strict.

For regression reproduction, `--reproduce` requests direct exports after proving the `_NA_` preference in the database. Before the fix, rendering a normal page cleared that preference, masking the direct-export leak. `--browser-only` is a local diagnostic shortcut; full acceptance runs without it.

After preserving evidence, stop the task-owned runtime and remove its whole fresh database and transaction journals, or tear down the disposable CI compose volumes. The runner restores the original own-group name and expires memberships it adds, and checks foreign/global groups and memberships remain unchanged. Evidence must contain no raw server logs, credentials, tokens, personal paths, or real tenant records.
