# ZetaERP — Manual Bug-Testing SOP
## Part 11 of N — Pricing (price lists, price items, volume/quantity breaks, pricing rules, the price engine, price history)

| | |
|---|---|
| **Document** | QA-SOP-11 — Pricing |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The **Pricing module** at `/apps/zenith/pricing`: the Pricing dashboard, Price Lists (create/edit), Price-List Items, Volume / quantity-break pricing, Pricing Rules (create/edit) and their conditions, the **price-calculation engine** (`calculate#Price`), and the Price-Change History. POS-terminal mode pricing (`PosProductModePrice`) is a **separate** subsystem covered in the POS SOP. |
| **Audience** | Manual QA tester (no code knowledge assumed) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-06 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Pricing module end-to-end (A→Z)** — creating and editing price lists, adding per-product prices and quantity-break prices, building pricing rules with conditions, verifying the **effective price the engine actually computes**, checking the multi-tenant isolation of all of it, and every edge / UI / security case — plus **how to record a defect**.

Pricing is a **money path**. A wrong price list, an unbounded discount rule, or a price list that leaks across tenants is a direct commercial and confidentiality risk. The highest-value defects here are: **the engine returning the wrong effective price, a discount that isn't capped, a price floor that isn't honoured, and any cross-tenant visibility of prices/rules.**

> 🔎 **Tester heads-up (from a code review that informed this SOP):** the Pricing **read screens** (dashboard counts, Price Lists, Pricing Rules, Price History) do **not** visibly filter by organization, and the **New Rule** dialog does not stamp an organization on the rule. Section **§14 (Org isolation)** is therefore the single most important part of this SOP — treat every isolation case as a **prime defect candidate**, not a formality.

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system with real paying tenants.**

1. **Never create, edit, delete, or reprice against the live flagship tenant** (MARUTHI / Organization ID `100000`). Do all pricing work under disposable QA tenants.
2. **Pricing rules can be global.** A rule created without an organization applies to **every** tenant's price calculation. Before creating any rule, confirm with the dev whether it will be org-scoped — and **delete every rule you create** in teardown. A stray global rule silently discounts other tenants' sales.
3. **Every price list, item, rule, and volume price you create is real data** — track and remove them (see §18 Teardown).
4. **Never expose or invent prices for real products.** Use QA products with dummy prices. Do not "test" by editing a real MARUTHI product's price.
5. **Price-change history is an audit trail** — do not attempt to delete or alter its rows.
6. If unsure whether an action is reversible or global in effect, **stop and ask the dev.**

---

## 3. Test environment & preconditions

| Item | Value |
|---|---|
| Pricing dashboard | `/apps/zenith/pricing/PricingDashboard` |
| Price Lists | `/apps/zenith/pricing/FindPriceList` |
| Edit a price list | `/apps/zenith/pricing/EditPriceList?priceListId=<id>` |
| Pricing Rules | `/apps/zenith/pricing/FindPricingRule` |
| Edit a rule | `/apps/zenith/pricing/EditPricingRule?pricingRuleId=<id>` |
| Price History | `/apps/zenith/pricing/PriceChangeHistory` |
| Quasar (SPA) equivalents | same paths under `/qapps/zenith/pricing/…` |

> 📌 As with the rest of Zenith, `/apps` is server-rendered (Bootstrap) and `/qapps` is the Quasar SPA (loads a shell, then fetches content — a brief blank is normal). Run functional cases on **both** mounts.

**Browsers:** Desktop Chrome (primary); spot-check Safari/Edge and mobile Safari/Chrome.
**Viewports:** 1920×1080, 1366×768, iPad, iPhone 390, Android 360.
**Tools:** DevTools (Network + Console), an incognito window, and access to a couple of QA products and a QA customer.

---

## 4. Test data to prepare (ask the dev where noted)

