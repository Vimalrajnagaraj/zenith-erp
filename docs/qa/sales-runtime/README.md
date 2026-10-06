# Sales runtime regression verification

This profile verifies Sales changes in a fresh disposable database. It follows
`CONTRIBUTING.md`, `docs/SOP-commit-and-deploy.md` and `docs/qa/SOP-04-Sales.md`.
Never point it at production or an existing customer database.

## Reproduced defects and corrections

| Trigger | Previous behavior | Expected behavior |
| --- | --- | --- |
| Remove a line from a discounted invoice | Stored header amount reverted to the gross amount | Preserve the stored discounted taxable value and recompute taxes |
| Credit-note quantity -1; quote discount 150%; order quantity letters | Negative rows or a server exception | Friendly rejection and no persisted line |
| A full discount or explicitly entered zero price | Zero could fall back to a gross value/catalog price | Preserve the intentional zero |
| Change a draft's place of supply or reverse charge | Header, GST fields and print breakdowns could disagree | Refresh all three from stored line amounts |
| Add/change/delete an issued invoice line; revert its status | Some write paths bypassed the draft lock | Reject without changing the issued snapshot |
| Forge active-org preferences, derived session scope or search fields | Missing scope could drop an org condition; malformed skip-fields allowed a forged filter | Resolve membership and retain a non-bypassable org condition |
| Convert a discounted order to an invoice | Line discount was omitted; retries could duplicate billing | Preserve discounts and serialize conversion on the owning header |
| Generate words for an amount above 999 | Groovy decimal division broke the integer grouping closure | Format thousands, lakhs, crores and paise correctly |
| Generate an invoice/note number near April | Current calendar year could override the document's financial year | Resolve the financial year from the submitted date |
| Mock payment or cash settlement after a prior payment | Tax/rounding or prior settlement could be omitted | Settle only the remaining tax-inclusive balance, once |
| Convert a delivery challan | Wrong entity field names and unavailable status transitions caused rollback | Persist the real keys, validate status and link one invoice |
| Open warranty/commission selectors | Inline entity seed definitions were not loaded by this runtime | Load options and status flows from a normal seed data file |
| Expired/future warranty or commission | Date or eligibility checks were incomplete | Enforce inclusive warranty boundaries and commission dates/minimum |
| Sales mobile header and detail tables | Toolbar overlap, clipped controls and unreadable conversion action | Wrap controls, reserve measured header height and contain table scrolling |

`before-fix.json` records the original discounted header, invalid persisted lines
and invoice filter mismatch on synthetic fixtures. `verify-runtime.cjs` asserts
persisted state through independent read-only database queries after actual
screen transitions and service calls. HTTP redirects alone are never proof of a
successful write.

## Coverage

- Both `/apps` and `/qapps`: validation, tenant restrictions, page rendering and
  responsive layouts at 1440, 800, 390 and 320 pixels. Dialog decimal entry and
  keyboard focus are exercised in a real Chrome browser.
- Discount, zero discount, full discount, decimal quantities, intra/inter-state
  GST, reverse charge on/off and synchronized print tax breakdowns.
- Issued and foreign invoice snapshots remain unchanged; requests without a
  session token cannot write. Invalid/foreign products and customers are denied.
- January/March/April financial-year boundaries, duplicate manual numbers and
  credit-note original/reason metadata. Credit notes stay out of the invoice list
  and cannot collect payments.
- Quote → order → invoice; competing conversion retries; challan conversion and
  retry; mock payment retry and late failure; partial payment then cash settlement.
- Warranty expiration/start/end boundaries; foreign policy denial; commission
  validity and minimum amount; negative commission/slab input and foreign
  commission writes are rejected. Missing-org POS register lists remain empty.
  All four Sales PDF print routes generate PDFs.
- The existing CI smoke, independent tenant fixture and four POS billing goldens
  still run before the Sales profile. Their expected prices/taxes are unchanged.

This is a bounded regression pass, not a claim that every Sales behavior is free
of defects. Real payment-provider integration, email delivery, e-invoice/e-way
bill integrations, OpenSearch, accounting GL reconciliation and other browsers
are outside this profile. Payment callbacks remain the existing authenticated
mock implementation; no provider is contacted.

## CI invocation

Use the workflow on this branch and supply an exact same-repository commit:

```json
{"ref":"fix/sales-functional-and-ui","inputs":{"candidate_sha":"<40-character commit SHA>","contacts_profile":"sales"}}
```

The workflow verifies and boots the pinned **clean** runtime image, overlays the
candidate source, loads normal seeds once, then starts HTTP. The test-only helper
is installed into that disposable container before startup, never into the
application source or deployment image. Initialization requires the disposable
JVM flag, a demo platform admin and an absent `SALES_QA_A` fixture. Later calls
require the dedicated non-platform-admin synthetic user and a fixed service
allowlist. Date-boundary fixtures use the QA user’s explicit Asia/Kolkata calendar,
not the initializing demo administrator’s timezone. Output is limited to synthetic identifiers, results and errors.

Evidence is uploaded as `sales-<candidate-sha>` for 14 days. CI always tears down
the Compose stack; an additional assertion requires zero remaining project
containers/volumes and uploads `sales-teardown-<candidate-sha>`.

Clean image SHA256:
`0305b2d2f7124781c41de04eb8aa8a7847ee5116ee01f09dc52d7f12dc513b93`.
Framework SHA256:
`47c2b9cd86b005437abb75dbfd2d5027c00687ead4c5f7b0c9577b340f9e2e3d`.
The clean image shares the supplied framework bytes and receives repository
patches; it is not a byte-identical production container. Production image
layers, configuration, credentials and customer data are excluded.

## Native verification and cleanup handoff

Native verification uses the same framework and candidate component sources,
Chrome, H2 on loopback and a fresh database per full attempt. The probe permits
only SELECT queries against the task's disposable `sales-qa*` database path.
The dedicated runtime is stopped after verification.

Automatic approval review rejected both recursive and individual test database
file removal, with only “blocked by policy” given as the reason. Those local
synthetic databases and transaction journals are therefore retained, isolated
from production. Their generated document IDs and exact file paths are handed
off in the user-facing verification output. CI's separate fresh database is
removed and independently checked. Do not check the PR's blanket cleanup box
while those native files remain.

## Reviewer/deployment notes

- This change touches billing and tenant access; it requires senior review.
  It does not merge a PR or deploy production. PR #19 supplies the safe staging
  foundation; its commits are included so this PR can target `master` per SOP.
  Merge/reconcile #19 first so its infrastructure diff drops out here.
- Sales statuses/enums moved to `data/ZenithSalesSeedData.xml`. Deployment must
  load that normal seed file before enabling the changed challan/status UI.
  Definitions are additive/upserted; no existing tenant document is renumbered,
  deleted or rewritten. Legacy challan IDs keep compatibility labels.
- CSS and measured-header behavior are scoped to Sales. Asset versions are
  bumped in both stylesheet registrations and the qapps navigation registration.
- Cash/mock settlement preserves the existing status-based payment convention;
  it does not introduce GL posting or provider integration. Senior review should
  confirm that convention before production deployment.
