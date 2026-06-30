# ZetaERP — Manual Bug-Testing SOP
## Part 2 — Contacts (Customers, Vendors, Directory, Profiles, Groups)

| | |
|---|---|
| **Document** | QA-SOP-02 — Contacts |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The **Contacts** module only: Dashboard, Customers, Vendors, All-Contacts directory, the Contact profile (tax / bank / credit / addresses / phones / emails / tags / GSTIN), Customer Groups, and de-duplication (merge). Sales, Accounting and Purchase are linked-to but covered in their own parts. |
| **Audience** | Manual QA tester (no code knowledge assumed) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-01 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Contacts module end-to-end (A→Z)** — creating people and companies, editing their full business profile, searching and filtering, grouping, exporting, merging duplicates — including the **edge cases**, the **multi-tenant isolation** cases, the **security** cases, and the **visual/UI** cases, and **how to record a defect** when behaviour differs from the *Expected Result*.

Work top-to-bottom in one session. Don't skip a case because "it obviously works" — the value of an SOP is the non-obvious cases.

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system with real paying tenants.**

1. **Never edit, disable, merge, or delete a real contact** belonging to the live flagship tenant **MARUTHI (Organization ID `100000`)** or any other real tenant. Create your **own** clearly-labelled test contacts (e.g. names starting with `QA_`) and operate only on those.
2. **Merge is effectively irreversible.** `Merge Contacts` moves all phones/emails/addresses/tax records from one party onto another and records it in merge history. **Only ever merge two QA test contacts you created.** Never merge a real contact.
3. **Never fabricate legal/tax data** (GSTIN, PAN, CIN, TAN, bank account, FSSAI/drug/trade licences). Use clearly-fake QA values, or values the owner supplies — never invent a number that could collide with a real registration.
4. **Org isolation is the highest-risk surface here.** If you can ever see another tenant's customers/vendors, that is a **Critical** defect — capture it immediately (§13, ISO cases).
5. **Clean up every test contact, group, tag, and address** you create (see §19 Teardown), or hand the list to the dev for removal.
6. **Don't export real customer data** (CSV/XLSX) off the machine. Exports contain names, phones, emails, GSTINs — treat as confidential.

---

## 3. Test environment & preconditions

The Contacts module opens from the app menu → **Contacts**. Screen URLs (both `/apps` and `/qapps` render these Quasar screens):

| Screen | URL |
|---|---|
| Contacts Dashboard | `…/zenith/Contacts/ContactsDashboard` |
| Customers (list) | `…/zenith/Contacts/Customers` |
| Vendors / Suppliers (list) | `…/zenith/Contacts/Vendors` |
| All Contacts (directory) | `…/zenith/Contacts/FindContact` |
| Contact profile (open/edit) | `…/zenith/Contacts/EditContact?partyId=<id>` |
| Customer Groups | `…/zenith/Contacts/CustomerGroups` |
| Edit Customer Group | `…/zenith/Contacts/EditCustomerGroup?customerGroupId=<id>` |

**Log in as a tenant user** (a user attached to a shop) so an **active organization** is set — that is what scopes the lists. Note the platform super-admin (john.doe, no active org) **sees all tenants' contacts by design** and is therefore *not* the right account for isolation testing — use a tenant login.

**Browsers:** run the full pass on Desktop Chrome; spot-check Edge, Mac/iOS Safari, Android Chrome. **Viewports for UI cases:** 1920, 1366, iPad (768/1024), iPhone (390), small Android (360). **Tools:** DevTools (Console + Network), an incognito window, a QA email inbox.

---

## 4. Test data

Create as you go; record exact values in the *Actual* column of your run sheet.

