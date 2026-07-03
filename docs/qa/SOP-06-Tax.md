# ZetaERP — Manual Bug-Testing SOP
## Part 6 — Tax (GST: registrations, rates, calculation, e-Invoice / e-Way Bill, GSTR-1)

| | |
|---|---|
| **Document** | QA-SOP-06 — Tax |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The **Tax** module: Tax Dashboard, Tax Authorities, Tax Rates & GST Slabs, Tax Exemptions, **Tax Registrations (GSTIN)**, **GST Returns (GSTR-1)** — plus the **GST calculation engine** every billing screen depends on (intra- vs inter-state CGST/SGST/IGST, CESS, tax-inclusive pricing, composition, export/SEZ, reverse charge, TCS, rounding), **GSTIN validation**, **HSN/SAC**, **e-Invoice (IRN)** and **e-Way Bill**. (GSTR-2 / GSTR-3B reports live in **Accounting**, cross-referenced in §16. The stock-transfer IGST flow is Part 5.) |
| **Audience** | Manual QA tester (no code knowledge assumed; basic GST literacy helps) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-01 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Tax module end-to-end (A→Z)** — configuring tax authorities/rates/registrations, then proving the **GST calculation is legally correct** on every downstream document (POS bill, sales invoice, purchase invoice, stock transfer): the right **CGST+SGST vs IGST** split, the right **rate slab**, correct **CESS**, correct **tax-inclusive** extraction, correct **rounding**, correct **document type** (Tax Invoice / Bill of Supply / Export), and the compliance artefacts (**e-Invoice IRN**, **e-Way Bill**, **GSTR-1**).

> **Tax output is a legal and financial record.** A wrong CGST/SGST/IGST split, a wrong rate, or a wrong GSTIN on an issued invoice is a **compliance breach**, not a cosmetic bug. Do the math by hand for every calculation case. Never test on a live tenant's real invoices.

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system producing statutory GST documents.**

1. **NEVER create, edit, or file** a real tax registration, invoice, e-Invoice, e-Way Bill, or GSTR-1 return on the live flagship tenant **MARUTHI (org `100000`)** or any live tenant. Do all testing on a **throwaway tenant** you control.
2. **Never fabricate** real statutory identifiers — GSTIN, PAN, HSN/SAC, IRN, e-Way Bill numbers. Use clearly-fake, format-valid QA values (e.g. a dummy GSTIN with a valid state code and checksum only on a throwaway tenant). **Never** push a test document to the **real NIC e-Invoice / e-Way Bill portal** — confirm with the dev whether the environment is pointed at the NIC **sandbox** or a **mock**; if it's a real/production NIC credential, **do not generate**.
3. **Multi-tenant isolation is a key surface** (§15). Tax registrations, rates, exemptions, GSTINs and returns must be scoped to the active org. Any cross-tenant read/write of tax data is **Critical**.
4. **The GST engine is shared** by POS, Sales, Purchase and Stock Transfer. A change here affects all of them — verify the four callers still compute the same numbers.
5. **Clean up every test artefact** (registration, exemption, rate, invoice, filing, e-Invoice, e-Way Bill) — or hand the list to the dev. Do not file a return anywhere real.
6. **Show your working.** For every calculation case, record the inputs, the by-hand expected split, and the actual — a bare "looks right" is not acceptable for a GST case.

---

## 3. Test environment & preconditions

Open from the app menu → **Tax**. Screen URLs (`/apps/zenith/tax/…` — lowercase):

| Area | Screen (URL name) | Purpose |
|---|---|---|
| Dashboard | `TaxDashboard` | Tax module overview |
| Tax Authorities | `FindTaxAuthority`, `EditTaxAuthority?taxAuthorityId=` | Central/State GST authorities |
| Tax Rates | `FindTaxRate`, `EditTaxRate?taxRateId=` | Rates + read-only **GST Rate Slabs** list |
| Tax Exemptions | `FindTaxExemption`, `EditTaxExemption?exemptionId=` | Party/product exemptions (export, SEZ, RCM, etc.) |
| Tax Registrations | `FindTaxRegistration` | **GSTIN / PAN / TAN per party** (the intra/inter-state driver) |
| GST Returns | `Gstr1Returns?filingId=` | Generate / view / download **GSTR-1** (outward supplies) |

**Related (Accounting module, cross-referenced):** GSTR-2 (`/apps/zenith/accounting/Gstr2Report`), GSTR-3B (`/apps/zenith/accounting/Gstr3bReport`), GST Reports (`/apps/zenith/accounting/GstReports`).

**Engine (no screen, but tested through billing):** `zenith.india.IndiaTaxServices.calculate#Tax` → `zenith.india.GstServices.calculate#Gst`. Configured per org via `CompanySettings.TAX_CALCULATION_SERVICE`.

**Set up on the throwaway tenant:** an **org GST config** (GSTIN + home state), a **customer with a GSTIN in the SAME state** (→ intra), a **customer with a GSTIN in a DIFFERENT state** (→ inter), an **unregistered (B2C) customer**, and **products across rate slabs** (0 / 5 / 18 / 28 / 28+CESS / exempt) with HSN codes. Have the **POS Terminal**, **Sales** (Create Invoice) and **Purchase** modules reachable to exercise the engine.

