# ZetaERP — Manual Bug-Testing SOP
## Part 4 — Sales (Quotations, Orders, Invoices, Credit Notes, Challans)

| | |
|---|---|
| **Document** | QA-SOP-04 — Sales |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The **Sales** module: Dashboard, Quotations, Sales Orders, **Tax Invoices** (GST), Credit/Debit Notes, Delivery Challans, Payments, Commissions, Warranty, Sales Forecast, and the print/PDF outputs. (POS counter billing is Part 3; Accounting ledgers are separate.) |
| **Audience** | Manual QA tester (no code knowledge assumed) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-01 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Sales module end-to-end (A→Z)** — the full **order-to-cash** flow (Quotation → Order → Delivery Challan → Invoice → Credit Note) plus payments, commissions, warranty and forecasting — including the **edge cases**, the **GST-correctness** cases, the **multi-tenant isolation** cases, the **security** cases, and the **visual/UI** cases, and **how to record a defect** when behaviour differs from the *Expected Result*.

Sales documents are **legal and financial records** (tax invoices, credit notes). Test deliberately, and never on live data.

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system producing legal GST documents.**

1. **NEVER create, edit, renumber, or delete a real invoice / credit note** on the live flagship tenant **MARUTHI (org `100000`)** or any live tenant. An issued tax invoice is a legal record. Do all create/edit/convert testing on a **throwaway tenant** you control.
2. ⚠️ **Known gap — issued invoices are editable.** There is currently **no lock** preventing edits/deletes of line items on a finalized/paid invoice (see §17). This makes rule #1 doubly important: do not test the "edit issued invoice" cases on real data.
3. **Never fabricate** legal/tax data — GSTIN, HSN/SAC codes, PAN, e-invoice IRN, e-way bill numbers, real customer details. Use clearly-fake QA values on a throwaway tenant.
4. **Multi-tenant isolation is a key surface** (§14). A tenant must never see or edit another tenant's quotes/orders/invoices. Any cross-tenant access is **Critical**.
5. **Clean up every test document** (quote, order, invoice, credit note, challan, commission, warranty) you create — or hand the list to the dev. Issued invoices may not be deletable; prefer cancelling/voiding test ones.
6. **Don't email/WhatsApp/print-and-send** a test invoice to a real address. PDFs may be generated; keep them local.

---

## 3. Test environment & preconditions

Open from the app menu → **Sales**. Screen URLs (`/apps/zenith/sales/…`):

| Area | Screens |
|---|---|
| Dashboard | `SalesDashboard` |
| Quotations | `FindQuotation`, `CreateQuotation`, `EditQuotation?orderId=` |
| Orders | `FindOrder`, `CreateOrder`, `EditOrder?orderId=` |
| Invoices | `FindInvoice`, `CreateInvoice`, `EditInvoice?invoiceId=` |
| Credit/Debit Notes | `FindCreditNote`, `CreateCreditNote`, `EditCreditNote?invoiceId=` |
| Delivery Challans | `FindDeliveryChallan`, `CreateDeliveryChallan`, `EditDeliveryChallan?…` |
| Other | `SalesForecast`, `Commissions`, `WarrantyPolicies` |
| Print (PDF) | `InvoicePrint`, `OrderPrint`, `CreditNotePrint`, `ChallanPrint` |

**Log in as a tenant user** so an **active organization** scopes the lists. For isolation tests you need **two tenants**. Have at least **two customers in different states** (for intra- vs inter-state GST) and a couple of **products** set up.

**Browsers:** full pass on Desktop Chrome; spot-check Edge/Safari/mobile. **Tools:** DevTools (Console/Network), a calculator (to check GST math), a QA inbox.

---

## 4. Test data

| Label | Use |
|---|---|
| Throwaway tenant | Non-MARUTHI org for all create/edit |
| `CUST_SAME_STATE` | Customer in the **same** state as the seller (→ CGST+SGST) |
| `CUST_OTHER_STATE` | Customer in a **different** state (→ IGST) |
| `PROD_A` / `PROD_B` | Two products with known prices + HSN + GST rate |
| Fake GSTIN | `29ABCDE1234F1Z5`-style dummy (throwaway only) |
| Amounts to verify GST | e.g. qty 10 × ₹100 @ 18% → taxable 1000, tax 180 |

