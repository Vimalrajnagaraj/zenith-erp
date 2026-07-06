# ZetaERP — Manual Bug-Testing SOP
## Part 10 of N — Home Dashboard (landing page, KPIs, Quick Actions, module grid, role routing)

| | |
|---|---|
| **Document** | QA-SOP-10 — Home Dashboard |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The **home Dashboard** a user lands on after login (`/apps/zenith/Dashboard` and `/qapps/zenith/Dashboard`): the welcome header, the 4 KPI summary cards, the Quick Actions panel, the All-Modules grid, org isolation of the numbers, RBAC / plan gating of the tiles, and role-based dashboard routing. **Module-specific dashboards** (Sales, Inventory, Tax, Accounting, POS, etc.) are covered in their own SOP parts. |
| **Audience** | Manual QA tester (no code knowledge assumed) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-06 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Home Dashboard end-to-end (A→Z)** — the happy path, every KPI count, the multi-tenant isolation of those numbers, the role/plan-based filtering of the module tiles and Quick Actions, the role-based dashboard redirect, all the edge cases, the security cases, and the visual / responsive / accessibility cases — and **how to record a defect** when something behaves differently from the *Expected Result*.

The Dashboard is deceptively simple — it looks like a static "welcome screen", but every number on it is a **live, org-scoped database count** and every tile is gated by **role + subscription plan**. The high-value defects here are **wrong counts, cross-tenant data leakage, and a tile appearing that the user's plan/role shouldn't allow.** Follow the SOP top-to-bottom; do not skip cases because "it's just the home page."

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system with real paying tenants.**

1. **Never test against the live flagship tenant** (MARUTHI / Organization ID `100000`). Read-only *viewing* MARUTHI's dashboard to confirm its numbers look sane is acceptable, but **never create, edit, or delete data while logged in as a MARUTHI user.**
2. **The KPI numbers are real counts of real records.** If you create test customers/orders/invoices/products to move a KPI, they belong to the tenant you created them under and **must be cleaned up** (see §16 Teardown) or handed to the dev.
3. **Never share, screenshot, or paste real passwords** into the tracker. Mask them (e.g. `Pa****1!`).
4. **Org isolation is the crown-jewel test here.** If you ever see one tenant's numbers on another tenant's dashboard, stop and file it as **S1** immediately — that is a data-confidentiality breach.
5. If you are unsure whether an action is reversible, **stop and ask the dev** before clicking.

---

## 3. Test environment & preconditions

| Item | Value |
|---|---|
| Dashboard URL (Quasar / SPA) | `https://erp.zetaclantech.com/qapps/zenith/Dashboard` |
| Dashboard URL (Bootstrap / server-rendered) | `https://erp.zetaclantech.com/apps/zenith/Dashboard` |
| Where a normal login lands | `/qapps/zenith/Dashboard` |
| Where onboarding / Google signup lands | `/apps/zenith` → Dashboard |

> 📌 **Two front-ends render the *same* Dashboard.** `/apps` is the **Bootstrap**, fully server-rendered version (loads instantly). `/qapps` is the **Quasar single-page app** — it loads a shell first and then **fetches the dashboard content over the network (~3–5 s on a normal India↔Germany connection)**, so the page is briefly blank/empty before the cards appear. **That blank window is normal — wait for content before judging "nothing loaded."** Run every functional case on **both** mounts.

**Browsers to cover** (full pass on the first; spot-check the rest):
- Desktop Chrome (latest) — primary
- Desktop Safari (Mac) and Windows Edge
- Mobile Safari (iPhone) and Mobile Chrome (Android)

**Devices / viewports for the UI cases:** 1920×1080, 1366×768, iPad (768/1024), iPhone (390×844), small Android (360×740).

**Tools:** browser DevTools (Network + Console tabs), an incognito window (for the logged-out case), and — for the count-accuracy cases — access to the underlying list screens the KPI cards link to.

---

## 4. Test data — QA accounts to prepare (ask the dev to set up)

The Dashboard changes shape based on **who** is logged in. You need these five personas. Because roles are cached and some setup needs a container restart, have the dev provision them and confirm they're active before you start.