| Label | Use | Example |
|---|---|---|
| `QA_PERSON_A` | A person customer | First "QA Asha", Last "Test" |
| `QA_COMPANY_A` | A company customer | "QA Alpha Traders Pvt Ltd" |
| `QA_VENDOR_A` | A supplier | "QA Supply Co" |
| `QA_DUP_1` / `QA_DUP_2` | Two near-identical contacts for the **merge** test | same name + phone |
| `QA_GROUP_A` | A customer group | "QA Wholesale" |
| Fake GSTIN | 15 chars, clearly test | a dummy 15-char string the dev approves |
| Fake PAN | 10 chars | e.g. `ABCDE1234F`-style dummy |
| Malicious string | Security tests | `<img src=x onerror=alert(1)>` and `"><b>X</b>` |

---

## 5. Conventions & severity

**Case Type:** `FUNC` · `EDGE` · `UI` · `A11Y` · `SEC` · `PERF` · `ISO` (multi-tenant isolation).

| Sev | Meaning | Example |
|---|---|---|
| **S1 — Critical** | Cross-tenant data exposure, data loss, security hole | A tenant sees another tenant's customers; merge deletes the wrong party; stored XSS executes |
| **S2 — High** | Major flow broken / wrong, workaround exists | Can't create a contact; saved profile doesn't persist; export leaks the wrong rows |
| **S3 — Medium** | Wrong behaviour, limited impact | Disabled customer still appears in a list; GSTIN format not validated |
| **S4 — Low** | Cosmetic / minor UX | Avatar initial wrong; column misaligned on mobile |

**Logging a defect** (template in §18): Case ID, steps, expected vs actual, browser/device, screenshot, and any Console/Network capture.

---

## 6. Flow map (what you are testing)

```
                       ┌────────────────────────────────────────────┐
   Contacts Dashboard ─┤  Total Customers • Total Suppliers          │
   (counts + quick add)│  Add Person / Add Company                   │
                       └───────────────┬────────────────────────────┘
        ┌──────────────────────────────┼───────────────────────────────┐
        ▼                              ▼                                ▼
   Customers list              Vendors/Suppliers list           All Contacts (directory)
   (role=Customer)             (role=Vendor/Supplier)           search GSTIN/PAN/CIN/email/phone
        └───────────── click a name ──────────────┬──────────────────────┘
                                                   ▼
                            ┌─────────────────────────────────────────────┐
                            │  CONTACT PROFILE (EditContact)              │
                            │  basic · tax(GST/PAN/CIN/TAN/TDS) · MSME ·  │
                            │  bank · licences · credit · price list      │
                            │  + GSTIN records · tags · emails · phones · │
                            │    addresses · roles · sales/purchase history│
                            └─────────────────────────────────────────────┘
   Customer Groups ── group (price list / discount / credit terms) ── add/remove members
   Merge Contacts ── pick survivor + duplicate ── moves all sub-records ── records history
```

---

# 7. CONTACTS DASHBOARD

**Screen:** `…/Contacts/ContactsDashboard`. Shows **Total Customers** and **Total Suppliers** counts (scoped to your organization), quick **Add Person / Add Company** dialogs, and links to the lists.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-001 | FUNC | Dashboard renders | Open the dashboard | Two metric cards (Total Customers, Total Suppliers) with numbers, Add Person / Add Company buttons, and View Customers / View Vendors / Manage Directory links | S3 |
| CT-002 | FUNC | Counts are correct & org-scoped | Note the counts; cross-check against the Customers and Vendors lists | Counts equal the number of rows in each list for **your** organization only | S2 |
| CT-003 | FUNC | Quick Add Person | Add Person → fill name/email/phone/PAN/role → Save | Contact created and you land on its profile (EditContact) | S2 |
| CT-004 | FUNC | Quick Add Company | Add Company → fill business name + GST/PAN → Save | Company created, lands on its profile | S2 |
| CT-005 | UI | Empty state | A brand-new tenant with no contacts | Counts show 0; no broken cards; Add buttons still work | S3 |

---

# 8. CREATE A CONTACT

Contacts can be created from the Dashboard, Customers, Vendors, or All-Contacts screens. **Person** vs **Company** (organization) are the two types; **Customer** vs **Vendor** is the role.