---

## 5. Conventions & severity

**Case Type:** `FUNC` · `EDGE` · `GST` (tax-correctness) · `UI` · `A11Y` · `SEC` · `ISO` · `PERF`.

| Sev | Meaning | Example |
|---|---|---|
| **S1 — Critical** | Wrong tax math on a legal doc, cross-tenant access, altering/duplicating an issued invoice number, data loss | IGST charged on an intra-state sale; tenant A opens tenant B's invoice |
| **S2 — High** | Major flow broken | Convert-to-invoice fails; totals don't add up; can't save an invoice |
| **S3 — Medium** | Wrong behaviour, limited impact | Negative qty accepted; no GSTIN format check; status not enforced |
| **S4 — Low** | Cosmetic / minor UX | Column misaligned; PDF spacing off |

**Logging a defect** (template §16): Case ID, steps, expected vs actual (show the **GST math** for tax cases), tenant, browser, screenshot, Console/Network capture.

---

## 6. Flow map (order-to-cash)

```
   QUOTATION ──convert──► ORDER ──convert──► INVOICE ──► (payment)
   (OrderProposed)        (OrderPlaced)      (InvoiceInProcess→…→Paid)
        │                     │                   │
        │                     └─ OrderItemBilling links items   └─► CREDIT/DEBIT NOTE (from invoice)
        │
   DELIVERY CHALLAN ──convert──► INVOICE   (goods movement w/o sale: job work, approval, transfer)

   GST per line:  same state  → CGST + SGST  (½ rate each)
                  other state → IGST          (full rate)
   Numbering:     invoice no. = per-org sequence; gstInvoiceNumber auto "INV/<FY>/<id>" if blank (editable)
```

---

# 7. SALES DASHBOARD

**Screen:** `SalesDashboard`. Total Sales, Active Quotes, Total Customers, Generated Invoices, a 6-month trend, paid-vs-credit pie, and a 7-day forecast.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-001 | FUNC | Dashboard renders | Open the dashboard | All cards + charts render; numbers present | S3 |
| SL-002 | FUNC | Figures are org-scoped & correct | Cross-check Total Sales / Generated Invoices against the invoice list | Match **your** org only; cancelled invoices excluded from sales | S2 |
| SL-003 | FUNC | Quick links | Click "recent order" / nav buttons | Navigate to the right screen/document | S3 |
| SL-004 | UI | Empty state | New tenant with no sales | Cards show 0; charts don't break; forecast shows a "need ~2 weeks of history" message | S3 |

---

# 8. QUOTATIONS & ORDERS

A **Quotation** is an order in status `OrderProposed`; an **Order** is `OrderPlaced`. Both add line items with automatic GST.

### 8.1 Quotations

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-010 | FUNC | Create quotation | CreateQuotation → pick customer, date, terms → Save | Quote created (OrderProposed); opens EditQuotation | S2 |
| SL-011 | FUNC | Customer list org-scoped | Open the customer dropdown | Only **your** org's customers | S1 |
| SL-012 | FUNC | Add line item + auto price | EditQuotation → add a product, leave unit price blank | Price auto-fills from the price list; line total = qty × price | S2 |
| SL-013 | GST | Intra-state split | Customer in the **same** state, GST 18% | Line shows **CGST 9% + SGST 9%**, no IGST | S1 |
| SL-014 | GST | Inter-state split | Customer in a **different** state, GST 18% | Line shows **IGST 18%**, no CGST/SGST | S1 |
| SL-015 | GST | Rate options | Set GST rate via dropdown | Only 0/5/12/18/28% selectable; tax recomputes | S3 |
| SL-016 | FUNC | Convert to order | Quote → "Convert to Order" | Status → OrderPlaced; opens EditOrder; items carry over | S2 |
| SL-017 | FUNC | Find quotations | FindQuotation, search by no./customer/status | Lists only OrderProposed/OrderRejected for your org | S2 |
| SL-018 | EDGE | Quote with no items | Create and try to convert an empty quote | Handled gracefully (no crash); ideally warns | S3 |