| Label | Use |
|---|---|
| `QA_TENANT_A` (admin) | Primary tenant to build price lists/rules under |
| `QA_TENANT_B` (admin) | **Second** tenant — required for every §14 isolation case |
| `QA_PROD_1`, `QA_PROD_2` | Two QA products **with a base price/MRP set** (the engine falls back to the product MRP) |
| `QA_CUSTOMER` | A QA customer to assign a price list to (for the engine cases) |
| `QA_CUST_GROUP` | A customer group (for group-price-list cases) |
| Currency | INR (₹) — the module formats prices as `₹#,##0.00` |

> 📌 **Price types:** Selling, Buying/Purchase, Wholesale, Retail/MRP, Employee, Promotional.
> **Rule actions:** Discount %, Discount Amount, Fixed Price, Margin on Cost.
> **Rule condition types:** Product, Product Category, Customer Group, Min Quantity, Min Order Amount, Day of Week, Time Range, Sales Channel, Region.

---

## 5. Conventions & severity

**Case Type:** `FUNC` · `EDGE` · `UI` · `A11Y` · `SEC` · `PERF`.

| Sev | Meaning | Example on this module |
|---|---|---|
| **S1 — Critical** | Wrong money, unbounded discount, or cross-tenant price/rule leak | Engine ignores the price floor and returns a negative price; a tenant sees another tenant's price lists |
| **S2 — High** | A core create/edit/calculation is broken with a workaround | Default-list uniqueness not enforced; discount % > 100 accepted |
| **S3 — Medium** | Wrong-but-limited behaviour | Price-change log not written; date filter ignored on display |
| **S4 — Low** | Cosmetic / minor UX | ₹ symbol missing on one column; dialog field misaligned on mobile |

**Logging a defect:** §16 template. For any price defect, record **the inputs (list/rule/qty/customer) and the price the engine returned vs the price you expected**, using the "correct-answer" reference in §21.

---

## 6. Module map (what you are testing)

```
   /apps/zenith/pricing
     ├── PricingDashboard   4 metric cards (Price Lists · Priced Items · Rules · Volume Prices) + Recent Changes
     ├── FindPriceList      list + [New Price List] ─▶ EditPriceList
     │      └── EditPriceList   details │ Price Items (+add/remove) │ Volume Pricing (+add/remove)
     ├── FindPricingRule    list + [New Rule] ─▶ EditPricingRule
     │      └── EditPricingRule  details │ Conditions (ALL must match) (+add/remove)
     └── PriceChangeHistory audit log of every price change

   PRICE ENGINE (calculate#Price) resolution order:
     customer price list → customer's party price list → customer-group price list
       → org default Selling list → product MRP
     then: volume-pricing override (qty>1) → pricing rules (priority order) → floor/rounding
```

---

# 7. PRICING DASHBOARD — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-001 | FUNC | Dashboard loads | Open `/apps/zenith/pricing/PricingDashboard` | "Pricing Overview" header, 4 metric cards (Price Lists, Priced Items, Pricing Rules, Volume Prices), and a "Recent Price Changes" panel all render | S2 |
| PRC-002 | FUNC | Metric counts correct | Compare each card to the matching list | **Price Lists** = active price lists; **Priced Items** = price-list items; **Pricing Rules** = active rules; **Volume Prices** = volume rows | S2 |
| PRC-003 | FUNC | Recent changes list | Change a price (see §10), reload | The change appears at the top of "Recent Price Changes" (last 10, newest first) with product, old→new price, reason, timestamp | S3 |
| PRC-004 | FUNC | View-All link | Click "View All" on Recent Changes | Opens Price Change History | S3 |
| PRC-005 | EDGE | Empty state | A fresh tenant with no pricing data | All four counts read **0**; Recent Changes is empty — no error, no `null` | S3 |
| PRC-006 | FUNC | Both mounts | Open the dashboard on `/apps` and `/qapps` | Same content; `/qapps` fills in after the shell | S3 |
| PRC-007 | SEC | Counts are org-scoped | As `QA_TENANT_A`, note the 4 counts; compare to what only A's data should total | ⭐ The counts reflect **only A's** price lists/items/rules/volume — not a global total across tenants (see §14 — **prime defect candidate**) | S1 |