### 8.1 Happy path

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-010 | FUNC | Create person customer | Customers → Add Person → First/Last/email/phone → Save | Person created with role Customer; opens profile; shows in Customers list | S2 |
| CT-011 | FUNC | Create company customer | Customers → Add Company → Business name/email/phone → Save | Company created; Type shows "Business/Organization" | S2 |
| CT-012 | FUNC | Create vendor | Vendors → Add Company/Person → Save | Created with role Vendor/Supplier; appears in Vendors, not necessarily Customers | S2 |
| CT-013 | FUNC | Create with full tax detail | All Contacts → Add Company → fill GSTIN, PAN, GST registration type, TDS | All values saved and visible on the profile and in the directory's Tax Info column | S2 |
| CT-014 | FUNC | Role choice respected | All Contacts → Add Person, set Role = Vendor | Contact appears under Vendors, not Customers | S2 |

### 8.2 Validation & edge cases

| ID | Type | Title | Steps / data | Expected result | Sev |
|---|---|---|---|---|---|
| CT-020 | EDGE | Create with **no name** | Add Person, leave first & last blank, Save | **FIXED:** rejected with "Please enter a first or last name." (companies: "Please enter a business name.") — no more blank "Unknown" contacts | S3 |
| CT-021 | EDGE | Duplicate contact allowed | Create `QA Asha Test` twice with the same phone | **Record actual.** No duplicate detection exists — both are created. The fix path is **Merge** (§12). Flag if you expect a "possible duplicate" warning | S3 |
| CT-022 | EDGE | GSTIN wrong format/length | Enter `12ABC` or a 15-char string that isn't a real GSTIN pattern | **FIXED end-to-end:** GSTIN now saves (both the create dialog's field and the profile's "Add GST Number" form), is **validated** to the 15-char Indian format (e.g. `29ABCDE1234F1Z5`), the **state code is derived** from the first two digits, and **duplicates are rejected**. A bad GSTIN at create rolls the whole create back (no orphan contact) | S3 |
| CT-023 | EDGE | PAN wrong format | Enter `1234567890` (digits) instead of `ABCDE1234F` | Field caps at 10 chars; **no format validation** — record whether a bad PAN saves | S3 |
| CT-024 | EDGE | Email invalid | `not-an-email` | Record whether it's rejected or saved as-is (the create dialog may not validate email format) | S3 |
| CT-025 | EDGE | Phone with letters / very long | `abcd`, or a 30-digit number | Record behaviour — should reject or trim, never 500 | S3 |
| CT-026 | EDGE | Credit limit / opening balance non-numeric | Enter `abc` in Credit Limit on the profile | Should be rejected with a clear message, not a server error | S3 |
| CT-027 | EDGE | Very long name | 200-char business name | Saved/handled gracefully; list/profile don't break layout | S4 |
| CT-028 | SEC | **Script in the name** | Create a contact named `<img src=x onerror=alert(1)>` then open **All Contacts** | **HARDENED (two layers):** (1) the framework input filter **rejects** `<`/`>` on submit, so the payload won't even save via the form; (2) the directory now **HTML-escapes** every value before rendering, so any value that arrives via import/DB shows as literal text, not markup. Expected: the name is refused or shown as plain text — never executes | S1 |

---

# 9. CUSTOMERS & VENDORS LISTS