**Browsers:** full pass on Desktop Chrome; spot-check Edge/Safari/mobile. **Tools:** a **calculator** (mandatory — you verify GST math), DevTools (Console/Network), and the state-code table (01–38).

---

## 4. Test data

| Label | Use |
|---|---|
| Throwaway tenant | Non-MARUTHI org for all tax config + documents |
| Home state | The org's GST state, e.g. Karnataka **`29`** |
| `CUST_SAME` | Customer with a valid GSTIN in state **29** → intra-state (CGST+SGST) |
| `CUST_OTHER` | Customer with a valid GSTIN in a different state, e.g. Maharashtra **`27`** → inter-state (IGST) |
| `CUST_B2C` | Customer with **no GSTIN** (unregistered) |
| `PROD_18` / `PROD_5` / `PROD_28` | Products on the 18% / 5% / 28% slab, with HSN |
| `PROD_CESS` | Product on **28% + CESS** (e.g. `GST_28_CESS_12`) |
| `PROD_EXEMPT` | `isGstExempt = Y` (0%) |
| Fake GSTIN | Format-valid dummy per state, e.g. `29ABCDE1234F1Z5` (throwaway only) |
| Amounts to verify | qty 10 × ₹100 @18% → taxable 1000, tax 180 (intra: CGST 90 + SGST 90; inter: IGST 180) |

**State codes to know:** `27`=Maharashtra, `29`=Karnataka, `33`=Tamil Nadu, `07`=Delhi (UT). Full range **01–38**.

---

## 5. Conventions & severity

**Case Type:** `FUNC` · `CFG` (config) · `GST` (tax-math correctness) · `EDGE` · `UI` · `A11Y` · `SEC` · `ISO` · `PERF`.

| Sev | Meaning | Example |
|---|---|---|
| **S1 — Critical** | Wrong GST math on a document; cross-tenant tax-data access; wrong GSTIN/state on an issued invoice; a real NIC push of test data | IGST charged on an intra-state sale; CGST+SGST charged on an inter-state sale; another tenant's GSTIN visible |
| **S2 — High** | A tax flow broken or a clearly wrong classification | engine returns zero tax for a taxed product; wrong document type (Tax Invoice vs Bill of Supply); GSTR-1 totals don't tie to invoices |
| **S3 — Medium** | Wrong/loose behaviour, limited impact | no GSTIN format check; rounding off by a paisa; exemption date range not honoured |
| **S4 — Low** | Cosmetic / minor UX | slab list mis-aligned; label typo; amount-in-words spacing |

**Logging a defect** (template §17): Case ID, steps, **inputs + by-hand expected split vs actual** (mandatory for GST cases), tenant, seller/buyer state codes, browser, screenshot, Console/Network. Evidence is **mandatory** for GST, ISO and SEC.

---

## 6. Flow map (how GST is decided)

```
  PRODUCT ─(gstSlabId | productTaxCode/HSN → IndiaHsnCode.defaultGstSlabId)→ GST SLAB (5/12/18/28[+CESS]/0)
  SELLER state = org GSTIN[0:2]        BUYER state = buyer GSTIN[0:2]  (no GSTIN → defaults to seller state, B2C)
                         │
          calculate#Tax ─┼─► calculate#Gst(supplierState, buyerState, slab, taxable, isReverseCharge, isSezSupply)
                         │
      ┌──────────────────┼───────────────────────────┐
      ▼                  ▼                            ▼
  SEZ / EXPORT      supplier == buyer (or both UT)   supplier ≠ buyer
  IGST @ 0%         INTRA-STATE:                     INTER-STATE:
  (zero-rated)      CGST = slab.cgst, SGST = slab.sgst   IGST = slab.igst
                    (18% → 9 + 9)                     (18% → 18)
      + CESS (if slab has cessRate): cess = taxable × cessRate/100  (on taxable, not on GST)
      Rounding: each amount HALF_UP 2dp;  invoice grand total → nearest rupee (round-off line)
      Doc type: composition → BILL OF SUPPLY · export/SEZ → EXPORT INVOICE · else TAX INVOICE
      B2B/B2C: buyer has GSTIN → B2B · no GSTIN → B2C_SMALL (<₹2.5L) / B2C_LARGE (≥₹2.5L)
```

---

# 7. TAX DASHBOARD

**Screen:** `TaxDashboard`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-001 | FUNC | Dashboard renders | Open the dashboard | Cards/metrics render; no console errors; org-scoped | S3 |
| TX-002 | FUNC | Quick links | Click each tile/link | Navigates to the right tax screen | S3 |
| TX-003 | UI | Empty state | New tenant with no tax config | No crash / NaN; sensible zero state | S3 |

---

# 8. CONFIG — Authorities, Rates & Slabs, Exemptions

### 8.1 Tax Authorities