---

# 8. PRICE LISTS — Find & Create — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-010 | FUNC | List renders | Open Price Lists | Grid with Name (link), Type, Currency, Default, Active; "New Price List" button; column filters, saved finds, CSV/XLSX | S3 |
| PRC-011 | FUNC | Create price list | New Price List → Name, Type=Selling, Currency=INR, Default=No, description → Create | List created; redirected to its Edit screen; appears in the list | S2 |
| PRC-012 | FUNC | Required fields | Submit New Price List with Name blank / Type blank / Currency blank | Rejected with a required-field message; nothing created | S2 |
| PRC-013 | FUNC | One default per type | Create a Selling list with Default=**Yes**; then create a **second** Selling list with Default=**Yes** | Creating the second default **clears** the first list's Default flag — only one Selling default remains for the org | S2 |
| PRC-014 | FUNC | All 6 types selectable | Open the Type dropdown | Shows Selling, Buying/Purchase, Wholesale, Retail/MRP, Employee, Promotional | S3 |
| PRC-015 | FUNC | Currency list | Open Currency dropdown | Populated with currency UOMs (INR present) | S3 |
| PRC-016 | FUNC | Name link → edit | Click a list name | Opens EditPriceList for that list | S3 |
| PRC-017 | FUNC | Filter / sort | Use the column filters (Name, Type, Active) and sort | Results filter/sort correctly; default sort is default-first then name | S3 |
| PRC-018 | FUNC | Export | Click CSV / XLSX | Downloads the current list | S4 |
| PRC-019 | EDGE | Long / special names | Name = a 200-char string, and `<b>x</b>` | Stored/escaped as literal text; no layout break; no HTML executes | S3 |

---