**Customers:** `…/Contacts/Customers` (roles Customer / CustomerBillTo). **Vendors:** `…/Contacts/Vendors` (roles Vendor / Supplier). Same layout; different role filter and heading.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-040 | FUNC | Customers list renders | Open Customers | Columns: ID (link), Customer Name, Type badge, GST Number (+ "Valid" badge when present), PAN, Actions (Orders, Invoices) | S2 |
| CT-041 | FUNC | Open a profile | Click an ID or name | Opens that contact's EditContact profile | S2 |
| CT-042 | FUNC | Column search — company | Type a company name in the Company Search box → Find | Only matching companies listed | S2 |
| CT-043 | FUNC | Column search — first/last name | Search by first or last name | Matching people listed | S2 |
| CT-044 | FUNC | Filter by Type | Set Type = Person / Organization | List filters accordingly | S3 |
| CT-045 | FUNC | Search by ID | Enter a partyId | That contact found | S3 |
| CT-046 | EDGE | No-match search | Search a string that matches nothing | Empty list with no error (not a crash) | S3 |
| CT-047 | FUNC | Vendors list | Open Vendors, repeat the search cases | Shows only suppliers; heading reads "Suppliers" | S2 |
| CT-048 | EDGE | A contact that is both Customer & Vendor | Create one, set both roles | Appears correctly in both lists; no duplicate row weirdness within a list | S3 |
| CT-049 | EDGE | Disabled customer visibility | Disable a customer (profile → Disabled = Yes), return to Customers | **FIXED:** the Customers and Vendors lists now hide disabled contacts, consistent with the All-Contacts directory | S3 |
| CT-050 | FUNC | Actions links | Click "Orders" / "Invoices" on a row | Opens the Sales orders / Accounting invoices filtered to that customer (or shows the module-locked behaviour if the plan excludes it) | S3 |

---

# 10. ALL CONTACTS (Directory)

**Screen:** `…/Contacts/FindContact`. The full directory with rich profile / contact / tax columns and the widest search.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-060 | FUNC | Directory renders | Open All Contacts | Each row shows an avatar+name+type+ID block, contact info (email/phone), and a Tax Info block (GSTIN/PAN/CIN/TDS/MSME badges) | S2 |
| CT-061 | FUNC | Search by GSTIN | Enter a known GSTIN | Matching contact(s) listed | S2 |
| CT-062 | FUNC | Search by PAN / CIN | Enter PAN, then CIN | Matching contacts found | S3 |
| CT-063 | FUNC | Search by email / phone | Enter a known email, then phone | Matching contacts found | S2 |
| CT-064 | FUNC | Disabled excluded | Disable a contact, search for it here | It does **not** appear (directory hides disabled) | S3 |
| CT-065 | FUNC | Add from directory | Add Person / Add Company with PAN/GSTIN/TDS/role | Created and opens profile | S2 |
| CT-066 | SEC | XSS via tax/contact fields | Put `"><b>X</b>` into a name/GSTIN, view directory | Renders as literal text, not markup (see CT-028 — same render path) | S1 |
| CT-067 | PERF | Large directory | A tenant with many contacts | List paginates; search stays responsive | S3 |

---

# 11. CONTACT PROFILE (Edit Contact)

**Screen:** `…/Contacts/EditContact?partyId=<id>`. The full business profile, plus sub-sections for GSTIN, tags, emails, phones, addresses, and read-only sales/purchase history.

### 11.1 Main profile form

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-080 | FUNC | Banner | Open any profile | Avatar (first letter), name, "ID • Person/Organization", tag badges, "Disabled" badge if disabled | S3 |
| CT-081 | FUNC | Edit basic details | Change name / business structure → Save Contact Profile | Persists after reload; banner updates | S2 |
| CT-082 | FUNC | Tax block | Set PAN, GST registration type, CIN, TAN, TDS Applicable, Default TDS Section → Save | **FIXED:** all persist after reload (these profile fields — tax, MSME, bank IFSC/UPI, licences, business structure — were previously dropped on save and now save). PAN is validated (10-char `ABCDE1234F`, blank allowed) and upper-cased; a malformed PAN is rejected without losing the rest | S2 |
| CT-083 | FUNC | MSME & payment terms | Set MSME status, Udyam no., Mandatory Payment Days → Save | Persist | S3 |
| CT-084 | FUNC | Bank details | Set account name/number, IFSC, UPI, beneficiary status → Save | Persist | S2 |
| CT-085 | FUNC | Licences | Set FSSAI / Drug / Trade licence → Save | Persist | S3 |
| CT-086 | FUNC | Credit settings | Set Credit Limit, Credit Days, Opening Balance, Price List → Save | Persist; currency symbol shown in labels | S2 |
| CT-087 | FUNC | Disable / re-enable | Set Disabled = Yes → Save; check lists; set back to No | "Disabled" badge shows; contact drops out of All-Contacts; re-enabling restores it | S2 |
| CT-088 | EDGE | Quick actions carry the contact | Click New Quote / New Order / New PO / New Invoice | Opens that screen pre-filled with this contact as customer/vendor | S3 |
| CT-089 | EDGE | Numeric guards | Put text in Credit Days / Mandatory Payment Days | Rejected cleanly (no 500) | S3 |