| Persona | Groups / setup | What the Dashboard should look like |
|---|---|---|
| `QA_PLATFORM_ADMIN` | Framework `ADMIN` (e.g. `john.doe`), **no active organization** | KPI cards show **global** totals (all tenants); **all** module tiles visible |
| `QA_TENANT_ADMIN` | `ZENITH_ADMIN` + a `TENANT_<x>` group + active org set | KPI cards scoped to **that tenant only**; module tiles = the tenant's **plan** modules |
| `QA_CASHIER` | `ZENITH_CASHIER` **only** (no other `ZENITH_*` functional group) | Module grid shows **only POS Terminal + Inventory** tiles |
| `QA_EMPTY_TENANT` | A brand-new tenant admin with **no** customers/orders/invoices/products yet | All four KPI counts read **0** |
| `QA_ROLE_DASH` *(if configured)* | A user whose PartyRole has an active `RoleDashboardConfig` (e.g. a **CEO** role) | Is **redirected away** from the home Dashboard to a role-specific dashboard |

> 📌 Prepare **two separate tenants** (`QA_TENANT_A`, `QA_TENANT_B`) with *different* amounts of data — you need them for the org-isolation cases (§9).

---

## 5. Conventions & severity

**Case Type:** `FUNC` (functional) · `EDGE` (edge/boundary) · `UI` (visual/layout) · `A11Y` (accessibility) · `SEC` (security) · `PERF` (performance).

**Severity:**

| Sev | Meaning | Example on this screen |
|---|---|---|
| **S1 — Critical** | Data leak, security hole, or dashboard fully broken for everyone | One tenant sees another tenant's KPI numbers; a tile grants access to a module the plan/role forbids |
| **S2 — High** | A KPI count is wrong, or a whole panel is broken/missing | Invoices count includes cancelled invoices; module grid empty for a valid user |
| **S3 — Medium** | Wrong-but-limited behaviour | A drill-down "View All" link points at the wrong list; role redirect fails to a blank page |
| **S4 — Low** | Cosmetic / minor UX | KPI card misaligned on iPhone; module tile text wraps oddly |

**How to log a defect:** §17 has the template. Every defect needs the **Case ID**, steps, **expected vs actual**, browser/device, a screenshot, and — for a wrong count — **the number the card showed vs the number the linked list actually contains.**

---

## 6. Flow map (what you are testing)

```
   LOGIN ──▶ role has a RoleDashboardConfig?
              │ yes ─────────────▶ redirect to role dashboard (e.g. CEO)  ── (out of scope here)
              │ no
              ▼
   ┌───────────────────────── HOME DASHBOARD ─────────────────────────┐
   │  [ Welcome to ZetaERP ]                       [New Order][New Invoice]│
   │                                                                    │
   │  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐             │
   │  │Customers │ │Sales Orders│ │ Invoices │ │ Products │  ← KPI cards │
   │  │   NNN    │ │    NNN     │ │   NNN    │ │   NNN    │  (org-scoped)│
   │  │ View All │ │  View All  │ │ View All │ │ View All │  → list      │
   │  └──────────┘ └────────────┘ └──────────┘ └──────────┘             │
   │                                                                    │
   │  Quick Actions  (POS · Sales&CRM · Purchase&Inventory · Acct · …)  │  ← plan + role scoped
   │  All Modules    ( POS  Sales  Inventory  …  Settings )             │  ← RBAC + plan scoped
   └────────────────────────────────────────────────────────────────────┘
```

The four KPI cards are (in order): **Customers, Sales Orders, Invoices, Products.** Note there is **no** "Vendors" card on screen even though vendors are counted internally.

---

