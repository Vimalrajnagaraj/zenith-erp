# Shops audit and regression report

Date: 2026-10-08. Scope: Shops (`Stores/FindStore`, `Stores/EditStore`,
`zenith.stores.*`) on Bootstrap `/apps` and Quasar `/qapps`.

## Environment and production boundary

The existing primary checkout was preserved: `master` had an existing hook mode
change and an untracked PDF. Work started in a clean separate checkout from
`origin/master` at `1997a90f`.

The authenticated live MARUTHI navigation was inspected. The Shops list was **not
opened on production**: source inspection showed that rendering it calls
`reconcile#OrgShops`, which creates Store rows. Opening that screen could therefore
write to the live tenant. The production source was not pulled over SSH; these
findings are reproduced against the repository baseline in disposable staging,
not a claim that production has byte-identical source. No production data,
passwords, files or issued invoices were changed.

Runtime verification uses the approved sanitized clean staging image, PostgreSQL,
the actual Moqui screen/service engine, and synthetic two-tenant fixtures. This is
not a static mockup. The staging rebuild is not a byte-identical production image.

## Findings and fixes

Paths below are relative to the repository root.

| ID / severity | File / element | Existing behavior and evidence | Root cause | Fix |
|---|---|---|---|---|
| SHOP-01 / high | `component/zenith-erp-stores/screen/zenith/stores/FindStore.xml`, list load; `service/zenith/stores/StoreServices.xml`, reconciliation | A GET can create shop profiles. In the baseline sequence, after an invalid facility update, loading the list increased the organization's Store count from 1 to 3. | Render action invokes a write service, with authorization disabled. | List rendering is read-only; authorized users reconcile through explicit **Sync existing shops** POST with CSRF. Repeat synchronization is idempotent. |
| SHOP-02 / high | `StoreServices.xml`, create/update and child services; new `StoreAccessServices.xml` | Baseline update accepted tenant B's facility for tenant A's shop. Transition scope trusts an editable preference; write ownership/permission checks are inconsistent. | Store access and referenced-object ownership are not validated together in the write path. | Resolve authoritative tenant membership on each path, require Shops write permission, scope store access and validate retail facility ownership/uniqueness and manager ownership. Fail closed without an organization. Reject invalid references without DB changes. |
| SHOP-03 / high | `FindStore.xml`, `EditStore.xml`, `StoreAccessServices.xml`, joined labels / exports / dashboard | A historical invalid facility/manager link can expose another tenant's joined names even after new writes are corrected. | Store ownership alone does not establish ownership of joined names. | Return copies with foreign joined labels masked; scope facility and manager options. Existing records are not rewritten. |
| SHOP-04 / medium | `StoreServices.xml`, code allocation and facility creation | Counting profiles to allocate STR codes can reuse an occupied code after deletion; multiple profiles can target one facility. | Count-based allocation and no serialized uniqueness validation. | Lock the tenant Party row during allocation/reconciliation/update, select an unused code, reject duplicate facility/code links, and fail the transaction if facility creation fails. No numbering or billing schema change. |
| SHOP-05 / medium | `StoreServices.xml`, hours / targets; `EditStore.xml`, dates | Baseline accepted `Invalid` weekday, `99:99`, negative target amounts and reversed date ranges. Day-granular targets/holidays are compared to a timestamp. | Missing service validation and date/timestamp mismatch. | Validate weekday, closed state, HH:mm, complete open/close pairs, target period, nonnegative values and date order. Preserve valid overnight schedules. Compare calendar dates so today's entries remain visible. |
| SHOP-06 / high | `EditStore.xml`, profile save; `StoreServices.xml`, `save#StoreProfile`; `zenithstatic/js/shops.js` | Separate browser requests can leave a partially saved schedule/profile; fetch code can redirect despite a rejected response. | Several independent transactions with weak error handling. | One native POST and one transaction for the profile plus seven distinct schedule rows. Late validation failure rolls everything back and returns Moqui's error banner. Duplicate submissions are blocked. |
| SHOP-07 / medium | `FindStore.xml`, New Store; `EditStore.xml`, tabs / actions; new `zenithstatic/js/shops.js` | Quasar strips inline script/style tags; baseline New Store click did not open a dialog. | Page initialization depends on stripped inline script tags. | External page-scoped bootstrap via an image onload. Native create form, required fields, keyboard submission, Escape and focus trapping; shared shell is unchanged. |
| SHOP-08 / medium | `shops.js`, native forms; Find/Edit transitions | Actual browser testing exposed Quasar New Store returning to `/apps`. | Quasar loads `.qvt` content through `/apps`, so server-rendered form actions inherit the wrong shell. | Rewrite only Shops native form destinations to the visible shell, and preserve the submitted shell on success/error redirects. HTTP transition and actual browser checks are separate evidence. |
| SHOP-09 / high | `StoreServices.xml`, linked facility / counter assignment / deletion | Relinking an established shop or moving a terminal with sessions can move historical shop attribution. In-use deletion can raise a raw FK failure. | Mutable references with no history safeguard. | Existing shop facility link is immutable; counters with session history cannot move. Reject wrong/shared facilities and assigned counters before deletion. Other referenced-facility FK constraints remain intact and roll back the whole transaction. POS source and billing calculations are unchanged. |
| SHOP-10 / medium | `EditStore.xml`, header / counter buttons / target amounts | Counter total is organization-wide while presented as shop-specific; counter IDs are interpolated into executable attributes; `123.45` target displays as `123`. | Incorrect count scope, mixed escaping contexts and whole-number display format. | Count assigned counters here, use escaped data attributes, and display currency with two decimals. Rename the linked owned facility alongside the profile so shop labels agree. |
| SHOP-11 / medium | `EditStore.xml`, manager controls / viewer; `shops.js` | Manager options query all people; write controls are not consistently tied to Shops permission. | Generic render-time permission variable and global party query. | Explicit Shops permission controls create/sync/edit actions, with independent server checks. Manager choices include only owned parties or organization employees. |
| SHOP-12 / UI | new `zenithstatic/css/shops.css`, forms / hours / counter table | Fixed modal label columns, schedule columns and counter tables can overflow narrow content. Several controls lack associated labels/focus styling. | Desktop-only sizing and inline style dependence. | Scoped wrap rules, scrollable counter table, narrow schedule columns, labels/switch accessibility and focus rings. Actual narrow viewport verification remains required; see limits below. |

