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
- **Junk data removed:** cross-tenant subscription 100257 (DOODLE billing org 101074's customer).
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