# 7. DASHBOARD LOAD, AUTH & ROLE ROUTING — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-001 | SEC | Auth required | In an **incognito** window (logged out), open `/apps/zenith/Dashboard` and `/qapps/zenith/Dashboard` | Both redirect to `/Login`; the dashboard is **never** shown to an anonymous user | S1 |
| DASH-002 | FUNC | Dashboard loads (happy path) | Log in as `QA_TENANT_ADMIN` | Lands on the Dashboard; welcome header, 4 KPI cards, Quick Actions panel, and All-Modules grid all render; no error banner, no `null`/`${...}` literals on screen | S1 |
| DASH-003 | FUNC | Both mounts render | Open the Dashboard on **both** `/apps` (Bootstrap) and `/qapps` (Quasar) | Same content on both; on `/qapps` the content appears within a few seconds of the shell (see §3 note) | S2 |
| DASH-004 | FUNC | `/qapps` isn't stuck empty | On `/qapps`, watch the page from navigation | The brief blank is followed by the full dashboard; if it is **still** empty after ~10 s, that's a defect (capture the Network tab) | S2 |
| DASH-005 | FUNC | Role-based dashboard redirect | Log in as `QA_ROLE_DASH` (a role with an active `RoleDashboardConfig`, e.g. CEO) | User is **redirected** to the configured role dashboard **instead of** the home Dashboard; the redirect happens before the home cards render | S2 |
| DASH-006 | EDGE | No role config → default | Log in as a user whose roles have **no** `RoleDashboardConfig` (most users) | The **home** Dashboard renders normally — no redirect, no error (the routing is wrapped so an unseeded/missing config silently falls through) | S2 |
| DASH-007 | EDGE | Role-config table not seeded | (Dev-assisted) With the `RoleDashboardConfig` entity empty | Home Dashboard still loads for everyone (the routing block is guarded and swallows the "not seeded yet" case) | S3 |
| DASH-008 | EDGE | Reload / re-navigation | On the Dashboard, hit browser refresh, then navigate away and back | Reloads cleanly each time; counts recompute; no duplicated panels, no stale spinner | S3 |
| DASH-009 | EDGE | Deep-link straight to Dashboard | While logged in, paste the Dashboard URL directly | Loads normally (does not force a re-login or bounce) | S3 |

---

# 8. KPI SUMMARY CARDS — Test Cases

**The four cards and exactly what each counts** (this is the "correct answer" a tester checks against):

| Card | Counts | "View All" links to |
|---|---|---|
| **Customers** | Parties with role **Customer** owned by the active org | `/Contacts/Customers` |
| **Sales Orders** | Orders in status **Placed / Approved / Completed** sold by the active org (excludes draft *Created* and *Cancelled*) | `/sales/FindOrder` |
| **Invoices** | Invoices **not** in status *Cancelled*, issued by the active org | `/Accounting/Invoices` |
| **Products** | Products owned by the active org | `/Inventory/FindProduct` |

### 8.1 Rendering & counts

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-010 | FUNC | All four cards render | Load the Dashboard | Cards **Customers, Sales Orders, Invoices, Products** each show a title, a big number, and a "View All" link | S2 |
| DASH-011 | FUNC | Counts are numeric | Read each card | Each shows an integer ≥ 0 — never blank, `null`, `NaN`, or the raw `${totalCustomers}` text | S2 |
| DASH-012 | FUNC | Customers count is correct | Note the Customers number → click **View All** → count rows in `/Contacts/Customers` | The two numbers match (the card counts the same customers the list shows) | S2 |
| DASH-013 | FUNC | Sales Orders count is correct | Compare the card to `/sales/FindOrder` filtered to Placed/Approved/Completed | Match — **draft (Created) and Cancelled orders are excluded** from the card | S2 |
| DASH-014 | FUNC | Invoices count excludes cancelled | Cancel an invoice in a test tenant, reload the Dashboard | The Invoices count **drops by one** (cancelled invoices are not counted) | S2 |
| DASH-015 | FUNC | Products count is correct | Compare the card to `/Inventory/FindProduct` | Match; org-owned products only | S2 |
| DASH-016 | FUNC | Drill-down links work | Click **View All** on each of the 4 cards | Each opens the correct list (per the table above) and that list is scoped to the same org | S2 |
| DASH-017 | FUNC | Counts move with data | In a test tenant, add one customer / place one order / issue one invoice / add one product, reload | Each corresponding card **increments by exactly one** | S2 |