### 8.2 Orders

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-020 | FUNC | Create order | CreateOrder → customer, date, terms (RCM/Export/SEZ flags) → Save | Order created (OrderPlaced) | S2 |
| SL-021 | FUNC | Add items | EditOrder → add products | Items added with price | S2 |
| SL-022 | FUNC | Convert to invoice | EditOrder → "Convert to Invoice" | A new invoice is created from the order's product items; GST **recomputed**; lands on EditInvoice | S1 |
| SL-023 | FUNC | Double-invoice guard | Convert the **same** order to invoice twice | Second attempt blocked: "This order has already been invoiced (…)." | S2 |
| SL-024 | EDGE | Convert order with no products | An order with no billable product items → Convert | Blocked: "Order has no billable product items." | S3 |
| SL-025 | FUNC | Find orders | FindOrder, search/filter | Lists orders (excludes proposed/rejected/cancelled), org-scoped | S2 |
| SL-026 | ISO | Cross-tenant order | As tenant A, open `EditOrder?orderId=<tenant-B order>` | **Blocked** — "Order not found for your account." | S1 |

---

# 9. TAX INVOICES (GST) — the core

**Screens:** `CreateInvoice`, `EditInvoice?invoiceId=`, `FindInvoice`. The invoice carries the legal GST data, line items, e-invoice/transport details, and status.

### 9.1 Create & line items

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-030 | FUNC | Create invoice | CreateInvoice → buyer, invoice type (Tax/BillOfSupply/Export), date → Save | Invoice created (InvoiceInProcess); opens EditInvoice | S2 |
| SL-031 | FUNC | Auto invoice number | Leave GST Invoice Number blank | Auto-generated `INV/<FY>/<id>` (e.g. `INV/26-27/00001234`); FY matches the company's financial year | S2 |
| SL-032 | FUNC | Add line item | EditInvoice → product, description, HSN/SAC, qty, unit price, GST rate → Add Item | Item added; taxable = qty×price (− discount); GST split correct | S2 |
| SL-033 | GST | Header totals aggregate | Add 2–3 items | Header **Total Taxable, Total CGST, Total SGST, Total IGST** equal the sum of the lines | S1 |
| SL-034 | GST | Intra vs inter-state | One invoice to a same-state buyer, one to other-state | CGST+SGST vs IGST exactly as in SL-013/014 | S1 |
| SL-035 | FUNC | Delete line item | Delete an item | Item removed; header totals + GST **recompute** | S2 |
| SL-036 | FUNC | Round-off | Add items that produce a fractional grand total | A round-off line appears; payable is the rounded figure; amount-in-words matches | S2 |
| SL-037 | FUNC | Save tax details | Set Buyer/Supplier GSTIN, Place of Supply, RCM, Export, LUT/Bond, Shipping Bill → Save | Persist | S2 |
| SL-038 | FUNC | Save e-invoice/transport | Set IRN, E-Way Bill, Transporter, Vehicle, LR No. → Save | Persist | S3 |

### 9.2 GST-correctness (do the math by hand)

| ID | Type | Title | Data | Expected result | Sev |
|---|---|---|---|---|---|
| SL-040 | GST | 18% intra-state | qty 10 × ₹100 @18%, same state | taxable 1000; CGST 90; SGST 90; total tax 180; grand 1180 | S1 |
| SL-041 | GST | 18% inter-state | same line, other state | taxable 1000; IGST 180; grand 1180 | S1 |
| SL-042 | GST | Line discount | qty 10 × ₹100, 10% discount, 18% | taxable 900; tax 162; grand 1062 | S1 |
| SL-043 | GST | Mixed rates | items at 5%, 12%, 18% | each line taxed at its own rate; header sums correct | S1 |
| SL-044 | GST | 0% / exempt | a 0% line | no tax added; appears on the invoice correctly | S3 |
| SL-045 | GST | Missing buyer state | buyer address has no state | **Record actual** — code defaults to **IGST** when state is unknown; confirm this is acceptable (likely wrong for a local sale) | S2 |
| SL-046 | EDGE | Negative quantity | qty = −5 | **Record actual** — there is **no negative-qty check**; the line and totals go negative. Flag (S3) | S3 |
| SL-047 | EDGE | Zero qty / zero price | qty 0 or price 0 | **Record actual** — no zero-amount check; an empty/zero invoice can be created | S3 |
| SL-048 | EDGE | Huge / decimal qty | qty 999999 / 2.5 | Handled; precision = 2 decimals, HALF_UP | S4 |

