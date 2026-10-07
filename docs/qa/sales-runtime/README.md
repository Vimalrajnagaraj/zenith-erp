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
| Converted challan goods controls | Locked writes remained offered, with a misleading permission message | Hide Add/Delete Goods and explain the document status lock |
| Sales mobile header and detail tables | Toolbar overlap, clipped controls and unreadable conversion action | Wrap controls, reserve measured header height and contain table scrolling |
| Create an order and add stock products | No facility was supplied to reservation, so Add Item rolled back | Select/validate an org-owned facility and carry it into the order/invoice |
| Add a 0% GST invoice line | An empty required tax-breakdown list rolled the entire line back | Clear only that draft line's old tax rows when it has no breakdowns |
| Export/SEZ line edits or conversion | Flags were dropped or the next edit restored seller GST | Carry header flags and consistently retax new/edited draft lines |
| Search a quotation/order number | Undeclared custom parameters were ignored | Declare the actual form parameters and check matching/nonmatching results |
| Download Sales CSV | HTML links/icons produced blank numbers; the shell formatter failed | Render plain export fields from the same filtered, scoped lists |
| Save challan transport details | LR number was dropped | Whitelist and persist the existing LR field |
| Forecast on issued/draft/cancelled history | Large drafts inflated completed-sales forecasts | Use the same issued/paid status set as the dashboard |
| Dashboard dates and invoice count | Invalid dates crashed; notes were counted as sales invoices | Validate date ranges and restrict sales-invoice metrics |
| Register/resolve a warranty | Long month values failed Calendar.add; Filed-to-Resolved was invalid | Use the required integer months and advance through In-Progress |
| Open a foreign invoice/note | Redacted records left blank forms and template errors | Render only the denial panel for missing/foreign records |
| Mixed-vendor order | Owning one part authorized shared header/other parts | Deny whole-document actions and exclude mixed orders from lists/dashboard/CSV |
| Denied Sales print | A 403 status still allowed the FO renderer to produce a PDF | Stop rendering with the framework's authorization exception; return 403 without PDF bytes |
| Invoice/note list and header amounts | A tax-exclusive value was labelled Total | Restore tax-inclusive stored totals and label them Total, consistent with CSV |
| Multi-page PDF | A row's description and amount split across pages | Keep each line's table row together within a page |
| Invoice/note PDF tax columns | Stored GST plus tax-detail GST was counted twice; rounding was unexplained | Use one tax split, reconcile printed GST to the grand total and display round-off |
| Empty dashboard chart | The all-zero secondary axis displayed Infinity | Bound zero-data axes and keep labels finite |

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
bill integrations, OpenSearch and accounting GL reconciliation are outside this
profile. CI uses Chrome; `verify-browsers.cjs` provides optional local browser
spot checks. Chrome and Edge are supported by the current Windows QA setup;
Firefox and WebKit launch could not be verified on this host. Payment callbacks remain the existing authenticated
mock implementation; no provider is contacted.

`verify-sop.cjs` expands the original regression suite with actual creation,
status/search/export, mixed-slab and large-decimal GST, RCM/export conversion,
claim resolution, month-end warranty, quick links, empty/no-org views, keyboard
Enter and rapid double-click, stored XSS, and a 75-line multi-page PDF. It checks
all create/edit/list screens at 1920/1366/360 pixels in both shells. PDF text is
checked with pinned `pypdf==6.10.0`; rendered pages still require visual review.
`sop-coverage.cjs` produces `sop-run-sheet.json` with evidence for all 88 case IDs;
missing/failed evidence fails the suite. Three legacy SOP differences remain
explicit: SL-017/025 retain cancelled document history for audit, and SL-045
uses master's existing local missing-state fallback with a visible editor note
and an explicit place-of-supply override. These are recorded as deviations,
never silently relabelled as matching the SOP. Senior review must confirm the
fallback policy before deployment. XLSX is not offered by this clean runtime's
render modes, so XLSX contents are not claimed verified.

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
only SELECT queries against the task's disposable `sales-qa*` database path or
the fixed `sales-qa-sop` in-memory H2 endpoint. Set `SALES_QA_MEMORY=true` for the
latter; this creates no new persistent business database. The native probe is
compiled once per run, then queries through the loopback H2 TCP endpoint.
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
  It does not merge a PR or deploy production. The branch incorporates master's
  merged clean staging foundation and Contacts updates; the remaining PR diff
  contains Sales behavior, its scoped presentation and verification support.
- Sales statuses/enums moved to `data/ZenithSalesSeedData.xml`. Deployment must
  load that normal seed file before enabling the changed challan/status UI.
  Definitions are additive/upserted; no existing tenant document is renumbered,
  deleted or rewritten. Legacy challan IDs keep compatibility labels.
- CSS and measured-header behavior are scoped to Sales. Asset versions are
  bumped in both stylesheet registrations and the qapps navigation registration.
- Cash/mock settlement preserves the existing status-based payment convention;
  it does not introduce GL posting or provider integration. Senior review should
  confirm that convention before production deployment.

## Post-merge PR 23 deployment blocker and follow-ups

The senior's read-only MARUTHI audit confirmed the M1 blocker: PR 23 stored
Sales invoiceTotal/unpaidTotal pre-tax, while Accounting/Home/TCS/GSTR consumers
expect gross totals. The follow-up chooses **Option B**, one tax-inclusive
stored convention, with round-off separate. It changes the two Sales writers,
print/payable readers and their labels; cross-module readers and POS are
unchanged. Draft unpaid totals include round-off and subtract existing payments.
No schema flag, historical migration or issued-document rewrite is added.

| Confirmed issue | Fix | Runtime regression |
| --- | --- | --- |
| M1: raw financial reports lose newly billed GST | Store taxable + GST; print/payable add only round-off | Header/line SQL goldens, Accounting list/ageing, GSTR-3B and GST PDF |
| Returned challans accept goods/status mutations | Guard current and legacy aliases; hide controls | Both shells; full header/item snapshots unchanged |
| Debit-note payment paths reject only credit notes | Shared payable guard rejects both notes | No links or invoice mutations |
| GST attribution string-sorts 100+ sequences | Retain returned item IDs | 105 varying-price lines and independent GST sums |
| Equal-date commission choice has no stable order | Ascending commissionId after descending validFrom | Repeated choice and amount checks |
| CI omitted the PDF parser install | Retain pinned pypdf 6.10.0 | Existing/new PDF semantics |

`verify-postmerge.cjs` runs after the existing SOP suite in the disposable
runtime. Historical gross and tax-off fixtures have exact unchanged headers;
foreign invoices cannot enter the scoped GSTR result. Forecast fixtures cover
both InvoiceFinalized and InvoicePmtRecvd with the same independent daily goldens.
The senior's production audit is evidence of current MARUTHI history, not a
post-fix production verification; the senior must rerun the deployment gate
against this candidate before deployment.

The prior 18 native QA files remain on the other computer. This run uses fresh
CI containers/volumes with independently asserted teardown. Manual cleanup,
existing SOP policy deviations and senior billing review remain required.
No production writes, merge or deployment are performed by this follow-up.