### 11.2 GSTIN records, tags

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-100 | FUNC | Add GSTIN record | GSTIN Records → Add GST Number (GSTIN, type, state) | Row added to the GSTIN table | S2 |
| CT-101 | EDGE | Multiple GSTINs | Add a second GSTIN (different state) | Both listed (a business can have one GSTIN per state) | S3 |
| CT-102 | EDGE | Bad GSTIN record | Add a malformed GSTIN | Record whether validated; today likely saved as-is | S3 |
| CT-103 | FUNC | Add tag | Tags → Add Tag → name → Add | Tag appears as a badge in the banner and the Tags list | S3 |
| CT-104 | FUNC | Remove tag | Click Remove on a tag | Tag disappears from list and banner | S3 |
| CT-105 | SEC | Tag XSS | Add a tag `<b>x</b>` | Renders as text, not markup | S2 |

### 11.3 Emails, phones, addresses

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-110 | FUNC | Add email + purpose | Add Email (Primary/Billing/Shipping/Other) | Row added with the purpose | S2 |
| CT-111 | FUNC | Add phone + purpose | Add Phone (country code default 91, number, purpose) | Row added; displays as `+91 …` | S2 |
| CT-112 | FUNC | Add address | Add Address (line1/2, city, PIN, state, purpose) | Row added; state dropdown is the company's country regions | S2 |
| CT-113 | EDGE | PIN code length | Enter a 5- or 7-digit PIN | Capped at 6; record if non-numeric is allowed | S3 |
| CT-114 | EDGE | Multiple primaries | Add two "Primary" emails/phones | Record behaviour — both saved, or the new one supersedes? Flag if ambiguous | S3 |
| CT-115 | FUNC | Roles section | Scroll to Roles | Lists the contact's roles (Customer/Vendor/etc.) | S4 |

### 11.4 Sales / purchase history (read-only)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-120 | FUNC | History shows for a real customer | Open a customer who has invoices/orders | Recent Invoices / Sales Orders / Quotations populate with clickable numbers | S3 |
| CT-121 | FUNC | Vendor history | Open a supplier with POs/bills | Recent Purchase Orders / Vendor Bills populate | S3 |
| CT-122 | FUNC | Empty history | New contact | "No invoices yet." / "No orders found." etc. — graceful empty states | S4 |
| CT-123 | ISO | History is this contact's only | — | History only shows documents for **this** party, nothing leaked from others | S2 |

---

# 12. CUSTOMER GROUPS & MERGE

### 12.1 Customer Groups

**Screens:** `…/Contacts/CustomerGroups`, `…/Contacts/EditCustomerGroup`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-130 | FUNC | Create group | CustomerGroups → fill Group Name, Type, Price List, Default Discount %, Credit Term, Default Credit Limit, Payment Terms → Create | Group created and listed | S2 |
| CT-131 | FUNC | Edit group | Open a group → change details, set Active → Update | Persists | S3 |
| CT-132 | FUNC | Add member | Edit group → add a customer | Member appears; "Members (n)" count increments | S2 |
| CT-133 | FUNC | Remove member | Remove a member | Count decrements; member gone | S3 |
| CT-134 | EDGE | Discount % bounds | Set discount to `-5` or `200` | Record whether bounded (0–100) | S3 |
| CT-135 | ISO | Groups org-scoped | — | A tenant only sees its own groups | S1 |

### 12.2 Merge duplicates (destructive — QA contacts only)