### 9.3 Status, numbering integrity, find

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-050 | FUNC | Status change | Set status InProcess → Approved → Sent → Paid | Status updates; reflected in the list | S3 |
| SL-051 | EDGE | Edit a finalized/issued invoice | Set status past In-Process (Finalized/Sent/etc.), then try to add/delete a line item | **FIXED:** line items can only change while the invoice is a **draft (In-Process)**. Once issued, add/delete is blocked ("This invoice has been issued and its line items can no longer be changed. Raise a credit or debit note to correct it."). Drafts remain fully editable | S1 |
| SL-052 | EDGE | Manual duplicate number | Set `gstInvoiceNumber` to a value already used | **Record actual** — no uniqueness check is visible; a **duplicate invoice number** is a legal problem (S1) | S1 |
| SL-053 | FUNC | Find invoices | FindInvoice, search by no./customer/GSTIN/status | Org-scoped list; columns incl. IRN; ledger link | S2 |
| SL-054 | ISO | Cross-tenant invoice | As tenant A, open `EditInvoice?invoiceId=<tenant-B>` | **Blocked** — "Invoice not found for your account." (verify the add/delete/update actions are all guarded) | S1 |

---

# 10. CREDIT / DEBIT NOTES

**Screens:** `CreateCreditNote`, `EditCreditNote`, `FindCreditNote`. A credit note reduces tax liability (sales return etc.); a debit note increases it.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-060 | FUNC | Create credit note | CreateCreditNote → pick original invoice, reason, date → Save | CN created from the original invoice (org/customer carried over) | S2 |
| SL-061 | FUNC | Reason captured | Pick a reason (Sales Return / Post-sale Discount / etc.) | Stored and shown | S3 |
| SL-062 | FUNC | Debit note | Same, choose "Debit Note" | Created as a debit note (increases liability) | S2 |
| SL-063 | GST | CN GST split | Add adjustment items | Same intra/inter-state GST rules as invoices | S1 |
| SL-064 | ISO | Original invoice must be yours | Try to create a CN against another tenant's invoice id | Blocked: "Original Invoice not found." | S1 |
| SL-065 | EDGE | Self / circular reference | Reference a credit note as its own original | **Record actual** — no circular-reference check; flag if it allows it | S3 |
| SL-066 | FUNC | Find credit notes | FindCreditNote, filter by type/customer/original invoice | Org-scoped; shows Credit vs Debit, original invoice id | S3 |

---

# 11. DELIVERY CHALLANS

**Screens:** `CreateDeliveryChallan`, `EditDeliveryChallan`, `FindDeliveryChallan`. Goods movement without a sale (job work, approval, transfer), with e-way bill.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-070 | FUNC | Create challan | CreateDeliveryChallan → receiver, type, date → Save | Challan created (Draft); auto-number `CH-<id>` if blank | S2 |
| SL-071 | FUNC | Add goods | EditDeliveryChallan → product, HSN, qty, UOM, est. value → Add | Items added | S2 |
| SL-072 | FUNC | Transport / e-way bill | Set E-Way Bill, Vehicle, Transporter, LR → Save | Persist | S3 |
| SL-073 | FUNC | Convert to invoice | Convert challan → invoice | Invoice created from challan items; challan → Converted | S2 |
| SL-074 | FUNC | Status flow | Draft → Dispatched → Delivered / Returned / Cancelled | Status updates | S3 |
| SL-075 | ISO | Find challans org-scoped | FindDeliveryChallan | Only your org's challans | S1 |