# 9. EDIT PRICE LIST — Details — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-020 | FUNC | Details form loads | Open a list's Edit screen | Form pre-filled: Name, Description, Type, Currency, Fallback (Parent) list, Default?, Active?, Valid From/Thru | S3 |
| PRC-021 | FUNC | Update details | Change Name/Description/Type, Update | Saved; header + list reflect the change | S2 |
| PRC-022 | FUNC | Fallback (parent) list | Open the "Fallback Price List" dropdown | Lists other active price lists; the **current list is excluded** (can't be its own parent) | S3 |
| PRC-023 | FUNC | Activate / deactivate | Set Active? = Inactive, Update | List marked inactive; drops out of "active" counts and the default-price resolution | S2 |
| PRC-024 | EDGE | Valid From/Thru dates | Set Valid Thru in the past | Saved; an expired list should not be used by the engine (verify in §13) | S3 |
| PRC-025 | EDGE | Self-parent guard | Try to force the current list as its own parent (URL/param) | Rejected or ignored — no infinite fallback loop | S2 |
| PRC-026 | UI | Rounding is not editable here | Inspect the details form | Note for the tester: **rounding mode/precision are not on this form** (they default to HALF_UP / 2 at create). If the product needs per-list rounding control, that's a gap to raise — not a bug in these cases | S4 |

---

# 10. PRICE-LIST ITEMS — Test Cases

> The **Add Item** dialog sets a **fixed unit price** for a product at a given min-quantity. (Discount/margin price *types* exist in the data model and engine but are **not** exposed in this dialog — a per-product discount item would be set via the API/dev; note that as a UI-coverage gap, not a bug, unless the product intends them to be editable.)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-030 | FUNC | Add a price item | Add Item → Product, Unit Price ₹100, Min Qty 1, Reason "initial" → Add | Item appears in the Price Items grid with ₹100.00 | S2 |
| PRC-031 | FUNC | Price change is logged | Add an item (price 0→100); then edit the same product's price to ₹120 | Two rows in Price History: initial (0→100, "Initial price set" if no reason) and 100→120 with your reason | S2 |
| PRC-032 | FUNC | Idempotent set | Add the **same** product at the **same** Min Qty again with a new price | It **updates** the existing item (no duplicate row for that product+minQty) | S2 |
| PRC-033 | FUNC | Distinct min-qty tiers | Add the same product at Min Qty 1 (₹100) and Min Qty 10 (₹90) | Two separate rows (a per-product quantity tier), both listed | S2 |
| PRC-034 | FUNC | Product dropdown scoped | Open the Product dropdown | Shows the **active org's** products only (owner = active organization) | S2 |
| PRC-035 | UI | Currency formatting | View the Price column | Formatted `₹#,##0.00` (e.g. ₹1,250.00) | S4 |
| PRC-036 | FUNC | Remove item | Click Remove on an item → confirm | Item removed after the confirmation prompt | S3 |
| PRC-037 | EDGE | Min qty default | Add an item leaving Min Qty blank | Defaults to 1 | S3 |
| PRC-038 | EDGE | Boundary prices | Try Unit Price = 0, a negative value, blanks, and a very large number | Define & record behaviour: 0 allowed? negative rejected? Confirm none crash; a **negative unit price should be rejected** | S2 |
| PRC-039 | EDGE | Discount % out of range (API/dev) | (Dev-assisted) call set price item with `discountPercent` = 150 and = -5 | Rejected: **"Discount % must be between 0 and 100."** Blank is allowed | S2 |
| PRC-040 | FUNC | Export items | CSV / XLSX on the Price Items grid | Downloads the items | S4 |

---

# 11. VOLUME / QUANTITY-BREAK PRICING — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-050 | FUNC | Add volume price (unit) | Add Volume Price → Product, Min Qty 10, Max Qty 49, Unit Price ₹90 → Add | Row appears (Product, 10, 49, ₹90.00) | S2 |
| PRC-051 | FUNC | Add volume price (discount) | Add → Product, Min Qty 50, Discount % 15 (leave Unit Price blank) → Add | Row appears with Discount 15% | S2 |
| PRC-052 | FUNC | Min Qty required | Submit with Min Qty blank | Rejected (Min Qty is required) | S2 |
| PRC-053 | FUNC | Idempotent | Add the same product at the same Min Qty again | Updates the existing row (no duplicate for product+minQty) | S3 |
| PRC-054 | FUNC | Remove | Remove a volume price → confirm | Removed after confirmation | S3 |
| PRC-055 | EDGE | Overlapping / gap tiers | Create tiers 1–9, 10–49, 50+; then a qty of 5, 10, 60 | The engine picks the tier whose Min Qty is the **highest ≤ quantity** (verify in §13: qty 60 → the 50+ tier) | S2 |
| PRC-056 | EDGE | Both price and discount set | Add a volume row with **both** a Unit Price and a Discount % | Record which wins — engine prefers the explicit **Unit Price** over the discount | S3 |

---

# 12. PRICING RULES — Find & Create — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-060 | FUNC | List renders | Open Pricing Rules | Grid: Rule (link), Priority, Action, Value, Stack, Active, From/To; "New Rule" button; filters/CSV | S3 |
| PRC-061 | FUNC | Create rule | New Rule → Name, Priority 10, Action=Discount %, Value 10, Max Discount ₹50, Stackable=No → Create | Rule created; redirected to its Edit screen | S2 |
| PRC-062 | FUNC | Required fields | Submit with Name / Action / Value blank | Rejected; nothing created | S2 |
| PRC-063 | FUNC | All 4 actions | Open the Action dropdown | Discount %, Discount Amount, Set Fixed Price, Margin on Cost | S3 |
| PRC-064 | FUNC | Priority default | Leave Priority blank | Defaults to 10 | S3 |
| PRC-065 | FUNC | Toggle active | From the list, toggle a rule Active/Inactive | Status flips; an inactive rule is skipped by the engine | S2 |
| PRC-066 | SEC | **Rule gets an organization** | Create a rule as `QA_TENANT_A`; (dev-assisted) inspect its `organizationPartyId` | ⭐ The rule should be **stamped with A's org** so it applies to A only. If it is created **org-less (null)** it becomes a **global rule affecting every tenant** — **file as S1** (see §14) | S1 |
| PRC-067 | FUNC | After create → edit | Create a rule | Lands on EditPricingRule to add conditions | S3 |
| PRC-068 | FUNC | Export | CSV on the rules grid | Downloads | S4 |

---

# 13. EDIT PRICING RULE — Details & Conditions — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-070 | FUNC | Details form | Open a rule's Edit screen | Fields: Name, Description, Priority, Action, Value, Max Discount, **Price Floor** (minimum price), Stackable?, Active?, Valid From/Thru | S3 |
| PRC-071 | FUNC | Update rule | Change Action to Fixed Price, Value 199, Update | Saved | S2 |
| PRC-072 | FUNC | Add a condition | Add Condition → Type=Product, Operator=Equals, Value=`<a productId>` → Add | Condition appears under "Conditions (ALL must match)" | S2 |
| PRC-073 | FUNC | All 9 condition types | Open the condition Type dropdown | Product, Product Category, Customer Group, Min Quantity, Min Order Amount, Day of Week, Time Range, Sales Channel, Region | S3 |
| PRC-074 | FUNC | Operators | Open the Operator dropdown | Equals, Not Equals, Greater Than, Less Than, In List, Between | S3 |
| PRC-075 | EDGE | Between needs both values | Add a Between condition with only the first value | Record behaviour; "Value To" is meant for Between | S3 |
| PRC-076 | FUNC | Remove condition | Remove a condition → confirm | Removed | S3 |
| PRC-077 | FUNC | ALL-must-match semantics | A rule with 2 conditions where only 1 is met | The rule does **not** apply (all conditions must match) — verify via the engine (§13.1) | S2 |
| PRC-078 | EDGE | Day-of-week condition | Set Day of Week = today's 3-letter day (e.g. `MON`) or its number | Rule matches today; set a different day → rule does not match | S3 |
| PRC-079 | EDGE | Time-range condition | Set Time Range = `09:00-18:00` (a window covering now) vs one that excludes now | Matches inside the window, not outside; a malformed range simply doesn't match (no crash) | S3 |

---

## 13.1 PRICE-CALCULATION ENGINE — Test Cases  ⭐ the core

> The engine (`calculate#Price`) computes the effective price. Exercise it either through the **sales/quote/POS pricing** of a QA product for a QA customer, or **dev-assisted** by calling the service directly. Verify against the **resolution order** and the "correct-answer" table in §21.

| ID | Type | Title | Setup → check | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-080 | FUNC | Fixed price from list | List item ₹100 for the product; price it | Effective price ₹100.00; source = price list | S1 |
| PRC-081 | FUNC | No item → product MRP | Product MRP ₹250, no list item | Effective price ₹250.00; source = product list price | S2 |
| PRC-082 | FUNC | Discount-type item | List item as Discount 20% on an MRP of ₹250 | Effective ₹200.00 (250 × 80%) | S2 |
| PRC-083 | FUNC | Volume override | Base ₹100; volume tier qty≥10 → ₹90; price qty 12 | ₹90.00; source = volume pricing | S1 |
| PRC-084 | FUNC | Volume tier selection | Tiers 10–49=₹90, 50+=₹80; price qty 60 | ₹80.00 (highest Min Qty ≤ 60) | S2 |
| PRC-085 | FUNC | Rule discount % capped | Base ₹100; rule Discount 30% with **Max Discount ₹20** | ₹80.00 (discount capped at ₹20, not ₹30) | S1 |
| PRC-086 | FUNC | Rule fixed price | Rule action = Fixed Price ₹149 (conditions match) | ₹149.00 | S2 |
| PRC-087 | FUNC | Price floor honoured | Base ₹100; rule Discount 90% but **Price Floor ₹50** | ₹50.00 (never below the floor) | S1 |
| PRC-088 | FUNC | Never negative | Rule Discount Amount ₹500 on a ₹100 base, no floor | ₹0.00 (clamped at zero, never negative) | S1 |
| PRC-089 | FUNC | Non-stackable stops | Two matching rules, first is **not** stackable | Only the first (by priority) applies; the second is skipped | S2 |
| PRC-090 | FUNC | Stackable stacks | Two matching rules, first **is** stackable | Both apply in priority order | S2 |
| PRC-091 | FUNC | Priority order | Two matching rules with different priorities | Lower priority number applies first | S2 |
| PRC-092 | FUNC | Resolution precedence | Assign the customer a price list AND leave an org default | The **customer's** price list wins over the org default | S1 |
| PRC-093 | FUNC | Parent fallback | List has no item for the product but has a Fallback (parent) list that does | Price comes from the parent list; source shows `ParentPriceList:…` | S2 |
| PRC-094 | FUNC | Date validity | Expire the list item (Valid Thru in the past) | The expired item is ignored; engine falls back (parent/MRP) | S2 |
| PRC-095 | FUNC | Rounding | A discount that yields ₹79.999; list precision 2 / HALF_UP | Rounded to ₹80.00 per the list's rounding mode | S3 |
| PRC-096 | FUNC | Customer assignment needs a target | (Dev/API) assign a price list with **neither** party nor group | Rejected: "Either partyId or customerGroupId is required" | S2 |

---

# 14. ORG ISOLATION (MULTI-TENANT) — Test Cases  ⭐⭐ highest value / prime defect area

> Price lists, items, rules and history all carry an organization. A tenant must see and be affected by **only their own** pricing. The code review behind this SOP suggests these are **not** currently enforced on the read screens and rule-create — verify each carefully and file defects.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-100 | SEC | Price Lists list is scoped | Create a list under `QA_TENANT_A`; log in as `QA_TENANT_B`, open Price Lists | B does **not** see A's list. *(If B sees A's lists → S1 cross-tenant leak.)* | S1 |
| PRC-101 | SEC | Pricing Rules list is scoped | Create a rule under A; view Pricing Rules as B | B does **not** see A's rule | S1 |
| PRC-102 | SEC | Price History is scoped | Change a price under A; view Price History as B | B does **not** see A's price-change rows | S1 |
| PRC-103 | SEC | Dashboard counts are scoped | Compare the dashboard counts as A vs B | Each sees only their own totals, not a global sum | S1 |
| PRC-104 | SEC | Rule is org-scoped, not global | Create a rule as A (no org visible in the form); (dev) check its `organizationPartyId`, then price a product **as B** | A's rule must **not** affect B's price. A null-org rule that discounts B's sales is an **S1** contamination | S1 |
| PRC-105 | SEC | Edit-list IDOR | As B, open `EditPriceList?priceListId=<A's id>` directly | B cannot view or modify A's price list (blocked / not found) | S1 |
| PRC-106 | SEC | Edit-rule IDOR | As B, open `EditPricingRule?pricingRuleId=<A's id>` directly | B cannot view or modify A's rule | S1 |
| PRC-107 | FUNC | Product dropdowns scoped | In Add Item / Add Volume dialogs as A | Only A's products are offered (this one **is** scoped in code — confirm it holds) | S2 |