> ⚠️ Only ever merge **two test contacts you created**. Merge moves all sub-records onto the survivor and records merge history; treat as irreversible.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| CT-140 | FUNC | Merge two duplicates | Create `QA_DUP_1` (with phone A) and `QA_DUP_2` (with email B). Merge → survivor `QA_DUP_1`, merged `QA_DUP_2` | Survivor now has **both** phone A and email B; the merged party is retired; merge recorded in history | S2 |
| CT-141 | EDGE | Merge moves tax records | Give each a different GSTIN, then merge | Survivor carries both tax registrations; none lost | S2 |
| CT-142 | EDGE | Self-merge guard | Try to merge a party with itself | Rejected / no-op, not a crash | S3 |
| CT-143 | FUNC | History link integrity | After merge, open documents that pointed at the merged party | They resolve to the survivor (no broken references) | S2 |

---

# 13. MULTI-TENANT ISOLATION (highest priority)

Every list filters on `ownerPartyId = your active organization`. These are the **most important** cases in this part.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ISO-001 | ISO | Customers scoped | Log in as Tenant A; open Customers | Only Tenant A's customers — never another tenant's | S1 |
| ISO-002 | ISO | Vendors scoped | Same, Vendors | Only Tenant A's suppliers | S1 |
| ISO-003 | ISO | Directory scoped | Same, All Contacts | Only Tenant A's contacts | S1 |
| ISO-004 | ISO | Dashboard counts scoped | Compare counts across two tenants | Each tenant's counts reflect only its own contacts | S1 |
| ISO-005 | ISO | Direct-URL profile of another tenant | As Tenant A, open `EditContact?partyId=<a Tenant-B contact id>` | **FIXED (was a real IDOR):** the profile now enforces ownership — a non-owner is redirected to the directory and sees nothing; the underlying edit/add services reject it too. Platform super-admins remain able to view any contact by design | S1 |
| ISO-006 | ISO | New contact is tagged to your org | Create a contact as Tenant A, then log in as Tenant B | Tenant B does not see it | S1 |
| ISO-007 | ISO | Customer Groups scoped | Each tenant sees only its own groups | Confirmed | S1 |
| ISO-008 | ISO | Search can't cross tenants | As Tenant A, search a GSTIN/phone you know belongs to Tenant B | No Tenant-B result returned | S1 |

---

# 14. UI / LAYOUT / ACCESSIBILITY / EXPORT / SECURITY

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| CT-160 | UI | Desktop layout | Lists & profile at 1920 / 1366 | Cards aligned; tables not clipped; no horizontal overflow | S4 |
| CT-161 | UI | Mobile layout | Lists & profile at 360–390px | No horizontal scroll; the profile's many sections stack readably; dialogs fit | S3 |
| CT-162 | UI | Add dialogs on mobile | Open Add Person / Add Company on a phone | Dialog fits screen; fields reachable; Save works | S3 |
| CT-163 | A11Y | Keyboard | Tab through a create dialog and the profile form | Logical order; visible focus; Enter submits | S3 |
| CT-164 | UI | Long values | Long names / GSTIN / address | Wrap or truncate gracefully; no broken cells | S4 |
| CT-165 | FUNC | CSV export | Export Customers / All Contacts to CSV | File downloads; rows match the on-screen (filtered, org-scoped) list; the directory CSV uses plain-text (no HTML) | S2 |
| CT-166 | FUNC | XLSX export | Export to XLSX | Opens in Excel; columns intact | S3 |
| CT-167 | SEC | Export respects isolation | Export as Tenant A | File contains only Tenant A rows | S1 |
| CT-168 | SEC | Export respects filter | Search to 3 rows, then export | Only the 3 filtered rows exported (no silent full dump) | S3 |
| CT-169 | UI | Page size control | Change page size on a list | Honoured; pagination correct | S4 |
| CT-170 | UI | Avatar initial | Create names starting with a digit / symbol / non-Latin char | Initial shows sensibly (or `?`), no crash | S4 |