---

# 12. PAYMENTS · COMMISSIONS · WARRANTY · FORECAST

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-080 | FUNC | Payment link | Generate a payment link for an invoice (Razorpay/CCAvenue) | A link is created (currently a **mock** gateway — no real charge); status CREATED | S3 |
| SL-081 | FUNC | UPI QR | Generate a UPI QR for an invoice | A valid `upi://pay?...` string with the right payee/amount | S3 |
| SL-082 | EDGE | ⚠ Payment doesn't update invoice | Simulate a "paid" callback | **Record actual — KNOWN GAP:** the payment-link status flips to PAID but the **invoice status does not become Paid** and no Payment is recorded against it. Flag (S2) | S2 |
| SL-083 | FUNC | Commission structure | Commissions → define a salesperson rate (%) and validity | Structure created (org-scoped) | S3 |
| SL-084 | FUNC | Commission calc | Calculate commission for an order with a salesperson | commission = order grand total × rate ÷ 100 | S3 |
| SL-085 | FUNC | Warranty policy + register | WarrantyPolicies → create a policy, register a warranty (serial, purchase date) | Warranty registered; end date = purchase + duration | S3 |
| SL-086 | FUNC | Warranty claim | File a claim on an **active** warranty | Claim created | S3 |
| SL-087 | EDGE | Claim on expired warranty | File a claim after the warranty period | Should reject ("Warranty is not active"); **verify** it actually checks expiry, not just status | S3 |
| SL-088 | FUNC | Sales forecast | SalesForecast → run | Produces a 7/14-day projection with a confidence %; with <~2 weeks of data shows the "need more history" message | S3 |
| SL-089 | ISO | Forecast/commission org-scoped | View as two tenants | Each sees only its own | S1 |

---

# 13. PRINT / PDF

**Screens:** `InvoicePrint`, `OrderPrint`, `CreditNotePrint`, `ChallanPrint` (PDF outputs).

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| SL-090 | FUNC | Invoice PDF | Print an invoice | PDF shows seller/buyer, GSTIN, line items, **GST split**, totals, **amount in words** (Indian lakh/crore), invoice no. + date | S2 |
| SL-091 | FUNC | Other PDFs | Print a quotation/order, credit note, challan | Each renders correctly with the right title | S3 |
| SL-092 | ISO | Only buyer/supplier may print | As an unrelated tenant, hit `InvoicePrint?invoiceId=<other>` | Denied / blank — only the supplier or buyer org can print | S1 |
| SL-093 | UI | PDF layout | Inspect a multi-page invoice | No clipped columns; totals on the right page; numbers aligned | S4 |

---

# 14. MULTI-TENANT ISOLATION (high priority)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ISO-001 | ISO | Quotations/Orders scoped | Tenant A lists | Only A's quotes/orders (`vendorPartyId`) | S1 |
| ISO-002 | ISO | Invoices scoped | Tenant A lists invoices | Only A's invoices (`fromPartyId`) | S1 |
| ISO-003 | ISO | Direct-URL invoice/order/CN | A opens B's `EditInvoice`/`EditOrder`/`EditCreditNote` by id | Blocked ("not found for your account") | S1 |
| ISO-004 | ISO | Add/delete item cross-tenant | (Dev-assisted) POST addItem/deleteItem for B's invoice as A | Blocked by the same ownership guard | S1 |
| ISO-005 | ISO | Challans/Commissions/Warranty/Forecast | Each scoped to the active org | No cross-tenant rows | S1 |
| ISO-006 | ISO | Print cross-tenant | A prints B's document | Denied | S1 |
| ISO-007 | ISO | Customer/product pickers scoped | Open the dropdowns in any create screen | Only your org's customers/products | S1 |

---