---

# 15. PRICE-CHANGE HISTORY — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-110 | FUNC | History renders | Open Price Change History | Grid: Product, Price List, Old Price, New Price, Reason, Changed By, Date (newest first) | S3 |
| PRC-111 | FUNC | Entries created | After any price add/change (§10) | A matching row exists with correct old→new values and your reason | S2 |
| PRC-112 | FUNC | Changed-by & timestamp | Inspect a row you created | Changed By = your user; Date = when you made the change | S3 |
| PRC-113 | FUNC | Search / filter | Filter by Product and by Reason | Results filter correctly | S3 |
| PRC-114 | FUNC | Export | CSV / XLSX | Downloads | S4 |
| PRC-115 | SEC | Audit immutability | Look for any edit/delete affordance on a history row | There is none — history is read-only | S3 |

---

# 16. UI / LAYOUT / RESPONSIVE / ACCESSIBILITY — Test Cases

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-120 | UI | Dashboard cards layout | 1920 / 1366 | 4 cards across with icons; Recent Changes table below; no overflow | S4 |
| PRC-121 | UI | Dialogs render | Open New Price List / Add Item / New Rule / Add Condition | Each dialog opens centred, fields labelled, submit + close present | S3 |
| PRC-122 | UI | ₹ formatting everywhere | Prices in grids, dialogs, history | Consistent `₹#,##0.00`; no raw numbers or `$` | S4 |
| PRC-123 | UI | Mobile | iPhone 390 / Android 360 | No horizontal page scroll; wide grids scroll inside their own container; dialogs usable | S3 |
| PRC-124 | UI | `/apps` vs `/qapps` parity | Compare each screen on both mounts | Same content and controls; neither shows unstyled/broken widgets | S3 |
| PRC-125 | A11Y | Keyboard & labels | Tab through a create dialog | Logical order, visible focus, every field labelled; Enter submits | S3 |
| PRC-126 | UI | Empty grids | A list/history with no rows | Clean empty table, not a broken/error state | S4 |
| PRC-127 | UI | Long product names in grids | An item with a long product name | Wraps/fits; no layout break | S4 |

