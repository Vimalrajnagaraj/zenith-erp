# ZE-SB-013 — Cross-Tenant ID Injection Audit (app-wide)

**Date:** 2026-07-27 · **Trigger:** ZE-SB-013 (subscription created with another tenant's `customerPartyId`).
**Scope:** every module's write services/transitions, checked for the class: *a create/store/update writes an
org-scopable entity ID (party / product / facility / equipment / employee) taken from a form param **without
validating it belongs to the caller's active organization**.*

## The class & the fix
A write accepts e.g. `customerPartyId` / `vendorPartyId` / `productId` and uses it verbatim. Guard with the
canonical predicate (already in the codebase):
```
zenith.base.SecurityServices.assert#RecordOrgAccess
   {entityName:'mantle.party.Party', idField:'partyId', idValue:<theId>, orgField:'ownerPartyId'}  -> allowed
```
(reads with `.disableAuthz()`, compares to `ACTIVE_ORGANIZATION`, **ADMIN exempt**). For products use
`mantle.product.Product`/`ownerPartyId`; for facilities `mantle.facility.Facility`/`ownerPartyId`.

### ⚠ KEY LESSON — fix the actual write layer
A screen `<transition>` that calls the **entity-auto** `create#<entity>` / `update#<entity>` **bypasses any
guard placed in a same-named custom service.** Guard the **transition** (or repoint it to the custom service).
This was proven live: the fieldservice guard placed in the custom `create#FieldServiceTask` did NOT block a
foreign customer until it was moved into the `createTask` transition. For each gap below, check whether the UI
path is a custom-service call (guard the service) or an entity-auto call (guard the transition).

## Status
- **FIXED + verified live:** subscriptions `create#Subscription` (customerPartyId + planId) [520eca1]; subscription
  UI switched to org-scoped PartyPicker [8108213]; fieldservice `createTask`/`createEquipment` transitions
  (customerPartyId) + custom-service DiD [ea1f55d]; marketing `addMember#ContactList` (partyId) [ea1f55d];
  promotions `create#Promotion` org-stamp (forged/null org overridden — verified) [a6d5945]; sales
  `create#PaymentLink` invoice-org guard (latent, DiD) [a6d5945].
- **TIER 1 core commercial customer/vendor — FIXED + verified live [84c8720]:** sales CreateOrder/CreateQuotation/
  CreateDeliveryChallan; purchase createPo/FindPurchaseOrder.createOrder/createDebitNote/VendorEvaluation/
  JobWorkChallan/EditRfq.createVendorResponse + `create#PurchaseInvoice` (service); contacts assign/remove
  CustomerGroupMember. Guarded only when the id is supplied → MARUTHI own-customer/vendor = no-op (verified:
  foreign party 0 rows, own party 1 row, on both sales and purchase). **Remaining in Tier 1:** sales
  `WarrantyPolicies.registerWarranty` (customerPartyId+productId).
- **TIER 2 product line items — FIXED + verified live [df0c9e6]:** sales EditInvoice/EditOrder/EditQuotation/
  EditCreditNote/EditDeliveryChallan addItem; purchase EditPurchaseOrder/EditPurchaseInvoice addItem, EditRfq
  createRfqItem/updateRfqItem; pricing set#PriceListItem/set#VolumePricing; + Tier-1 tail sales register#Warranty
  (customer+product). Product.ownerPartyId==active-org guard. Verified: EditInvoice addItem blocks a foreign
  product (0 rows), adds own (1 row). **Remaining Tier 2** (parent doc ALSO unguarded → need parent+product):
  purchase PurchaseReturnDetail.addItem, JobWorkChallanDetail.addItem, add#PurchaseInvoiceItem.
- **TIER-2 tail + TIER 3 — FIXED + verified live [d5d7d97]:** purchase PurchaseReturnDetail/JobWorkChallanDetail
  addItem + add#PurchaseInvoiceItem (parent+product); workshop create#ServiceJob/add#ServiceJobPart/create#AmcContract;
  rental create#RentalAgreement + EditAgreement.addItem (rentalAsset); returns create#ReturnRequest + EditReturn.addItem;
  crm log#Activity + createOpportunity + EditSegment.addMember; helpdesk create#Ticket. Verified: workshop createJob
  blocks a foreign customer (0 rows), creates own (1 row).
- **Junk data removed:** cross-tenant subscription 100257 (DOODLE billing org 101074's customer).

## ONLY REMAINING: Tier 4 (schema) + Tier 5 (employee membership)
Everything in the party/product ID-injection class is now closed across ALL commercial + peripheral modules.
What's left needs design/schema work, not the one-line guard:
- **TIER 4** — modules with NO org column on any entity (stores, quality, maintenance, attendance, timeoff,
  documents) + SmsGateway secret + create#Campaign org-stamp. Each is a per-module isolation project: add
  organizationPartyId, scope the lists, stamp on create, then guard. Do SmsGateway before SMS sending goes live.
- **TIER 5** — employee-internal party IDs (hr/payroll/attendance/timeoff assignee/employee fields). These need a
  new org-membership helper (a party is a member of org X via PartyRelationship, not ownerPartyId==X) — build
  `assert#PartyOrgMembership` once, then apply.
- **Deferred (need a schema change; both latent/empty today):** SmsGateway secret isolation (no org column; the
  3 gateway rows hold no secrets; `build#SmsPayload` has no live caller) and `create#Campaign` org-stamp
  (MarketingCampaign has no org column) — do with the TIER 4 no-org-model work, and **before SMS sending goes live**.

---

## Priority tiers (remaining)

### TIER 1 — Core commercial customer/vendor party injections (billing/GST/orders — highest business impact)
*Mirror the proven `CreateInvoice.createInvoice` guard (`_buyer.ownerPartyId==activeOrg`). Billing paths →
verify no-op for MARUTHI before/after.*
- sales: `CreateOrder.createOrder` (customerPartyId), `CreateQuotation.createQuotation` (customerPartyId),
  `CreateDeliveryChallan.createChallan` (toPartyId), `WarrantyPolicies.registerWarranty` (customerPartyId+productId+policy)
- purchase: `CreatePurchaseOrder.createPo` (vendorPartyId), `FindPurchaseOrder.createOrder` (vendorPartyId),
  `CreatePurchaseInvoice.createInvoice` (fromPartyId), `PurchaseInvoices.createPurchaseInvoice` (vendorPartyId),
  `PurchaseReturns.createDebitNote` (vendorPartyId), `EditRfq.createVendorResponse` + `VendorEvaluation.createEvaluation`
  (vendorPartyId — **also replace the leaky stock `searchPartyList` picker** with the org-scoped PartyPicker),
  `JobWorkChallan.createChallan` (jobWorkerPartyId)
- contacts: `assign#CustomerGroup` / `remove#CustomerGroupMember` (partyId + customerGroupId), `update#CustomerGroup` (group org)

### TIER 2 — Product-ID line-item injections (every "add item" writes an unchecked productId)
*Parent doc IS guarded; add a `Product.ownerPartyId==activeOrg` check. Bulk/mechanical.*
- sales `EditInvoice/EditOrder/EditQuotation/EditCreditNote/EditDeliveryChallan` addItem
- purchase `EditPurchaseOrder/EditPurchaseInvoice` addItem, `EditRfq` createRfqItem + **updateRfqItem (free-text productId)**,
  `PurchaseReturnDetail.addItem` + `JobWorkChallanDetail.addItem` (**parent doc ALSO unguarded — whole screens**),
  `PurchaseServices.add#PurchaseInvoiceItem`
- pricing `set#PriceListItem`, `set#VolumePricing` (priceListId already asserted; productId not)

### TIER 3 — Peripheral customer-facing modules (org-isolated enough for a clean party/product guard)
- rental `create#RentalAgreement` (customerPartyId), `addItem` (**rentalAssetId — dropdown NOT org-scoped**)
- workshop `create#ServiceJob` (customerPartyId+productId), `add#ServiceJobPart` (productId), `create#AmcContract` (customerPartyId+productId)
- returns `create#ReturnRequest` (customerPartyId + **storeId not org-scoped**), `addItem` (productId)
- crm `createOpportunity` (accountPartyId — trust server not the hidden org field), `log#Activity` (contactPartyId), `add#SegmentMember` (partyId)
- helpdesk `create#Ticket` (customerPartyId param, forgeable), promotions `addAction`/`create#Promotion` (freeProductId)
- inventory (best-guarded already): extend `assert#FacilityAccess`/`assert#ProductAccess` to the facility/product IDs on
  `create#StockTransfer`, `add#StockTransferItem`, `create#StockAdjustment`, `add#StockAdjustmentItem`, `receiveItem`,
  `createGatePass`, `registerSerial`, `ProductCategoryMember`

### TIER 4 — Modules with NO org-isolation model (need entity-level org columns FIRST, then scope+guard)
*These have no `organizationPartyId`/`ownerPartyId` on any entity — an ID guard alone is a band-aid; the real fix
is adding org columns + list scoping + guards (a per-module isolation pass).*
- **stores** (biggest cluster: `create#Store` doesn't even stamp org — accepts it as free input; update#Store, set#OperatingHours/StoreTarget/StoreConfig, addHoliday)
- **quality** (Inspection/NonConformance/Template/Certificate/CAPA — productId mostly **free-text**)
- **maintenance** (Equipment/WorkOrder/WorkOrderPart/MeterReading/MaintenancePlan; equipment dropdowns list ALL tenants')
- **documents** (Document entity has no org field at all; share/update/version/tag/access all unguarded — incl. free-text `sharedWithPartyId`)
- **attendance / timeoff** (isolation only via employeePartyId, never validated; many free-text employeePartyId fields; money path: `encash#Leave`)

### TIER 5 — Employee-internal party injections (org's own staff; IDOR but lower impact)
*Need a "is this party a member of my org" check (membership, not ownerPartyId).*
- hr/payroll: `MyProfile.updateProfile`, `confirm/resign#Employee`, `assign#MandatoryTraining`, `start#AppraisalCycle`,
  `create#SalaryAdvance`, `MyLeaves.applyLeave` (bypasses guarded apply#Leave), tax declarations, etc.
- quality/maintenance assignee writes (assignedToPartyId, free-text), helpdesk `assign#Ticket` (free-text), approvals
  `delegate#Approval`/`addStep` (free-text)

### Secondary HIGH findings (not the ID-injection class, but real cross-tenant leaks)
- **marketing `build#SmsPayload`** reads `SmsGateway.apiKey` (a SECRET) by unchecked `gatewayId` into the returned payload → cross-tenant credential exposure.
- **purchase `PaymentGatewayServices.create#PaymentLink`** mints a payment link for ANY `invoiceId` (no `fromPartyId==org`) → leaks another tenant's invoice total / creates a link.
- **`create#Promotion` / `create#Campaign`** don't stamp org → a null-org promo is treated as GLOBAL (applies to all tenants).
- **crm `evaluate#Segment`** seeds members from `PartyRole roleTypeId=Customer` with no org filter (all tenants' customers).
- Record-key IDORs (approve/reject/cancel by id with no parent-org check): approvals `requestId`, timeoff/hr leave `applicationId`, ecommerce order/tracking `orderId`, payroll `salaryAdvanceId`, inventory `DemandAlert.alertId`.

## Recommended sequencing
1. Secondary HIGH (SMS secret, PaymentLink, promotion org-stamp) — small, high-severity, isolated.
2. TIER 1 (core commercial) — highest business value; verify MARUTHI no-op.
3. TIER 2 (product line items) — mechanical, batchable.
4. TIER 3 (peripheral customer modules).
5. TIER 4 (no-org-model modules) — schedule as per-module isolation projects (schema + scope + guard).
6. TIER 5 (employee-internal) — needs an org-membership helper service.

## Progress log — 2026-07-28: SmsGateway module isolation (Tier 4 start) + Tier-5 membership helper
**Deployed + verified on throwaway PROFESSIONAL tenant (org 113566), 0 residue, MARUTHI untouched.**

Secondary-HIGH #1 (SMS secret) fully closed as a *module* isolation, not just a service band-aid:
- Added `SmsGateway.organizationPartyId` (auto-DDL). `createGateway` stamps it from the session; `updateGateway`
  guards via `assert#RecordOrgAccess`; the gateway list is org-scoped. **Verified (DB ground truth):** own create
  stamped 113566; foreign `updateGateway` blocked (name unchanged); foreign gateway invisible in the list render.
- `build#SmsPayload` guards the gateway before the decrypted `apiKey`/`apiSecret` enter the payload (defense-in-depth;
  no reachable caller — verified by inspection). Returns the same "not found" message as the not-exists case.
- **`SmsLog` + `SmsDltTemplate` have no org column** — they belong to a gateway, so both lists (and the DLT
  gateway drop-down + `create/updateDltTemplate`) are scoped/guarded to the org's own gateway ids. This closed a
  **cross-tenant PII leak**: `SmsLog` (phone numbers + message bodies) was visible to every tenant. **Verified:**
  own log/template shown, foreign hidden; foreign DLT create/update blocked.
- Fixed a **pre-existing render bug** (unrelated to the security change) that made the whole screen unusable for any
  tenant with an empty SMS log: `<limit-range>` (the codebase's only use) generates a `getPartialList`→`absolute(1)`
  scrollable-cursor call that throws "Error going to absolute row number 1". Replaced with `offset`/`limit` attrs.
- No-op-safe note: the 3 pre-existing gateways (`SMS_KALEYRA`/`SMS_MSG91`/`SMS_TEXTLOCAL`) are inactive platform
  **seeds** (org NULL, sender ZENITH, `is_active=N`); scoping keeps them out of tenant views (super-admin still sees
  them). MARUTHI configured none and has no gateway of its own → send capability unaffected.

Tier-5 helper built + first applications:
- New `zenith.base.SecurityServices.assert#PartyOrgMembership(partyId)` — a party is a member of the active org if it
  is an Employee of it (`zenith.erp.hr.Employee`), owned by it, or is the org. ADMIN-exempt pure predicate.
- Applied to attendance `mark#Attendance` (**verified**: own employee of 113566 → row created; employee of a
  *different* org → blocked, proving org-scoping not just "is any employee"), timeoff `encash#Leave` (money path),
  and payroll `create#SalaryAdvance` (inline Employee-PK org check — that service keys on `employeeId`, not partyId).

**Remaining Tier 4:** stores, quality, maintenance, documents + `create#Campaign` org-stamp (per-module schema projects).
**Remaining Tier 5:** ~35 more hr/payroll/attendance/timeoff/quality/maintenance/helpdesk/approvals employee-party writes.

## Progress log — 2026-07-28: Tier 5 batch 2a — HR / attendance / timeoff / payroll employee guards
**13 files, deployed + verified on throwaway tenant (org 113617), 0 residue, MARUTHI no-op.**
Added a second helper `zenith.base.SecurityServices.assert#EmployeeOrgAccess(employeeId)` (loads zenith.erp.hr.Employee
by its PK, compares organizationPartyId to the active org; ADMIN-exempt) for the many hr/payroll writes keyed on the
Employee PK rather than a party id. Guarded (all "only when the id is supplied" → own/null flows are a MARUTHI no-op):
- **hr** HrServices: create#Employee (reportingToEmployeeId), confirm#Employee, resign#Employee, approve#Leave
  (approvedByEmployeeId), calculate#FullAndFinal; LmsServices assign#MandatoryTraining; PerformanceServices
  start#AppraisalCycle (subject + manager + every peer); **transitions** MyLeaves.applyLeave (entity-auto create,
  bypasses the guarded apply#Leave service) + MyProfile.updateProfile (entity-auto update#Employee — a forged
  employeeId could overwrite another org's CTC/bank/statutory IDs).
- **attendance** clockIn/clockOut#Attendance (employeePartyId + clockOut's recordId path), transitions
  Shifts.assignShift / Overtime.createOvertime / MyAttendance.requestRegularize.
- **timeoff** initialize#LeaveBalance, transition CompOff.createCompOff.
- **payroll** transition TaxDeclarations.createDeclaration (india entity has no org column). SKIPPED calculate#Payslip:
  not web-reachable, sole caller process#PayrollRun pre-scopes to org employees, and a guard would fail-closed for a
  future anonymous/cron run — flagged latent, guard only if ever exposed.
Verified own-vs-foreign on DB ground truth across the full guard matrix (transition+employeeId createDeclaration,
transition+partyId createCompOff, service+employeeId resignEmployee): own succeeds, foreign (a valid employee of a
DIFFERENT org) blocked / 0 rows.
**Deferred to a follow-up record-IDOR + Tier-4 sweep** (a distinct class): update-by-record-PK transitions
(updateOvertime/updateCompOff/updateBalance/updateDeclaration) and approve/reject/cancel-by-applicationId — these
select by a record PK on entities with no org column, so they need org columns first.
**Next: batch 2b** — helpdesk/approvals/expenses assignee/approver/delegate party injections (assign#Ticket,
delegate#Approval, addStep, create#Ticket assignedToPartyId, etc.); several of those entities also lack an org column.

## Progress log — 2026-07-28: Tier 5 batch 2b — helpdesk / approvals / expenses party guards
**8 files, deployed + verified on throwaway tenant (org 113617), 0 residue, MARUTHI no-op.**
Guarded every write that injects an assignee/approver/delegate/requester/employee party id
(assert#PartyOrgMembership, "only when supplied"):
- **helpdesk** create#Ticket (assignedToPartyId) + assign#Ticket (assignedToPartyId **and** assert#RecordOrgAccess on
  ticketId — Ticket HAS an org column); transitions EditTicket.updateTicket (ticketId org + assignee),
  Departments.createDept/updateDept (managerPartyId).
- **approvals** delegate#Approval (fromPartyId **and** toPartyId — blocks impersonation, the strongest finding);
  transitions Delegations.updateDelegation, EditRequest.updateRequest, EditWorkflow.addStep/updateStep.
- **expenses** transition Advances.updateAdvance (employeePartyId).
Verified own-vs-foreign on DB ground truth: delegate#Approval (own→own created; foreign delegate blocked) and
create#Ticket (own assignee ticket created + org-stamped; foreign assignee blocked).

### ⚠ Remaining after Tier 5 (party-injection class is now CLOSED app-wide; two structural items remain)
1. **Tier-4 org columns** — the **approvals module** (ApprovalWorkflow/Step/Request/Delegation/Decision/Notification),
   helpdesk **HelpDepartment**, and expenses **ExpenseAdvance** carry NO organizationPartyId. The party-injection guards
   above block foreign-party injection, but the RECORDS themselves are still cross-tenant (a forged record PK can
   read/update another tenant's row). Closing that needs a per-module isolation pass (add org column + list scope +
   assert#RecordOrgAccess on the PK). Same for the other no-org Tier-4 modules: stores, quality, maintenance, documents
   (+ marketing create#Campaign org-stamp).
2. **Record-PK IDOR sweep** (a distinct class, deliberately not in these batches): approve/reject/cancel/regularize
   -by-id transitions and update-by-record-PK on no-org entities (updateOvertime/updateCompOff/updateBalance/
   updateDeclaration/updateStep/updateDelegation/updateRequest/updateAdvance). These select by a record id, not a
   party id; they need the parent record's org checked — folds into item 1 once those entities have an org column.