# 15. UI / ACCESSIBILITY / SECURITY

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| SL-100 | UI | Desktop layout | All screens at 1920/1366 | Item grids and totals aligned; no overflow | S4 |
| SL-101 | UI | Mobile layout | Create/edit at 360–390px | No horizontal scroll; item form usable; totals readable | S3 |
| SL-102 | A11Y | Keyboard | Tab through an add-item form | Logical order; Enter adds; visible focus | S3 |
| SL-103 | SEC | XSS in free text | Put `<img src=x onerror=alert(1)>` in description / customer name | Rendered/escaped as text, never executes (incl. on the PDF) | S1 |
| SL-104 | SEC | CSRF | (Dev-assisted) POST a create/addItem without the session token | Rejected | S2 |
| SL-105 | EDGE | Double-submit | Click "Add Item" / "Convert" twice fast | Only one item/invoice created | S2 |

---

## 16. Cross-flow / regression (full order-to-cash) & defect template

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-001 | FUNC | Quote → Order → Invoice | Create a quote, convert to order, convert to invoice; GST recomputes at each stage; totals consistent | S1 |
| XF-002 | GST | State change mid-flow | Change the customer's state between order and invoice → GST flips CGST/SGST ↔ IGST correctly | S1 |
| XF-003 | FUNC | Invoice → Credit Note | Raise a CN against the invoice; amounts and GST reverse correctly | S1 |
| XF-004 | FUNC | Challan → Invoice | Goods on a challan convert into a correct invoice | S2 |
| XF-005 | ISO | End-to-end isolation | Nothing tenant A creates is visible/editable by tenant B at any stage | S1 |

```
Defect ID:        ZE-SALES-____
Linked Case ID:   SL-0__ / ISO-0__ / XF-0__
Title / Severity / Type:
Environment:      Prod | <browser> | tenant: <org>
Steps / Expected / Actual:   (for GST cases, show the math: taxable, CGST/SGST/IGST, grand)
Document ids touched (quote/order/invoice/CN/challan):
Evidence:         screenshot + Console/Network (mandatory for GST, ISO, SEC)
```

---

## 17. Areas to probe hardest (attention map)

These are the most likely defects in this module — spend extra time here:

1. **GST correctness (§9.2, XF-002)** — the single most important thing. Intra vs inter-state, discounts, mixed rates, and the **"missing state → defaults to IGST"** behaviour (SL-045). Do the math by hand.
2. **Issued-invoice immutability (SL-051)** — *fixed*: line items are locked once the invoice leaves draft. Regression-test that drafts still edit and issued invoices refuse add/delete. **Separately, a real GST bug was found here:** the intra/inter-state check reads a non-existent field on the address entity, so it errors when both parties have addresses or falls back to IGST (the SL-045 behaviour) — flag for a follow-up fix.
3. **⚠ Invoice-number uniqueness (SL-052)** — manual `gstInvoiceNumber` has no duplicate check.
4. **⚠ Payment doesn't close the invoice (SL-082)** — payment link → PAID, but the invoice stays unpaid; no Payment recorded.
5. **Validation gaps** — negative qty (SL-046), zero amount (SL-047), no GSTIN/HSN format check, no credit-limit enforcement, RCM/Export flags stored but **not applied** to GST.
6. **Multi-tenant isolation (§14)** — lists and document actions are guarded (`fromPartyId`/`vendorPartyId`); confirm the *edit/add/delete/print* paths are **all** guarded, not just the lists.

---

## 18. Teardown (mandatory)

1. **List every test document** (quote/order/invoice/CN/challan/commission/warranty) with ids.
2. **Cancel/void** test invoices and credit notes (don't leave fake tax documents around); hand the list to the dev for proper cleanup.
3. Delete any **PDFs** generated on the test machine.
4. Confirm you **never created/edited/numbered a document on MARUTHI** (org `100000`) or any live tenant.
5. Attach the run sheet(s) + defect ids to this part's report.

---

*End of Part 4 — Sales. Related: Part 1 — Login & Onboarding; Part 2 — Contacts; Part 3 — Settings. Sales consumes customers/products from Contacts & Inventory and posts to Accounting; the GST-correctness and issued-invoice-immutability findings here should be triaged with the dev before any live use.*