---

# 17. PERFORMANCE — Test Cases

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-130 | PERF | Large price list | A list with hundreds of items | Edit screen and item grid load without hanging; paging/scroll works | S3 |
| PRC-131 | PERF | Bulk import | (Dev/API) import many items at once | Completes; returns imported vs error counts; each price logged | S3 |
| PRC-132 | PERF | Engine under many rules | Many active rules present | `calculate#Price` still returns promptly for a single product | S3 |

---

# 18. SECURITY — consolidated Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| PRC-140 | SEC | Auth required | Open any pricing URL logged out | Redirect to login | S1 |
| PRC-141 | SEC | Cross-tenant isolation | All of §14 | No tenant sees or is affected by another tenant's pricing | S1 |
| PRC-142 | SEC | IDOR on edit screens | §14 PRC-105/106 | Direct `priceListId` / `pricingRuleId` from another org is blocked | S1 |
| PRC-143 | SEC | XSS in names/reasons | Rule name / list name / change reason = `<img src=x onerror=alert(1)>` | Stored/escaped as text; never executes on any screen | S1 |
| PRC-144 | SEC | Discount bounds | Discount % 0–100 (PRC-039); Max Discount and Price Floor actually cap/floor the engine (§13.1) | No unbounded discount; no negative price | S1 |
| PRC-145 | SEC | Global-rule blast radius | PRC-104 | A rule created by one tenant cannot silently reprice another tenant's products | S1 |

