# Gate Passes functional fixes and UI review

Branch: `fix/inventory-gate-passes-functional-ui`.
Base: `origin/master` at `ba5143a3`, confirmed current on 8 October 2026.
Main screen: `component/zenith-erp-inventory/screen/zenith/inventory/Inventory/GatePasses.xml`.

## Functional changes

- Creation and updates use dedicated authenticated services with Inventory write access checks. Screen writes require POST and the current session token, including Quasar multipart submissions.
- List, facility options, party search, detail, print, and writes require the active organization. Ownership is checked on loaded values as well as query conditions because primary-key lookups can optimize away additional conditions.
- Creation validates type, required facility and issue date, strict calendar dates, returnable expected return dates, date order, and supported text lengths. Organization, initial status, and issuer come from the server.
- Inline updates accept only the pass key, vehicle, and status. Protected issue and ownership fields cannot be overwritten through forged form parameters. A separate hidden key preserves both the visible pass link and native row submission.
- Returnable passes can move from Issued to Overdue or Returned, Overdue to Returned, and Returned to Closed. Non-returnable passes can move from Issued to Closed. Closed passes cannot reopen, and Overdue requires a passed expected return day.
- Returning a pass records its actual return timestamp and documented item quantities in the same transaction. Invalid item quantities reject the operation. Row locks serialize returns; repeated updates preserve the first return time. Gate pass documentation does not move inventory.
- The issue date default uses the native picker format. Find Options includes pass ID and issue date range filters, alongside existing type/status filters and sorting/pagination.
- Print opens an organization-scoped printable document with pass details and item quantities. User-entered strings are escaped. Missing or foreign passes disclose no details.

## UI changes

Applied the supplied Gate Passes reference and component/design documents using the shared violet palette. The screen has a title and Issue action, one white card, Find Options, repeated pagination, type badges, inline vehicle/status controls, Print/Update actions, and an in-flow footer. Mobile rows become labeled cards; tablet tables scroll within their container. Modal dialogs fit the phone viewport. Shared shell overrides are scoped to Gate Passes.

## Local validation

| Check | Result |
| --- | --- |
| Functional rejection, valid write, lifecycle, scope and picker cases | 37 / 37 passed |
| Native hidden key, item returns, rollback, escaping, unrelated passes and inventory invariants | 7 / 7 passed |
| Future issue return rejection and no-organization print | 2 / 2 passed |
| View-only UI, forged writes and foreign print access | Passed |
| Native create and inline update on Bootstrap and Quasar | Passed; generated records removed |
| ID, type, status, issue-date and two-page filtering | Passed |
| Both renderers at 360, 390, 768, 1280 and 1731 px | 10 / 10 passed; no page overflow or overlapping rows (1 px rounding tolerance) |
| Issue/Find dialogs on phone; initialized issue date | Passed |
| Returnable/non-returnable printable HTML and item contents | Passed |
| XML parsing and four repository source guards | Passed |
| `git diff --check` | Passed |

The browser automation rejected a relative print URL as invalid. No workaround was attempted. Printable output was independently verified through authenticated local HTTP; an OS print dialog or physical printer was not tested.

## Cleanup and release gates

The user reviewed two synthetic passes in the local ERP and requested publication of the combined functional/UI branch. All sample passes, their item, sample facility/party, both temporary test organizations, temporary view-only account, generated create-test records, and temporary QA screens are removed. Deletions used captured exact primary keys. Zero fixture party/pass residue was confirmed, the original active organization is restored, and unrelated Gate Pass records are unchanged. The empty Gate Passes page rendered successfully after cache clearing. No fixtures, credentials, raw responses, or screenshots are included in this change.

Run normal commit hooks, push this one combined branch, create a draft PR, and run the SOP staging acceptance workflow. CI results are recorded on GitHub; maintainer review is required before merge because write access and organization isolation are involved. Production deployment is a separate maintainer action. Local checks cannot guarantee future error-free operation or mergeability after master changes.