**Screens:** `FindTaxAuthority`, `EditTaxAuthority`. Entity `TaxAuthority` (type National/State/…, country/region geo).

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-010 | CFG | List authorities | Open FindTaxAuthority | Lists authorities (e.g. Central GST, State GST); org-scoped where applicable | S3 |
| TX-011 | CFG | Create/edit authority | Create a State authority for a region → Save → edit | Persists; type + region correct | S3 |
| TX-012 | EDGE | Authority without region | Create a "State" authority with no region | Record actual — verify it's allowed/blocked sensibly | S3 |
| TX-011a | SEC | **Authorities are platform-admin-only** | As a normal tenant, open FindTaxAuthority | **Read-only**: no "New", no Edit link, no Delete. Direct POST to create/update/delete → `Only a platform administrator...`; nothing changes | S1 |
| TX-011b | FUNC | Super-admin delete authority | As super-admin, delete an **unreferenced** authority vs a **referenced/parent** one | Unreferenced deletes; referenced → `Cannot delete: ... used by N record(s). Deactivate it instead.` | S2 |

### 8.2 Tax Rates & GST Slabs

**Screen:** `FindTaxRate` (+ read-only **GST Rate Slabs** list of `IndiaGstSlab`), `EditTaxRate`. Slabs carry `gstRate`, `cgstRate`, `sgstRate`, `igstRate`, `cessRate`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-013 | GST | Slab integrity | Open the GST Rate Slabs list | For every slab, **cgstRate + sgstRate == gstRate** and **igstRate == gstRate** (e.g. 18 → 9/9/18; 28 → 14/14/28; 5 → 2.5/2.5/5) | S1 |
| TX-014 | GST | CESS slabs | Inspect `GST_28_CESS_*` slabs | gstRate 28 (14/14/28) **plus** a separate `cessRate` (1/5/12/22) | S2 |
| TX-015 | GST | Exempt & special | Inspect `GST_EXEMPT`, precious-metal (0.1/0.25/1/3), composition (COMP_1/5/6) | Rates as labelled; exempt = 0 | S3 |
| TX-016 | CFG | Create/edit a rate | Create a TaxRate under an authority → effective dates → Save | Persists; effective-from/thru honoured | S3 |
| TX-017 | EDGE | Overlapping effective dates | Two active rates for the same authority/category with overlapping dates | Record actual — which one wins; flag if ambiguous | S3 |
| TX-016a | SEC | **Rates are platform-admin-only** | As a normal tenant, open FindTaxRate | Read-only (no New/Edit/Delete); the statutory GST slabs below stay visible. Direct POST → `Only a platform administrator...` | S1 |

> **Note (ZE-TAX sweep):** Tax **Authorities & Rates are GLOBAL master data (no org)** — unlike Exemptions/Registrations they are NOT org-scoped, so every tenant sees the same list (correct). Create/edit/delete are restricted to super-admins via `store#`/`delete#TaxAuthority` and `store#`/`delete#TaxRate`; delete is refused while referenced. **Known pre-existing issue:** the zenith `tax_rate` FK points at mantle `tax_authority` (not `ZENITH_TAX_AUTHORITY`), so creating a zenith TaxRate against a zenith authority FK-fails — table is empty/unused (India uses `IndiaGstSlab`).

### 8.3 Tax Exemptions

**Screen:** `FindTaxExemption`, `EditTaxExemption`. Entity `TaxExemption` (party and/or product, type Full/ZeroRated/ReverseCharge/Export/SEZ/…, effective dates).

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-018 | CFG | Create party exemption | Exempt a party (e.g. Government) → Save | Created, org-scoped | S3 |
| TX-019 | FUNC | Exemption honoured | Bill a product/party with an **active** exemption | `check#TaxExemption` returns exempt → no GST charged on that line | S2 |
| TX-020 | EDGE | Expired exemption | Bill after the exemption's `effectiveThru` | Exemption **not** applied (GST charged); verify the date check | S3 |
| TX-021 | EDGE | Product vs party exemption | One line exempt-product, one taxable | Only the exempt line is zero-taxed | S2 |
| TX-022 | VAL | Mandatory fields on create | New Tax Exemption → leave Tax Authority / Exemption Type / both Party & Product blank → Create | **Blocked** with `Please fill the required field(s): …`; no record saved (ZE-TAX-002) | S2 |
| TX-023 | VAL | Mandatory fields on update | Open an exemption → clear Tax Authority / Type / Party+Product → Update | **Blocked** with the field list; **existing values unchanged** (not nulled) | S2 |
| TX-024 | EDGE | Effective date order | Set Effective Thru **before** Effective From → Save | Blocked: `Effective Thru cannot be before Effective From.` | S3 |
| TX-025 | UI | Edit & Delete actions present | Open the Tax Exemptions list | Each row shows an **Edit** link and a **Delete** action (ZE-TAX-004) | S2 |
| TX-026 | FUNC | Delete a record | Click **Delete** on a row → confirm | Row removed from list & DB; stays on the list | S2 |
| TX-027 | ISO | Cross-tenant delete blocked | Tenant B attempts to delete Tenant A's exemption (direct id) | **Denied** (`You do not have access to this tax exemption.`); row preserved | S1 |
| TX-028 | ISO | List is org-scoped | Log in as two tenants; compare the Exemptions list | Each tenant sees only its own exemptions; super-admin sees all | S1 |

> **Note (ZE-TAX-002/004):** at least **one of Party / Product** is required (an exemption may be party-based *or* product-based), plus Tax Authority and Exemption Type. Editing never wipes the record's org tag. Enforced server-side in `zenith.tax.TaxServices.store#TaxExemption` (create & update). **Delete** goes through `zenith.tax.TaxServices.delete#TaxExemption`, which verifies org ownership (ADMIN exempt) so a tenant can only delete its own records; the list find is org-scoped too.