---

## 19. Cross-flow / regression checks

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-020 | FUNC | List → item → history round-trip | Create list → add/change item → the change is in Dashboard "Recent" and in Price History | S2 |
| XF-021 | FUNC | Rule → engine round-trip | Create/activate a rule with conditions → the engine applies it exactly when conditions match, and not otherwise | S1 |
| XF-022 | FUNC | Deactivate propagates | Deactivate a list/rule → it drops out of counts and stops affecting the price | S2 |
| XF-023 | FUNC | Default change | Move the default flag to another Selling list → the engine's default resolution uses the new one | S2 |

---

## 20. Known areas to probe hardest (tester's attention map)

1. **Org isolation (§14) — do this first and hardest.** The read screens and rule-create looked un-scoped in code review; two tenants + a shared product will expose any leak or global-rule contamination. These are S1.
2. **The price engine (§13.1).** Wrong effective price is the worst functional defect here. Walk the whole resolution order and the caps/floor/never-negative/rounding.
3. **Discount caps & price floor (PRC-085/087/088).** Money-safety — verify the engine respects Max Discount and Price Floor and never goes negative.
4. **Default-list uniqueness (PRC-013)** and **idempotent set (PRC-032/053)** — silent duplication or a second default corrupts resolution.
5. **Price-change logging (PRC-031/111)** — the audit trail must capture every change with old→new and who.
6. **Date validity (PRC-094)** — expired lists/items/rules must stop applying.