---

## 15. Cross-flow / regression

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-001 | FUNC | Create → appears everywhere | A new customer appears in Customers, All Contacts, and the Dashboard count, immediately | S2 |
| XF-002 | FUNC | Contact usable downstream | The new customer is selectable when creating a Sales quote/order/invoice (via the profile quick actions) | S2 |
| XF-003 | FUNC | Edit reflects in lists | Rename a contact → the new name shows in all lists | S2 |
| XF-004 | FUNC | Disable hides from pickers | Disable a contact → it stops appearing in the directory (and ideally in sales pickers) | S3 |
| XF-005 | ISO | End-to-end isolation | Nothing created/edited as Tenant A is ever visible to Tenant B | S1 |

---

## 16. Areas to probe hardest (tester's attention map)

1. **Multi-tenant isolation (§13)** — still the single most important thing. The direct-URL profile IDOR (ISO-005) is now **fixed**; regression-test that a tenant cannot reach another tenant's contact by id, and that a tenant **can** still open its own.
2. **Stored XSS in the directory (CT-028, CT-066)** — now defended at two layers (input filter + output escaping); confirm a payload shows as plain text.
3. **GSTIN (CT-022)** — now saved end-to-end with format validation, state-code derivation, and dedup; regression-test create-with-GSTIN and the profile "Add GST Number" form, plus a duplicate and a malformed value.
4. **Merge is irreversible (§12.2)** — only ever on QA contacts; verify nothing is lost and references re-point.
5. **Duplicate detection (CT-021)** — still none; decide with the dev whether a "possible duplicate" warning is wanted (merge is the cleanup path).
6. **Required name (CT-020)** and **disabled-list consistency (CT-049)** are now **fixed** — quick regression checks.

---

## 17. Test run sheet (copy per browser/device)

| Run info | |
|---|---|
| Tester | |
| Date | |
| Build / URL | https://erp.zetaclantech.com |
| Browser / OS | |
| Device / viewport | |
| Tenant logged in as | |

| Case ID | Status (Pass/Fail/Blocked/Skip) | Actual result | Defect ID |
|---|---|---|---|
| CT-001 | | | |
| … | | | |
| ISO-001 | | | |
| … | | | |

---

## 18. Defect report template

```
Defect ID:        ZE-CONTACTS-____
Linked Case ID:   CT-0__ / ISO-0__ / XF-0__
Title:            <short, specific>
Severity:         S1 / S2 / S3 / S4
Type:             FUNC / EDGE / UI / A11Y / SEC / PERF / ISO
Environment:      Prod — erp.zetaclantech.com | <browser> <version> | <device/viewport>
Tenant:           <which tenant/org you were logged in as>
Preconditions:    <state, which QA contact used>
Steps to reproduce:
   1.
   2.
Expected result:  <from the SOP>
Actual result:    <what happened>
Evidence:         <screenshot/recording; Console+Network capture for security/iso issues>
Reproducibility:  Always / Intermittent (x of y)
Notes:            <partyId(s) involved — NO real customers' personal data beyond what's needed>
```

---

## 19. Teardown (mandatory)

1. **List every test contact, group, tag, address, email, phone, and merge** you created (capture their partyIds / group IDs).
2. Disable or hand the list to the dev for deletion — **don't leave QA contacts in a live tenant's directory.**
3. Delete any **exported CSV/XLSX** files from the test machine.
4. Confirm you **never modified a real MARUTHI (org `100000`) contact**, and performed **no merge** on a real party.
5. Attach the completed run sheet(s) and any defect IDs to this part's test report.

---

*End of Part 2 — Contacts. Related parts: Part 1 — Login & Onboarding (issued); Part 3 — POS Billing Terminal; Part 4 — Sales & Invoicing; Part 5 — Inventory & Products; Part 6 — Settings, Users & Roles. The Contacts module feeds customers/vendors into Sales, Purchase and Accounting — isolation and tax-field accuracy here directly affect those.*