| SHOP-13 / medium | `FindStore.xml`, paging; `shops.js`, search | A 10-per-page toolbar could show 14 rows (native default differs); toolbar search only filters the rendered page. | Shared list decoration defaults differ from server paging and search. | Set the Shops default to 10, preserve native pagination metadata while masking labels, and provide Enter-to-search through the tenant-scoped server query. Shared list chrome is unchanged. |

| SHOP-14 / medium | `FindStore.xml`, CSV export | Store cells are blank because links have no CSV text renderer; heading/subtitle are prepended to the CSV column header. | HTML navigation elements and page labels are emitted in CSV mode. | Emit the Store name as a CSV label and omit the page heading in CSV mode; parse the header and check tenant-scoped exported values. |

## Verification

Final result: **104/104 service, HTTP and DB checks passed**. See
[`evidence/services-summary.json`](evidence/services-summary.json),
[`evidence/verification.json`](evidence/verification.json), and the actual
[Bootstrap](evidence/bootstrap-profile.jpg) / [Quasar](evidence/quasar-profile.jpg)
profile screenshots and [Quasar search](evidence/quasar-search.jpg). The final
disposable stack was removed; zero containers, volumes and networks remain.
Actual Quasar viewport was 1039×675 with no horizontal page or Shops overflow.

- Independent database assertions cover successful persistence and unchanged state
  after rejected writes, CSRF and GET write rejection, tenant/viewer/no-org scope,
  foreign references, invalid input, atomic rollback, synchronization, creation,
  code gaps, counter history, child cleanup, current-day boundaries, and legacy labels.
- Native HTTP tests cover both shells, including success/error return destinations.
  Quasar content assertions fetch `.qvt`; its initial HTML wrapper is not the page.
- Actual browser testing covers creation, profile and schedule save, targets and
  holidays. SQL checks distinguish stored state from a cached page echo.
- Invoice table hash is compared before/after the Shops acceptance suite. No bill
  or invoice is changed or renumbered.
- All four repository guards, JavaScript syntax, XML parsing and diff whitespace
  checks are required. Standard master-pinned GitHub acceptance is separately linked
  in the PR; it does not substitute for Shops-specific verification.
- Fixtures/helper are under `docs/qa`, outside deployed components. The helper is
  installed only in disposable staging, requires a JVM flag, synthetic selectors,
  POST/CSRF and permitted test accounts. Cleanup removes only this labelled stack,
  including its RAM-backed database and local transaction journal, then checks zero
  remaining containers, volumes and networks.

## Remaining gates and review notes

1. **Responsive runtime pass:** the browser tool's requested 375×812 override still
   produced an actual 1280×720 viewport. No mobile pass is claimed. Test narrow,
   medium and wide viewports on both shells before merge. The author explicitly requested review-ready status while this gap remains documented.
2. **Production gate:** maintainer must compare the deployment payload to the live
   runtime, verify the read-only list behavior and MARUTHI no-op safety before deploy.
   Do not test writes on MARUTHI. Invalid legacy links require an explicit, reviewed
   data remediation plan; this PR masks their names and rejects writes, not a migration.
3. **Business rules for review:** existing facility links and counters with session
   history become immutable through this UI. If transfers are needed, they require
   a separate reviewed history-preserving workflow. New targets retain the existing
   recorded `actualSales` convention; this patch does not invent live POS aggregation.
4. The browser's shared offline notice and framework Vue key warnings are pre-existing
   shell behavior. No shared-shell or POS edits are included.
5. Cache busting is page-scoped (`shops.js?v=5`, `shops.css?v=5`) because these are new
   Shops assets loaded by the screens, rather than globally registered assets. This
   preserves `ZenithApp.xml` and unrelated modules.

This report records tested behavior and explicit limits; it does not certify that
all possible Shops defects or production configurations have been exhausted.

## Header follow-up (2026-10-08)

**SHOP-15 / UI:** the screenshot's green topbar comes from the framework
`WebrootVue.qvt.css` rule `body.test #top { background:#224422!important }`.
Its development equivalent is grey (`#5d5d5d`). These ID selectors outrank
the ERP's white `.q-header` rule. This is environment styling, not a Shops
background or a screenshot rendering issue.

`zenithstatic/css/shops.css` now overrides that background only on light-mode
dev/test Quasar pages containing `.zc-shops-page`; outside Shops and in dark
mode the override does not match. Page assets are versioned at v5 to invalidate
the previous cache. Production mode and shared controls are unchanged.

A fresh disposable run passed 104/104 checks again. Actual browser assertions
confirmed white (`rgb(255, 255, 255)`) on both Shops list and profile, retained
search/Owner View/utilities, and working Operating Hours tab. Navigation to
Dashboard retained its existing green environment header; on dark Shops the new
selector did not match and the existing header was unchanged. The final actual
viewport was 1280x720. See [corrected screenshot](evidence/quasar-header-light.jpg)
and [follow-up evidence](evidence/header-followup.json). Narrow viewport testing
remains open. The author requested removal of draft status for Amal's review;
this does not satisfy or waive any merge/deployment evidence gate.