---

## 21. Reference — how Pricing *should* behave (the "correct answer")

- **Engine resolution order** (first match wins for the base price): 1) customer's assigned price list → 2) the customer party's own price list → 3) customer-group price list → 4) the org's **default Selling** list (active) → 5) the **product MRP**. Then **volume pricing** overrides when qty > 1; then **pricing rules** apply in **priority** order (stopping at the first non-stackable match); finally the **price floor**, the **never-negative** clamp, and **rounding** (per the list's mode/precision, default HALF_UP / 2).
- **Price-list item types:** Fixed (use the unit price), Discount (list/MRP × (100−disc%)), Margin (on cost).
- **Rule actions:** Discount % (capped by Max Discount), Discount Amount (capped), Fixed Price, Margin on Cost. **Price Floor** (minimumPrice) is a hard lower bound; result is never below it and never negative.
- **Rule conditions:** **ALL** must match for a rule to apply. Types include Product, Category, Customer Group, Min Qty, Min Amount, Day of Week, Time Range, Channel, Region.
- **Defaults:** only **one** default price list per org **per type**; setting a new default clears the old.
- **Audit:** every price add/change writes a Price-Change Log row (previous, new, reason, user, timestamp).
- **Isolation (intended):** every price list, item, rule, volume price and log carries an `organizationPartyId`; a tenant should see and be priced by **only their own** pricing data. *(Verify — §14.)*

---

## 22. Test run sheet (copy per browser/device × tenant)

| Run info | |
|---|---|
| Tester | |
| Date | |
| Build / URL | https://erp.zetaclantech.com |
| Tenant (A / B) | |
| Browser / OS | |
| Device / viewport | |

| Case ID | Status (Pass/Fail/Blocked/Skip) | Actual (for prices: expected ₹ vs returned ₹) | Defect ID |
|---|---|---|---|
| PRC-001 | | | |
| … | | | |

---

## 23. Defect report template

```
Defect ID:        ZE-PRC-____
Linked Case ID:   PRC-0__
Title:            <short, specific>
Severity:         S1 / S2 / S3 / S4
Type:             FUNC / EDGE / UI / A11Y / SEC / PERF
Environment:      Prod — erp.zetaclantech.com | <apps|qapps> | <browser> | <device/viewport>
Tenant:           <A / B subdomain> — mask secrets
Preconditions:    <price list / rule / product / customer used, and their values>
Steps to reproduce:
   1.
   2.
   3.
Expected result:  <from the SOP — for prices, the §21 correct-answer>
Actual result:    <what happened — for prices, "expected ₹X, engine returned ₹Y">
Evidence:         <screenshot; for engine issues, the inputs + returned price/source>
Reproducibility:  Always / Intermittent (x of y)
Notes:            <price list id / rule id / org — NO secrets>
```

---

## 24. Teardown (mandatory)

1. **Delete every rule you created** — especially any that may be **org-less/global** (they silently affect all tenants).
2. **Delete every price list, price item, and volume price** you created (and note that Price-Change-Log rows are an audit trail — leave them, but tell the dev which QA product they reference).
3. **Remove any customer/group price-list assignments** made for the engine cases.
4. List every QA tenant/user used.
5. Confirm **MARUTHI (Org `100000`) pricing was never created/edited/deleted**.
6. Attach the run sheet(s) and any `ZE-PRC-*` defects to this part's test report.

---

*End of Part 11 — Pricing. Related: Part 10 — Home Dashboard; POS mode pricing is in the POS SOP; Sales/quote pricing is in the Sales SOP. Ask for the next module part when ready.*
