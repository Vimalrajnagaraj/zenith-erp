# Contacts reference UI verification

This change follows the Contacts reports and four fixed UI images in the owner's Drive folder. The 16 Markdown reports cover Dashboard, All Contacts, Customers, Suppliers, Customer Groups, Add Group, Edit Group and Merge. Raw reference files and images remain outside the repository because they contain real tenant information.

The implementation uses existing services, dialogs and database values. It does not copy sample names, counts or tax details into application code. The Customers/Suppliers pencil opens the actual editor, as specified by their component reports; names continue to open profiles. The sample Customers image's purchase/ledger shortcuts are not added without a correct customer destination.

## Regressions covered

- Real profile Edit and directory breadcrumbs, with the selected contact ID retained.
- Footer Save from all six editor tabs on both renderers, independently confirmed in the database; Discard does not persist unsaved input. Pointer-hit checks cover desktop and mobile, including the Copilot overlay.
- Native Add Person/Company dialogs, accessible New menu close behavior, list selection with no POST, and partial selection state.
- Authorized server search across pages and first/last name fields; changing type retains search and resets pagination.
- Supplier inactive filtering and matching CSV output, checked against an independent owner-scoped database query.
- Existing Edit Group Update, editable payment terms and active toggle, with actual database persistence and restoration.
- Recent/full merge history with populated own/foreign fixtures, forged owner parameters, and no active organization. History fixtures represent synthetic prior merges; this UI profile does not merge any bill-bearing contact.
- Nine screens at 1440, 1024, 768, 390 and 320 pixels on both `/apps` and `/qapps`. Layout and runtime error checks supplement visual review; they are not a pixel comparison of the shared application shell.
- Before/after row counts and SHA-256 digests for the existing invoice, payment, order, POS and ledger tables.

`evidence/checks.json` records **212 passing checks, 90 layouts and zero browser errors** in the final native run. `evidence/source-parity.json` identifies all 12 changed application files installed in that runtime; `evidence/cleanup.json` records destruction of the whole task-owned in-memory database. Screenshots contain only disposable fixture data. Trusted clean-image UI/security workflow links belong in the PR, and are separate from this native report.

## Reproduce in a new disposable native runtime

Never install this helper or these fixtures in production. The driver refuses a non-loopback HTTP URL, and the SELECT-only probe refuses any database other than the named in-memory QA instance. The helper additionally requires `purchase.pricing.qa.disposable=true` and the temporary seeded administrator. It rejects initialization if its fixture already exists.

1. Start from current source with fresh Moqui seed/demo data, Java 21, H2 TCP bound to `127.0.0.1:19097`, and HTTP bound to `127.0.0.1:18085`. Disable external SMTP/search integrations. Use memory database `purchase-pricing-qa`.
2. Copy `qa-screen.xml` only into the temporary runtime's `zenith-erp-contacts/screen/zenith/contacts/Contacts/ContactsReferenceQa.xml`.
3. Copy these four files to that temporary component root:

| Source | Temporary filename |
| --- | --- |
| `docs/qa/contacts-security-runtime/fixture.xml` | `ContactsReference-security.xml` |
| `docs/qa/edit-customer-group-runtime/fixture.xml` | `ContactsReference-groups.xml` |
| `docs/qa/contacts-ui-runtime/fixture.xml` | `ContactsReference-directory.xml` |
| `docs/qa/contacts-reference/fixture.xml` | `ContactsReference-history.xml` |

4. Supply the environment below and run `node docs/qa/contacts-reference/verify-runtime.cjs`. Playwright must be available through normal Node resolution. The runner authenticates once, uses the real form CSRF token, initializes captured fixtures, and asserts they exist before testing.

| Variable | Required value |
| --- | --- |
| `CONTACTS_REFERENCE_BASE_URL` | `http://127.0.0.1:18085` |
| `CONTACTS_REFERENCE_DB_URL` | `jdbc:h2:tcp://127.0.0.1:19097/mem:purchase-pricing-qa;IFEXISTS=TRUE` |
| `CONTACTS_REFERENCE_USERNAME`, `CONTACTS_REFERENCE_PASSWORD` | Fresh disposable demo credentials supplied through the environment |
| `CONTACTS_REFERENCE_JAVA`, `CONTACTS_REFERENCE_H2_JAR` | Java 21 executable and disposable runtime H2 JAR |
| `CONTACTS_REFERENCE_OUTPUT` | External output directory |
| `CONTACTS_REFERENCE_CHROME` | Optional Chrome executable; otherwise Playwright Chromium |

5. Capture source parity, preserve sanitized evidence, stop the exact task-owned JVM and verify both loopback ports are closed. Destroying this entire fresh in-memory database removes its captured fixtures and demo state; do not reuse or delete an existing tenant database.

## Runtime limits and deployment gate

The native run uses a public-source rebuilt Moqui framework, not a byte-identical production image. Linux/PostgreSQL acceptance on the repository's pinned clean image is a separate required gate. No live contact, group, invoice or payment was changed during the MARUTHI UI inspection.

**Deploy-gate:** the merge screens now resolve the authorized organization and deny empty scope. The maintainer must reverify the current MARUTHI organization context and billing no-op on the production deployment candidate before deployment, following the repository runbook. A merge does not deploy this UI, and this task does not merge or deploy its own PR.