---

# 9. TAX REGISTRATIONS (GSTIN) — the intra/inter-state driver

**Screen:** `FindTaxRegistration`. Entities `TaxRegistration` (+ India `IndiaGstin`, `IndiaGstConfig`). The **buyer's and seller's `regionGeoId` (state)** — derived from their GSTIN — is what decides CGST+SGST vs IGST. `get#PartyTaxRegistration(partyId)` returns the default registration's `regionGeoId`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-030 | CFG | Org GST config | Set the org's GSTIN + home state (create#GstConfig / FindTaxRegistration) | GSTIN stored; `stateCode` = GSTIN[0:2]; a TrtGstin registration exists for the org | S1 |
| TX-031 | CFG | Register a customer's GSTIN | Add a GSTIN for `CUST_SAME` (state 29) and `CUST_OTHER` (state 27) | Each party's `regionGeoId` = its GSTIN state; `isDefault` set | S1 |
| TX-032 | GST | GSTIN → state extraction | Confirm the state code the system derives | `regionGeoId` matches GSTIN first two digits for every party | S1 |
| TX-033 | GST | **GSTIN format validation** | Enter an invalid GSTIN (too short; bad state code `99`; wrong pattern; bad checksum) | `validate#Gstin` rejects with a clear reason; a valid 15-char GSTIN passes and returns state + PAN | S2 |
| TX-033a | VAL | **GSTIN format on the Registrations screen** | New/Edit Registration → Type=GSTIN (India) → number `cfsadfsdgsd` → Save | **Rejected** (`That GSTIN doesn't look valid. A GSTIN is 15 characters…`); a valid 15-char GSTIN saves (normalised to upper-case); a lowercase valid GSTIN is upper-cased; non-GSTIN types (PAN/…) are not pattern-checked (ZE-TAX-007) | S2 |
| TX-033b | FUNC | **Region filtered by Country** | New Registration (Country defaults to India) → open Region; also open an Indian registration's Edit form | Region lists only the tenant-country's states/UTs (India → 36; no Alabama/Alberta/Aichi). Filtered **server-side** by the defaulted/saved Country (ZE-TAX-008). NOTE: changing Country mid-form does NOT live-refilter Region on /qapps (depends-on isn't reactive there) — a known limitation shared with CompanySetup; the default/saved country is what filters | S2 |
| TX-034 | EDGE | Duplicate GSTIN | Register the **same** GSTIN twice | Blocked (unique index) — record actual | S2 |
| TX-035 | FUNC | Default vs multiple regs | Give a party two registrations, one `isDefault=Y` | `get#PartyTaxRegistration` returns the default (`-isDefault,-isPrimary` order) | S3 |
| TX-036 | EDGE | Party with no registration | A customer with **no** GSTIN/registration | `get#PartyTaxRegistration` returns nothing → downstream must handle (see TX-047) — record what the engine does | S2 |
| TX-037 | ISO | Registrations scoped | As tenant A, list registrations | Only A's parties/GSTINs; **no** tenant B rows (list find is org-filtered; super-admin sees all) | S1 |
| TX-038 | UI | Edit & Delete actions present | Open the Tax Registrations list | Each row shows an **Edit** link (→ EditTaxRegistration) and a **Delete** action (ZE-TAX-006) | S2 |
| TX-039 | VAL | Edit mandatory fields | Edit a registration → clear Party / Authority / Type / Number → Update | **Blocked** (`Please fill the required field(s): …`); row unchanged; reversed dates also blocked | S2 |
| TX-040 | FUNC | Delete a registration | Click **Delete** → confirm | Row removed from list & DB | S2 |
| TX-041 | ISO | Cross-tenant edit/delete blocked | Tenant B edits/deletes Tenant A's registration by direct id | **Denied** (`You do not have access to this tax registration.`); GSTIN preserved | S1 |

> **Note (ZE-TAX-006):** the Registrations list gained an Edit screen + Delete. **Edit** (`store#TaxRegistration`) and **Delete** (`delete#TaxRegistration`) both verify org ownership before mutating (ADMIN exempt) — critical because a registration's `regionGeoId` drives GST intra/inter-state, so cross-tenant tampering must be impossible. `get#PartyTaxRegistration` (the calc read) is unchanged. **ZE-TAX-007:** `create#TaxRegistration` + `store#TaxRegistration` now reject a malformed GSTIN when Type=GSTIN (India) and upper-case it (same regex as the Contacts path); onboarding callers use `ignore-error`, so an invalid GSTIN is simply skipped there rather than breaking signup.

---

# 10. GST CALCULATION — correctness (the core; do the math)

**Engine:** `calculate#Tax` → `calculate#Gst`. Rate slab resolved per line: `taxCategoryId` → `productTaxCode`(HSN) → `product.gstSlabId` → `product.hsnCode`(HSN). Exercise it through **Sales → Create Invoice → Add Item**, the **POS Terminal**, and **Purchase**, and verify the numbers **by hand**. All amounts round **HALF_UP to 2 dp**.

### 10.1 Intra vs inter-state (the single most important thing)

| ID | Type | Title | Inputs | Expected result (by hand) | Sev |
|---|---|---|---|---|---|
| GST-001 | GST | Intra-state 18% | Seller 29, buyer 29 (`CUST_SAME`), qty 10 × ₹100, 18% | taxable **1000**; **CGST 90 + SGST 90**; IGST 0; line total **1180** | S1 |
| GST-002 | GST | Inter-state 18% | Seller 29, buyer 27 (`CUST_OTHER`), qty 10 × ₹100, 18% | taxable **1000**; **IGST 180**; CGST/SGST 0; line total **1180** | S1 |
| GST-003 | GST | 5% slab intra | Seller 29, buyer 29, ₹1000, 5% | CGST 25 + SGST 25; total 1050 | S1 |
| GST-004 | GST | 28% slab inter | Seller 29, buyer 27, ₹1000, 28% | IGST 280; total 1280 | S1 |
| GST-005 | GST | Both Union Territories | Seller UT, buyer same/other UT | Treated **intra-state** (CGST + **UTGST/SGST**), not IGST — verify the UT rule | S1 |
| GST-006 | GST | Mixed-rate invoice | Item A ₹1000 @5%, item B ₹2000 @18% (intra) | A: CGST 25/SGST 25; B: CGST 90/SGST 90; header **totalCgst 115, totalSgst 115**, taxable 3000 | S1 |
| GST-007 | GST | Header totals aggregate | Any multi-line invoice | header totalCgst/totalSgst/totalIgst/totalCess = **sum of the lines**; taxable = sum of taxables | S1 |

### 10.2 CESS, inclusive pricing, rounding, exempt

| ID | Type | Title | Inputs | Expected result (by hand) | Sev |
|---|---|---|---|---|---|
| GST-010 | GST | CESS on top | ₹1000, `GST_28_CESS_12`, intra | CGST 140 + SGST 140 + **CESS 120** (= 1000×12%); tax total 400; **CESS is on taxable, not on GST** | S2 |
| GST-011 | GST | Tax-inclusive (MRP) | MRP ₹118, 18%, `isTaxInclusive=Y` | taxable = 118×100/118 = **100.00**; tax **18.00** (`calculate#TaxInclusive`) | S1 |
| GST-012 | GST | Inclusive odd number | MRP ₹100, 18%, inclusive | taxable = 100×100/118 = **84.75** (HALF_UP); tax **15.25**; taxable+tax = 100.00 | S2 |
| GST-013 | GST | Rounding per line | qty 3 × ₹99.99 @18% intra | taxable 299.97; CGST 26.9973→**26.997?** verify HALF_UP to 2dp (27.00) each side; no drift | S2 |
| GST-014 | GST | Invoice round-off | Grand total ₹1234.56 | round-off line = round(1234.56) − 1234.56 = **+0.44**; payable **1235** | S2 |
| GST-015 | GST | Exempt product | `PROD_EXEMPT` (0%) | taxable recorded; **CGST/SGST/IGST/CESS all 0**; no tax lines | S2 |
| GST-016 | GST | 0% vs exempt | A 0%-slab item vs an `isGstExempt` item | Both zero-tax; confirm doc-type impact (Bill of Supply for wholly-exempt supply) | S3 |

### 10.3 Document type, B2B/B2C, composition, export/SEZ, RCM, TCS

| ID | Type | Title | Inputs | Expected result | Sev |
|---|---|---|---|---|---|
| GST-020 | GST | B2B classification | Buyer **has** GSTIN | `b2bB2cType = B2B`; documentType **Tax Invoice** | S2 |
| GST-021 | GST | B2C small vs large | Buyer no GSTIN, total ₹2,00,000 then ₹3,00,000 | **B2C_SMALL** (<₹2.5L) then **B2C_LARGE** (≥₹2.5L) | S3 |
| GST-022 | GST | Composition → Bill of Supply | Org `isCompositionScheme=Y` | documentType **BILL OF SUPPLY** and **zero GST charged to the customer** (a composition dealer pays composition tax itself). **[Fixed b52c711 — `calculate#Tax` now returns zero tax for a composition org; verified tax 0, no CGST/SGST lines.]** | S1 |
| GST-023 | GST | Export invoice | Destination country ≠ IND (or `isExport=Y`) | documentType **EXPORT INVOICE**; **IGST 0%** under LUT (zero-rated). **[Fixed 809bc4e — `calculate#Tax` now passes the inferred `isExport` to the engine; exports default to 0% IGST (LUT), no CGST/SGST/CESS. Verified `EXPORT_LUT` → all 0. Override `isWithPayment=Y` → IGST at slab rate.]** | S1 |
| GST-024 | GST | SEZ supply | `isSezSupply=Y` | supplyType **SEZ**; **IGST 0%** under LUT (zero-rated) even intra-state. **[Fixed 809bc4e — SEZ now defaults to LUT 0% (was IGST at slab rate); `isWithPayment=Y` charges IGST for the with-payment model. Verified `SEZ_LUT` → all 0, `SEZ_WITH_IGST` → IGST 180.]** | S1 |
| GST-025 | GST | Reverse charge (RCM) | Invoice `isReverseCharge=Y` | Under RCM the **seller does not collect GST** (buyer self-assesses). **[Fixed b52c711 + wired 809bc4e — engine zeroes collected tax; the EditInvoice screen has a Reverse Charge toggle that flips the flag and re-taxes every draft line (verified: ON → item+header CGST/SGST 0; OFF → restored), and `add#InvoiceItem`/`create#SalesInvoice` pass the invoice's RCM flag.]** Verify `itcEligible` behaves per RCM | S1 |
| GST-026 | GST | TCS threshold | Cumulative sales cross the threshold | TCS (0.1%) applies via `TcsCumulativeTracker` on the amount exceeding **₹50,00,000 (₹50 lakh)** — **confirmed correct per §206C(1H)** (code `limit=5000000`, rate 0.001). No change needed | S3 |

### 10.4 The engine's edge cases (probe hard)

| ID | Type | Title | Inputs | Expected result | Sev |
|---|---|---|---|---|---|
| GST-030 | EDGE | **B2C to another state** | `CUST_B2C` (no GSTIN) whose delivery is in a **different** state; goods sale | The engine defaults a **GSTIN-less** buyer to the **seller's** state → **intra-state (CGST+SGST)**. This is the correct legal default when the buyer's location is unknown (POS falls back to seller state). If the app later captures a B2C delivery state, place-of-supply should switch to IGST — record actual | S3 |
| GST-031 | EDGE | Consistent GSTIN-less default across paths | Same product billed via **POS**, **Sales `add#InvoiceItem`**, and the **Sales EditInvoice screen** with a GSTIN-less buyer | All three now default to **intra-state (CGST+SGST)**. **[Fixed b52c711 — the EditInvoice screen `addItem` previously defaulted `isInterstate=true` (wrongly IGST); now defaults intra, matching the engine and `add#InvoiceItem`.]** | S2 |
| GST-032 | EDGE | Unknown HSN | Product with an HSN not in `IndiaHsnCode` | No slab resolved → verify it errors clearly or falls back sensibly (not silently zero-tax) | S2 |
| GST-033 | EDGE | No slab on product | Product with no `gstSlabId`/HSN/category | Verify a clear failure, not a silent 0% (a taxed good billed at 0% is an under-charge) | S2 |
| GST-034 | EDGE | Negative / credit note | A credit note (negative amounts) | Tax reverses proportionally (negative CGST/SGST/IGST); split matches the original | S2 |
| GST-035 | PERF | Engine warm-up | First POS sale after opening a session | POS pre-warms the engine on `open#PosSession`; first real sale is fast (no ~1s cold-start) | S3 |

---

# 11. HSN / SAC

Products carry `hsnCode` (8-char) / `sacCode`; `IndiaHsnCode` maps a code → `defaultGstSlabId`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-050 | FUNC | HSN → rate resolution | Product with only an HSN (no direct slab) | Engine resolves the slab from the HSN master | S2 |
| TX-051 | GST | HSN on the invoice/PDF | Print/inspect an invoice | Each line shows its **HSN/SAC**; GSTR-1 HSN summary groups by HSN + rate | S2 |
| TX-052 | EDGE | HSN validation | `validate#HsnSacCode` on a good vs junk code | Valid returns the default slab; junk is flagged | S3 |

---

# 12. E-INVOICE (IRN)

**Entities/services:** `IndiaEinvoice`, `EinvoiceServices.generate#Einvoice/cancel#Einvoice`. Pushes a NIC-format JSON to the IRP and stores IRN + signed QR.

> ⚠️ **Confirm the target is NIC sandbox or a mock before generating.** Do not push test data to a real/production IRP.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-060 | FUNC | Generate e-Invoice | On a B2B tax invoice, generate e-Invoice | Returns a 64-char **IRN**, ack no./date, signed QR; `IndiaEinvoice` row `GENERATED`. **[Fixed e744058 — was failing to persist (null PK); now works. Guards added: rejects Bill of Supply/composition, requires supplier GSTIN + a registered buyer (B2B) or export/SEZ + HSN on every line. Verified B2C correctly rejected.]** | S2 |
| TX-061 | GST | JSON payload correct | Inspect the NIC JSON | Real seller/buyer legal names (not placeholders), GSTIN + state, item HSN/qty/rate, **CGST/SGST vs IGST** matching the invoice, correct **SupTyp** (B2B/EXPWP/EXPWOP/SEZWP/SEZWOP) + **RegRev**, ValDtls incl. round-off tie to the invoice. **[Fixed e744058.]** ⚠ Still MOCK: the NIC API call (random IRN) — real filing needs NIC credentials | S1 |
| TX-062 | FUNC | Cancel e-Invoice | Cancel with a reason | Status `CANCELLED`, reason/date stored | S3 |
| TX-063 | EDGE | e-Invoice on B2C / exempt | Try to generate for a B2C or Bill-of-Supply doc | Handled per rule (e-Invoice is B2B/export only) — record actual | S3 |
| TX-064 | FUNC | QR code | Generate the QR | Base64 QR renders; encodes the signed invoice | S3 |

---

# 13. E-WAY BILL

**Entities/services:** `IndiaEwayBill`, `EwayBillServices.generate#EwayBill/update#EwayBillPartB/cancel#EwayBill`. (Also see Part 5 — inter-state stock transfers.)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-070 | FUNC | Generate e-Way Bill | For an invoice > ₹50,000, generate with transporter + vehicle | Returns an e-Way Bill number; `validUpto` = ceil(distance/200) days (min 1) | S2 |
| TX-071 | GST | Payload state codes | Inspect the payload | from/to GSTIN + state codes, HSN, taxable value, CGST value, transport mode correct | S2 |
| TX-072 | FUNC | Update Part B | Add/change the vehicle number | Part B updated | S3 |
| TX-073 | EDGE | Below threshold | Invoice ≤ ₹50,000 | e-Way Bill not required — verify it's not forced | S3 |
| TX-074 | FUNC | Cancel | Cancel with a reason | Status updated | S3 |

---

# 14. GST RETURNS — GSTR-1 (outward supplies)

**Screen:** `Gstr1Returns`. Services `generate#Gstr1Data`, `export#Gstr1Json`. Aggregates the period's sales invoices into B2B, B2C(S), and HSN summaries.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| TX-080 | FUNC | Generate GSTR-1 | Pick a return period (MMYYYY) → Generate | A `Gstr1Filing` (DRAFT) with B2B / B2C(S) / HSN sections populated. **[Implemented e744058 — real aggregation replaced the mock stub; the screen's broken service call was repointed. Verified: B2B IGST 180, B2C(S) CGST/SGST 45, 2 HSN rows, real GSTN-schema JSON.]** | S2 |
| TX-081 | GST | **Totals tie to invoices** | Cross-check the return against the period's invoices | B2B taxable + tax = sum of B2B invoices; B2C(S) grouped by **place of supply + rate**; B2C(L) for inter-state unregistered >₹2.5L; HSN summary groups by HSN + rate; **grand totals reconcile** | S1 |
| TX-082 | GST | B2B vs B2C split | Mix registered + unregistered buyers | Registered → **B2B** (by buyer GSTIN); unregistered → **B2C(S)** (by POS + rate) | S1 |
| TX-083 | FUNC | Download JSON | Download the GSTR-1 JSON | Valid GSTN-schema JSON (gstin, fp, b2b[], b2cs[], hsn[]) | S2 |
| TX-084 | EDGE | Cancelled invoices excluded | Include a cancelled invoice in the period | Excluded from the return | S2 |
| TX-085 | EDGE | Empty period | A period with no sales | Clean empty return; no crash | S3 |

---

# 15. MULTI-TENANT ISOLATION (high priority)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ISO-001 | ISO | Registrations scoped | Tenant A lists Tax Registrations | Only A's parties/GSTINs | S1 |
| ISO-002 | ISO | Exemptions/rates/authorities scoped | A lists each config screen | Only A's rows (org-scoped ones); shared master data (slabs/states) is read-only reference | S1 |
| ISO-003 | ISO | GSTR-1 scoped | A generates/lists GSTR-1 | Only A's invoices aggregated; B's never appear | S1 |
| ISO-004 | ISO | Direct-URL edit | A opens B's `EditTaxRate`/`EditTaxExemption`/registration by id | Blocked / not found | S1 |
| ISO-005 | ISO | e-Invoice / e-Way scoped | A views IRN/e-Way records | Only A's | S1 |
| ISO-006 | ISO | Engine uses the right org | Bill on tenant A | `calculate#Tax` uses A's GST config/state, never B's | S1 |

---

# 16. UI / ACCESSIBILITY / SECURITY (+ related reports)

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| TX-090 | UI | Desktop layout | All tax screens at 1920/1366 | Slab/rate tables aligned; no overflow | S4 |
| TX-091 | UI | Mobile layout | Config + registration forms at 360–390px | No horizontal scroll; date pickers usable | S3 |
| TX-092 | A11Y | Keyboard | Tab through a registration/rate form | Logical order; Enter submits; visible focus | S3 |
| TX-093 | SEC | XSS in free text | `<img src=x onerror=alert(1)>` in legal name / exemption number / GSTIN label | Escaped everywhere (screens, PDFs, GSTR-1 JSON); never executes | S1 |
| TX-094 | SEC | CSRF | (Dev-assisted) POST a create-registration / generate-return without the session token | Rejected | S2 |
| TX-095 | FUNC | Related reports | Open Accounting → GST Reports / GSTR-2 / GSTR-3B | Render, org-scoped, tie to the ledger (deep-test in the Accounting SOP) | S3 |

---

## 17. Cross-flow / regression & defect template

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-001 | GST | Same product, four callers | Bill the same 18% item intra-state via **POS**, **Sales invoice**, **Purchase**, and inspect a **stock-transfer** IGST invoice → all compute CGST 9 + SGST 9 (POS/Sales/Purchase) and the transfer gives IGST inter-state; **numbers identical across callers** | S1 |
| XF-002 | GST | State change mid-flow | Change the buyer's GSTIN state between quote/order and invoice → split flips CGST/SGST ↔ IGST correctly | S1 |
| XF-003 | GST | Invoice → GSTR-1 | An invoice's CGST/SGST/IGST + HSN flow into the correct GSTR-1 section and totals tie out | S1 |
| XF-004 | GST | Invoice → e-Invoice → e-Way | IRN JSON and e-Way payload carry the same GSTINs, states, HSN and tax split as the invoice | S1 |
| XF-005 | ISO | End-to-end isolation | Nothing tenant A configures or files is visible/usable by tenant B | S1 |

```
Defect ID:        ZE-TAX-____
Linked Case ID:   TX-0__ / GST-0__ / ISO-0__ / XF-0__
Title / Severity / Type:
Environment:      Prod | <browser> | tenant: <org>
Inputs:           seller state, buyer state, rate/slab, amount, inclusive?, RCM/SEZ/export flags
Expected (by hand): taxable, CGST, SGST, IGST, CESS, round-off, grand total, document type
Actual:           (same fields) — attach screenshot + Console/Network
Documents touched: invoice / registration / filing / IRN / e-Way ids
```

---

## 18. Areas to probe hardest (attention map)

These are the highest-risk spots — spend extra time here:

1. **Intra vs inter-state split (GST-001/002, XF-001)** — the single most important thing. CGST+SGST for same-state, IGST for cross-state, driven by the parties' GSTIN state. Do the math by hand on every caller (POS, Sales, Purchase, Transfer).
2. **The default when a buyer has no GSTIN / no state (GST-030, GST-031, TX-036)** — all paths (POS, `add#InvoiceItem`, EditInvoice screen) now default a GSTIN-less buyer to the **seller's** state → intra-state (CGST+SGST), the correct default when the buyer location is unknown. **[Fixed b52c711 — the EditInvoice screen previously defaulted to IGST.]** Still re-verify the three callers agree after any tax change.
3. **Composition scheme (GST-022)** — must issue a **Bill of Supply with no GST charged to the customer**. **[Fixed b52c711 — `calculate#Tax` now returns zero tax for a composition org.]** Re-verify no CGST/SGST lines appear.
4. **Reverse charge (GST-025)** — the **seller must not collect** GST. **[Fixed b52c711 — `calculate#Gst` now zeroes the collected tax under `isReverseCharge=Y`.]** Re-verify the buyer isn't charged and ITC/accounting is right; the per-invoice RCM flag wiring from the UI is a separate follow-up.
5. **CESS (GST-010)** — charged on the **taxable value**, on top of GST, not on the GST amount.
6. **Tax-inclusive extraction & rounding (GST-011..014)** — `taxable = MRP×100/(100+rate)`, HALF_UP 2dp per amount, invoice total to nearest rupee. A drifting paisa on many lines compounds.
7. **Export / SEZ zero-rating (GST-023/024)** — 0% IGST, correct document type, LUT/shipping-bill fields.
8. **GSTR-1 reconciliation (TX-081/082, XF-003)** — the return's B2B/B2C(S)/HSN totals must tie exactly to the period's invoices; cancelled invoices excluded.
9. **e-Invoice / e-Way payload fidelity (TX-061/071, XF-004)** — GSTIN, state, HSN, and the CGST/SGST/IGST split in the JSON must match the invoice. **Never push test data to a real NIC portal.**
10. **Multi-tenant isolation of tax data (§15)** — GSTINs and returns are sensitive; any cross-tenant leak is Critical.

---

## 19. Teardown (mandatory)

1. **List every test artefact** — registrations, exemptions, authorities/rates you added, invoices, GSTR-1 filings, e-Invoice (IRN) and e-Way Bill records — with ids.
2. **Do not file/submit** any return, e-Invoice or e-Way Bill to a real portal. If the environment was pointed at the real NIC by mistake, stop and tell the dev.
3. **Cancel/void** test invoices and their IRN/e-Way records; **delete** test registrations/exemptions/filings (or hand the list to the dev).
4. Delete any **exports/PDFs/JSON** generated on the test machine.
5. Confirm you **never touched MARUTHI** (org `100000`) or any live tenant's tax config or documents.
6. Attach the run sheet(s) + defect ids to this part's report.

---

*End of Part 6 — Tax. Related: Part 3 — POS (billing calls the GST engine); Part 4 — Sales (invoice GST); Part 5 — Inventory (inter-state transfer IGST + e-Way); Accounting holds GSTR-2/GSTR-3B and the tax ledger.*

*Reviewed and fixed/confirmed: composition (zero GST / Bill of Supply), reverse-charge (seller collects zero + UI toggle), the GSTIN-less intra default, export/SEZ zero-rating (LUT 0% default with a per-invoice with-payment override), TCS (₹50 lakh @ 0.1%) — commits b52c711, 809bc4e; **real GSTR-1 generation** (B2B/B2CL/B2CS/HSN/Export + GSTN JSON, replacing the mock), **e-Invoice & e-Way payload fidelity + compliance guards** (real party names, correct supply types, safe state/HSN, round-off, null-PK persistence), and **ITC treatment for composition/RCM vendor bills** — commits e744058, 48cc82a.*

***The one remaining go-live dependency is the real NIC / GSTN portal integration** — the e-Invoice IRN, e-Way Bill number, and GSTR-1 filing are still generated locally as MOCKs (the JSON payloads are now faithful, but no data is transmitted). Wiring the live NIC/GSTN APIs needs the tenant's API credentials and is a deliberate go-live step — do not enable it against production without those credentials and a controlled cutover.*