### 8.2 Edge & boundary

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-018 | EDGE | Brand-new / empty tenant | Log in as `QA_EMPTY_TENANT` | All four cards read **0** (not blank, not error); "View All" opens an empty list, not a crash | S2 |
| DASH-019 | EDGE | Large counts don't break layout | View a tenant (or the admin global view) with thousands of records | Big numbers render fully inside the card; no overflow, no truncation to `99+`, no layout break | S3 |
| DASH-020 | EDGE | Status transitions reflected | Move an order Created→Placed, or cancel one | The Sales Orders count updates on next load to match the new statuses | S3 |
| DASH-021 | EDGE | Count consistency on rapid reload | Refresh the Dashboard several times quickly | The four numbers are stable/consistent between refreshes (no flicker to 0 then back) | S3 |

---

# 9. ORG ISOLATION (MULTI-TENANT) — Test Cases  ⭐ highest value

> Every KPI is filtered by the viewer's **active organization**. A tenant must see **only their own** numbers. The platform super-admin (no active org) is the deliberate exception — they see **global** totals. These are the most important cases in this SOP.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-030 | SEC | Tenant sees only own numbers | Log in as `QA_TENANT_A` (which has, say, 3 customers) | Customers card shows **3** — A's count, **not** MARUTHI's or B's | S1 |
| DASH-031 | SEC | Two tenants differ | Load A's dashboard, note all 4 numbers; log out; load B's dashboard | B's four numbers reflect **B's** data and differ from A's; no bleed-through | S1 |
| DASH-032 | SEC | Drill-downs stay scoped | From tenant A, click each "View All" | Every list shows only A's records — the isolation isn't just on the count, the linked list is scoped too | S1 |
| DASH-033 | SEC | No cross-tenant via URL | As tenant A, try to reach the Dashboard/lists with another org's id in the URL/params | Cannot surface B's numbers; the active-org binding, not a URL param, drives the scope | S1 |
| DASH-034 | FUNC | Platform admin sees global | Log in as `QA_PLATFORM_ADMIN` (ADMIN, no active org) | KPI cards show **global** totals across all tenants (this is intended — the org filter is skipped when there's no active org) | S2 |
| DASH-035 | SEC | Admin isn't pinned to a tenant | As the platform admin, confirm no single tenant's active-org is silently applied | Numbers are global, not one tenant's — the admin is not bound to any org | S2 |
| DASH-036 | EDGE | Tenant with active-org missing | (Dev-assisted) A tenant user whose active-org preference is somehow unset | Confirm the documented behaviour with the dev (either scoped correctly or a safe empty state) — must **never** fall through to another tenant's data | S1 |

---

# 10. QUICK ACTIONS PANEL — Test Cases

**What it is:** a "Quick Actions" card of grouped shortcut links. The groups (and their links) only appear if the user's **plan** *and* **role** allow that module. Possible groups: **Point of Sale, Sales & CRM, Purchase & Inventory, Accounting & Finance, Contacts & People.**

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-040 | FUNC | Panel renders | Load as `QA_TENANT_ADMIN` | "Quick Actions" card shows one or more groups, each with a coloured heading and shortcut links | S3 |
| DASH-041 | FUNC | Links navigate | Click a sample link in each group (e.g. Open POS Terminal, New Sales Order, Journal Entry) | Each opens the correct create/list screen | S3 |
| DASH-042 | FUNC | Panel hidden when empty | Log in as a user with **no** module access at all | The entire Quick Actions card is **absent** (not an empty framed box) | S3 |
| DASH-043 | SEC | Plan-scoped actions | As a SaaS tenant whose plan **excludes** Accounting | The "Accounting & Finance" group does **not** appear | S2 |
| DASH-044 | SEC | Role-scoped actions | As a user whose role can't access CRM but whose plan includes it | CRM links (Manage Leads, Sales Pipeline) don't appear — actions are gated by plan **AND** role, not plan alone | S2 |
| DASH-045 | FUNC | Cashier's quick actions | As `QA_CASHIER` | Sees at most the POS group; not Accounting/CRM/etc. | S3 |
| DASH-046 | EDGE | Group heading vs contents | For any visible group | The heading only shows when it has ≥1 link under it (no empty-titled group) | S4 |

---

# 11. ALL-MODULES GRID — Test Cases

**What it is:** a grid of coloured module tiles (POS Terminal, Sales, Purchase, Inventory, Accounting, Contacts, CRM, HR, … Settings — up to ~34 tiles). The grid is filtered by **RBAC** (what the user's groups can access) and, for SaaS tenants, by **plan**. A **cashier-only** user is deliberately narrowed to just two tiles.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-050 | FUNC | Grid renders | Load the Dashboard | "All Modules" card shows a grid of module tiles; each tile is a labelled, coloured, clickable card | S2 |
| DASH-051 | FUNC | Admin sees all | As `QA_PLATFORM_ADMIN` | The full module set renders (~34 tiles incl. POS, Sales, Inventory, Accounting, Settings) | S2 |
| DASH-052 | SEC | RBAC filtering | As a user with access to only some modules | Only permitted tiles show; no tile for a module the user can't access | S2 |
| DASH-053 | SEC | Cashier is narrowed to two | As `QA_CASHIER` (ZENITH_CASHIER only) | The grid shows **only POS Terminal and Inventory** — no Sales, Accounting, Settings, etc. (till-first cashier) | S2 |
| DASH-054 | SEC | Plan gating | As a SaaS tenant on a limited plan | Only modules included in the plan appear (a plan that excludes, say, Manufacturing shows no Manufacturing tile) | S2 |
| DASH-055 | FUNC | Tile links navigate | Click several tiles (POS, Sales, Inventory, Settings) | Each opens that module's landing screen at the expected URL | S3 |
| DASH-056 | SEC | Tile ↔ actual access match | Note the tiles shown, then try to reach a **hidden** module by typing its URL directly | A module that has **no tile** for this user is **also blocked by URL** — the tile grid isn't the only gate (server-side enforcement) | S1 |
| DASH-057 | SEC | Plan escalation guard | As a tenant user with multiple non-admin roles (e.g. Cashier + HR Manager) on a limited plan | Tiles/actions are the intersection of **plan ∩ role** — a multi-role non-admin does **not** see every plan module (guards ZE-ROLES-001) | S1 |
| DASH-058 | EDGE | No modules → empty state | A user (non-admin) with zero module grants | Grid area shows gracefully (empty, not broken); the app doesn't crash | S3 |

---

# 12. WELCOME HEADER & TOP ACTION BUTTONS — Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-060 | FUNC | Header text | Load the Dashboard | Reads **"Welcome to ZetaERP"** with the "Enterprise Resource Planning System" subtitle | S4 |
| DASH-061 | FUNC | New Order button | Click **New Order** (top-right) | Opens `/apps/zenith/sales/CreateOrder` | S3 |
| DASH-062 | FUNC | New Invoice button | Click **New Invoice** | Opens `/apps/zenith/sales/CreateInvoice` | S3 |
| DASH-063 | EDGE | Buttons vs access | As a user without Sales access | Confirm the documented behaviour with dev — either the buttons are hidden, or clicking them lands on the standard access-restricted response (never a raw error) | S3 |

---

# 13. UI / LAYOUT / RESPONSIVE / ACCESSIBILITY — Test Cases

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-070 | UI | Desktop layout | 1920 & 1366 | KPI cards sit **4 across**; Quick Actions groups and module tiles align on a tidy grid; nothing overflows the viewport | S4 |
| DASH-071 | UI | Tablet layout | iPad 768 / 1024 | KPI cards reflow (≈2 across); module tiles rewrap; still readable, no horizontal scroll | S3 |
| DASH-072 | UI | Mobile layout | iPhone 390 / Android 360 | **No horizontal page scroll**; KPI cards stack full-width; module tiles wrap to 2–3 per row and stay tappable | S3 |
| DASH-073 | UI | `/apps` vs `/qapps` parity | Compare the two mounts side by side | Same cards, same counts, comparable styling; no version shows broken/unstyled boxes | S3 |
| DASH-074 | UI | Card styling | Inspect KPI + module cards | Cards have consistent padding, rounded corners, and shadow; module tiles keep their colour coding | S4 |
| DASH-075 | UI | Long module names | Look at the widest tile labels | Text stays inside the tile (wraps or fits); no overlap onto the next tile | S4 |
| DASH-076 | UI | Big numbers | A tenant with 4–5 digit counts | The number stays centred and fully visible within the KPI card | S4 |
| DASH-077 | A11Y | Keyboard navigation | Tab through the page | Every "View All", Quick Action, module tile, and top button is reachable and activatable by keyboard, with a visible focus ring; logical tab order | S3 |
| DASH-078 | A11Y | Links are real links | Inspect the tiles/actions | They are anchor links (openable in a new tab, screen-reader announced) — not click-only `div`s | S4 |
| DASH-079 | UI | Slow-network feedback (`/qapps`) | Throttle to Slow 3G, open `/qapps` Dashboard | The blank period shows the app shell / a loading state, then content — not a permanently white screen with no cue | S3 |

---

# 14. PERFORMANCE — Test Cases

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-080 | PERF | Load time (`/apps`) | Time from navigation to full render | Renders promptly (server-rendered; the five KPI counts are simple counts) | S3 |
| DASH-081 | PERF | Load time (`/qapps`) | Time the SPA content fetch | Content appears within a few seconds; note the number for regression (India↔Germany latency is expected, a hang is not) | S3 |
| DASH-082 | PERF | Large-tenant counts | A tenant with lots of data | The KPI counts don't noticeably slow the page vs a small tenant | S3 |

---

# 15. SECURITY — consolidated Test Cases

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| DASH-090 | SEC | Anonymous access blocked | Open any Dashboard URL logged out | Redirect to login (see DASH-001) | S1 |
| DASH-091 | SEC | Cross-tenant KPI leak | The whole of §9 | No tenant ever sees another tenant's numbers or lists | S1 |
| DASH-092 | SEC | Hidden-module URL access | Reach a module with no tile by typing its URL | Blocked server-side, not just hidden (see DASH-056) | S1 |
| DASH-093 | SEC | XSS via displayed data | If any tenant-controlled text (org/user name) shows on the dashboard, set it to `<img src=x onerror=alert(1)>` upstream | Rendered as inert text; **no** script executes | S1 |
| DASH-094 | SEC | Plan/role escalation | A limited-plan multi-role non-admin | Sees only plan∩role tiles & actions (DASH-057) | S1 |

---

## 16. Cross-flow / regression checks (run after the above)

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-010 | FUNC | Login → Dashboard round-trip | After login the Dashboard is the landing page and reflects the logged-in tenant | S1 |
| XF-011 | FUNC | KPI ↔ module consistency | The number on a KPI card equals the row count of the list its "View All" opens | S2 |
| XF-012 | FUNC | New tenant is clean | A freshly onboarded tenant's dashboard shows **its own zeros**, never inherited data | S1 |
| XF-013 | FUNC | Role change reflects | After the dev adds/removes a role or plan module, the tiles/Quick Actions update on next load | S2 |
| XF-014 | UI | Branding consistency | Header, cards, and tiles carry consistent ZetaERP styling across `/apps` and `/qapps` | S4 |

---

## 17. Known areas to probe hardest (tester's attention map)

Spend extra time here — this is where defects hide on *this* screen:

1. **Org isolation of the four counts (§9).** The #1 risk. Verify with two tenants that have *different* data, and confirm the linked lists are scoped too — not just the number.
2. **KPI definitions (§8).** The counts have specific rules: **Sales Orders exclude drafts and cancelled**, **Invoices exclude cancelled**. Verify by actually cancelling one and watching the count drop.
3. **Cashier narrowing (DASH-053) and plan∩role gating (DASH-057).** A tile or Quick Action appearing that the user's plan/role shouldn't allow is a security finding, not cosmetic.
4. **Tile ↔ real access (DASH-056/092).** Confirm a *hidden* module is also *blocked by URL* — the grid must not be the only gate.
5. **Role-based redirect (DASH-005/006/007).** If configured, the right roles get bounced to a role dashboard; if the config table is empty, everyone still gets the home dashboard (no crash).
6. **`/qapps` load window (§3, DASH-004, DASH-079).** Distinguish "normal SPA fetch delay" from "genuinely stuck empty" — capture the Network tab if unsure.

---

## 18. Test run sheet (copy per browser/device × persona)

| Run info | |
|---|---|
| Tester | |
| Date | |
| Build / URL | https://erp.zetaclantech.com |
| Persona (admin / tenant-admin / cashier / empty / role-dash) | |
| Browser / OS | |
| Device / viewport | |

| Case ID | Status (Pass/Fail/Blocked/Skip) | Actual result (for counts: card # vs list #) | Defect ID |
|---|---|---|---|
| DASH-001 | | | |
| DASH-002 | | | |
| … | | | |

---

## 19. Defect report template

```
Defect ID:        ZE-DASH-____
Linked Case ID:   DASH-0__
Title:            <short, specific>
Severity:         S1 / S2 / S3 / S4
Type:             FUNC / EDGE / UI / A11Y / SEC / PERF
Environment:      Prod — erp.zetaclantech.com | <apps|qapps> | <browser> <version> | <device/viewport>
Persona / tenant: <admin / tenant-admin(subdomain) / cashier / empty> — mask secrets
Preconditions:    <active org, data state>
Steps to reproduce:
   1.
   2.
   3.
Expected result:  <from the SOP — for counts, the "correct answer" table in §8>
Actual result:    <what happened — for counts, "card showed X, list has Y">
Evidence:         <screenshot; Network+Console capture for load/isolation issues>
Reproducibility:  Always / Intermittent (x of y)
Notes:            <Org ID, tenant subdomain, role/plan of the account — NO passwords>
```

---

## 20. Teardown (mandatory)

After the run:

1. **List every record you created** to move a KPI (test customers, orders, invoices, products) with the tenant it belongs to.
2. Hand the list to the dev for deletion, or follow the agreed cleanup — these are real records in a real tenant's ledgers.
3. **List every QA tenant/user** created for the personas so they can be removed.
4. **Log out** of all sessions.
5. Confirm **MARUTHI (Org `100000`) data was never created/edited/deleted** during the run.
6. Attach the completed run sheet(s) and any `ZE-DASH-*` defect IDs to this part's test report.

---

## 21. Reference — how the Dashboard *should* behave (the "correct answer")

For the tester to judge pass/fail, here is the intended behaviour distilled from the implementation:

- **Auth:** the screen requires authentication; anonymous access redirects to login.
- **KPI scope:** each count is filtered by the viewer's **active organization**. With **no** active org (platform admin) the filter is skipped → **global** totals. The org fields used are: customers/vendors by `party.ownerPartyId`, sales orders by `OrderHeaderAndPart.vendorPartyId`, invoices by `invoice.fromPartyId`, products by `product.ownerPartyId`.
- **KPI definitions:** Customers = role **Customer**; Sales Orders = status **Placed/Approved/Completed** only; Invoices = **not Cancelled**; Products = all org-owned. (Vendors are counted internally but **not** shown as a card — a missing "Vendors" card is *expected*, not a bug.)
- **Module grid:** built from a master module list, then filtered — for SaaS tenants by **plan ∩ role**, otherwise by **RBAC**; **admins** see the full plan/module set. A user whose only functional role is **ZENITH_CASHIER** is narrowed to **POS + Inventory** tiles.
- **Quick Actions:** same plan/role gating as the grid; the whole panel is hidden if no group qualifies.
- **Role routing:** if the user's role has an active `RoleDashboardConfig`, they are redirected to that role's dashboard **before** the home dashboard renders; a missing/empty config table is handled gracefully (home dashboard shown).

---

*End of Part 10 — Home Dashboard. Related parts: Part 1 — Login & Onboarding; and the module-specific dashboards (Sales, Inventory, Tax, Accounting, POS, Contacts, Subscriptions) each covered in their own SOP. Ask for the next module part when ready.*
