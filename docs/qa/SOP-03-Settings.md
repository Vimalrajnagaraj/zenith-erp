# ZetaERP — Manual Bug-Testing SOP
## Part 3 — Settings (Company, GST, Sequences, Users, Roles & Access)

| | |
|---|---|
| **Document** | QA-SOP-03 — Settings |
| **Product** | ZetaERP / Zenith (multi-tenant POS / ERP) |
| **Environment under test** | Production — https://erp.zetaclantech.com |
| **Scope of this part** | The admin **Settings** area only: Companies & Company Setup, GST Configuration, Document Sequences, Notifications, Company Groups, Backups, Access Control, Digital Signatures, **Users**, and **Roles / module access**. |
| **Audience** | Manual QA tester (admin access required) |
| **Document owner** | Platform / Solo-dev |
| **Status** | Active |
| **Last updated** | 2026-07-01 |

---

## 1. Purpose

This Standard Operating Procedure tells a tester **exactly how to manually test the Settings module end-to-end (A→Z)** — configuring the company, GST, document numbering, users, roles and module access — including the **edge cases**, the **multi-tenant isolation** cases, the **security/permission** cases, and the **visual/UI** cases, and **how to record a defect** when behaviour differs from the *Expected Result*.

Settings is **administrative** — its changes affect everyone in the organization (and some affect the whole platform). Test deliberately.

---

## 2. Critical rules for the tester (read before starting)

> ⚠️ **This is a LIVE commercial system. Settings changes are high-impact.**

1. **NEVER change Document Sequences on a real tenant** (especially MARUTHI / org `100000`). Changing a prefix, "Next Number", or pad length can **duplicate, skip, or renumber issued invoices/bills** — a legal and accounting break. Only ever touch sequences on a **throwaway tenant** you control.
2. **Never disable or lock out the only/last admin** of an organization — you can make the account unmanageable. Only disable **test** users you created.
3. **Never edit a real company's legal/tax data** (GSTIN, PAN, TAN, CIN, legal name, financial-year) on MARUTHI or any live tenant. Use a throwaway tenant, and **never fabricate** a tax number.
4. **Module-access / role changes can be platform-wide.** Roles (`ZENITH_*`) and their module access are shared security objects — editing one can affect **every tenant** using that role. Only the platform administrator should change these; as a tester, **observe**, don't re-wire live roles.
5. **Multi-tenant isolation is a key risk here** (see §13). If a tenant admin can see or edit **another tenant's** companies, sequences, GST or users, that is **Critical** — capture it immediately.
6. **Clean up every test user, role, and setting** you create (see §17), and confirm you left MARUTHI's settings exactly as they were.

---

## 3. Test environment & preconditions

The Settings area opens from the app menu → **Settings & Roles** and is **admin-gated** — only users in the `ZENITH_ADMIN` or `ADMIN` group can see it; everyone else gets an **"Access Restricted"** screen.

| Screen | URL (`/apps/zenith/Settings/…`) |
|---|---|
| Companies (list) — default | `…/Settings/CompanyList` |
| Company Setup | `…/Settings/CompanySetup?partyId=<orgId>` |
| GST Configuration | `…/Settings/GstConfiguration` |
| Document Sequences | `…/Settings/Sequences` |
| Notifications | `…/Settings/NotificationTemplates` |
| Company Groups | `…/Settings/CompanyGroups` |
| Backups | `…/Settings/BackupManagement` |
| Access Control | `…/Settings/AccessControl` |
| Digital Signatures | `…/Settings/DigitalSignatures` |
| Users & Role Assignment | `…/Settings/Users` |
| Roles & Access | `…/Settings/Roles` |
| Edit Role Access | `…/Settings/EditRole?userGroupId=<role>` |

**Two admin tiers matter for testing:**
- **Platform admin** (`ADMIN` group, e.g. john.doe) — sees all tenants; can create roles and edit module access.
- **Tenant admin** (`ZENITH_ADMIN`, e.g. a tenant's owner account) — manages their own org's users, but **should not** see other tenants' data.

**Browsers:** full pass on Desktop Chrome; spot-check Edge/Safari/mobile. **Tools:** DevTools (Console/Network), a second tenant login for isolation tests, a QA inbox.

---

## 4. Test data

| Label | Use |
|---|---|
| `QA_USER_1` | A test user you create (username + password) |
| `QA_ROLE` | A test role `ZENITH_QATEST` (platform-admin tests only) |
| Throwaway tenant | A non-MARUTHI org for the high-risk Company/GST/Sequence tests |
| Valid password | Meets policy: ≥8 chars, ≥1 digit, ≥1 special (e.g. `Qa-test1!`) |
| Fake tax data | Clearly-fake PAN/GSTIN for the throwaway tenant only |

---

## 5. Conventions & severity

**Case Type:** `FUNC` · `EDGE` · `UI` · `A11Y` · `SEC` · `PERF` · `ISO` (isolation) · `PERM` (permission gate).

| Sev | Meaning | Example |
|---|---|---|
| **S1 — Critical** | Cross-tenant exposure/edit, bill-numbering corruption, admin lockout, permission bypass | Tenant A edits Tenant B's document sequence; a non-admin reaches Settings |
| **S2 — High** | Major setting broken / wrong | Company profile won't save; password reset fails; role can't be assigned |
| **S3 — Medium** | Wrong behaviour, limited impact | Weak password accepted; FY-start not honoured |
| **S4 — Low** | Cosmetic / minor UX | Misaligned table on mobile; tooltip typo |

**Logging a defect** (template §15): Case ID, steps, expected vs actual, which admin tier/tenant you were, browser, screenshot, Console/Network capture.

---

## 6. Flow map

```
   Settings (admin-gated: ZENITH_ADMIN or ADMIN)
   ├─ Companies ───── Company Setup (name, country, currency, PAN/TAN/CIN, GSTIN, FY start, settings)
   ├─ GST Configuration ── registered GSTINs · GST slabs · composition/e-invoice · test calc
   ├─ Document Sequences ── invoice/order numbering (prefix/suffix/next/pad/FY)   ⚠ bill-number integrity
   ├─ Users ──────── create user · assign/remove role · reset password · disable/enable   (org-scoped)
   ├─ Roles ──────── create ZENITH_ role (platform admin) ──► Edit Role ── module access NONE/VIEW/FULL
   └─ Notifications · Company Groups · Backups · Access Control · Digital Signatures
```

---

# 7. ACCESS GATE (permissions)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-001 | PERM | Admin sees Settings | Log in as an admin, open Settings | The menu and screens render | S2 |
| ST-002 | PERM | Non-admin blocked | Log in as a **cashier/regular** user, open `…/Settings/Users` (and other Settings URLs directly) | **"Access Restricted"** — no settings content, no data leaked | S1 |
| ST-003 | PERM | Direct-URL bypass attempt | As a non-admin, hit each Settings sub-URL directly | Every one is gated; none render data | S1 |
| ST-004 | PERM | Create-user is admin-only | (Dev-assisted) POST the createUser transition as a non-admin | Rejected: "Only an administrator can change settings" | S1 |

---

# 8. COMPANIES & COMPANY SETUP

**Screens:** `…/Settings/CompanyList`, `…/Settings/CompanySetup?partyId=`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-010 | FUNC | Companies list | Open Companies | Lists internal organizations (active) | S2 |
| ST-011 | FUNC | Open company setup | Click a company | Opens its setup: Org Code, Name, Country, Currency, PAN, TAN, CIN, GSTIN records, FY start, settings | S2 |
| ST-012 | FUNC | Edit company profile | On a **throwaway tenant**, change Name / PAN / TAN / CIN → Update | Persists after reload | S2 |
| ST-013 | FUNC | Financial-year start | Set FY Start month → Save | Persists; document numbering FY reflects it (e.g. `INV/26-27/…`) | S2 |
| ST-014 | FUNC | Company settings key/values | View the settings list; edit a value | Persists | S3 |
| ST-015 | EDGE | Bad PAN/TAN/CIN | Enter malformed values | **Record actual** — is format validated? (likely not server-side) | S3 |
| ST-016 | ISO | ⚠ Cross-tenant company list | As a **tenant admin** (ZENITH_ADMIN, not platform ADMIN), open Companies | **Record actual.** The list is **not** org-filtered in code — a tenant admin may see **all tenants' companies**. If so, that's a **Critical isolation** defect (S1) | S1 |
| ST-017 | ISO | ⚠ Cross-tenant company setup (IDOR) | As tenant A's admin, open `CompanySetup?partyId=<Tenant-B org id>` | **Record actual.** If Tenant B's company profile renders/edits, that's an **IDOR (S1)** | S1 |

---

# 9. GST CONFIGURATION

**Screen:** `…/Settings/GstConfiguration`. Registered GSTINs, GST slabs, composition/e-invoice flags, a test calculator.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-020 | FUNC | GST page renders | Open GST Configuration | Registered GSTINs, GST slabs (rate/CGST/SGST), composition & e-invoice flags | S2 |
| ST-021 | FUNC | Test GST calc | Use the test calculator with an amount + rate | Returns correct CGST/SGST (intra-state) or IGST (inter-state) split | S2 |
| ST-022 | FUNC | Update GST config | On a throwaway tenant, toggle composition / e-invoice → Save | Persists | S3 |
| ST-023 | ISO | ⚠ Cross-tenant GSTINs | As a tenant admin, view the registered-GSTIN list | **Record actual.** If GSTINs of **other tenants** show, that's a **Critical** leak (the legal GSTIN of another business) | S1 |

---

# 10. DOCUMENT SEQUENCES (highest operational risk)

**Screen:** `…/Settings/Sequences`. Controls the numbering of invoices, orders, bills, etc. (prefix, suffix, next number, pad length, include-FY).

> ⚠️ **Do these ONLY on a throwaway tenant.** Changing a live tenant's sequence can duplicate or renumber issued bills.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-030 | FUNC | Sequence list | Open Document Sequences | Lists document types with prefix/suffix/next/pad/include-FY | S2 |
| ST-031 | FUNC | Change prefix (throwaway) | On a throwaway tenant, set a new prefix → Update; create a document | New document uses the new prefix + FY format | S2 |
| ST-032 | EDGE | Next-number guards | Set "Next Number" **below** the highest already-issued number | **Record actual.** It should be **prevented or warned** — otherwise the next document **duplicates an existing number** (S1 integrity). Test on throwaway only | S1 |
| ST-033 | EDGE | Pad length / non-numeric | Set pad length to a letter, or next-number to text | Rejected cleanly, no 500 | S3 |
| ST-034 | ISO | ⚠ Cross-tenant sequences | As a **tenant admin**, view the sequence list | **Record actual.** The list is **not** org-filtered in code — a tenant admin may **see and edit other tenants' numbering**. Editing another tenant's "Next Number" could corrupt **their** bills → **Critical (S1)** | S1 |
| ST-035 | FUNC | FY rollover | With include-FY on, check the FY portion | Correct FY (e.g. 26-27) per the company's FY-start month | S3 |

---

# 11. USERS & ROLE ASSIGNMENT

**Screen:** `…/Settings/Users`. Create users, assign/remove roles, reset passwords, enable/disable. The list is **org-scoped** for tenant admins (platform admin sees everyone).

### 11.1 Create & manage users

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-040 | FUNC | User list scope | Open Users as a **tenant admin** | Shows only **your organization's** users (platform admin sees all) | S1 |
| ST-041 | FUNC | Create user | Create New User → username, full name, password (twice) | User created, scoped to your tenant, given a default active organization | S2 |
| ST-042 | FUNC | New user can log in | Log in as the new user (with its Org ID) | Reaches the app, sees only this tenant's data | S2 |
| ST-043 | FUNC | Disable user | Disable a **test** user | Their login is blocked; their past records remain intact | S2 |
| ST-044 | FUNC | Enable user | Re-enable the test user | Login works again | S3 |
| ST-045 | FUNC | Reset password | Reset a test user's password (twice) | New password works; old one doesn't | S2 |

### 11.2 Password policy & validation

| ID | Type | Title | Data | Expected result | Sev |
|---|---|---|---|---|---|
| ST-050 | FUNC | Password mismatch | Password ≠ Verify | Rejected with a clear message | S3 |
| ST-051 | FUNC | Weak password | `abc`, `abcdefgh`, `12345678` | Rejected — policy is **≥8 chars, ≥1 number, ≥1 special char** (same as login) | S3 |
| ST-052 | FUNC | Strong password | `Qa-test1!` | Accepted | S3 |
| ST-053 | EDGE | Duplicate username | Create a user with an existing username | Rejected (usernames are unique) | S3 |
| ST-054 | EDGE | Empty fields | Submit blank username/password | Rejected, no 500 | S3 |

### 11.3 Role assignment & isolation

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-060 | FUNC | Assign role | + Role → pick a role (e.g. ZENITH_CASHIER) → Assign | Role badge appears on the user; their access changes accordingly | S2 |
| ST-061 | FUNC | Remove role | Click ✕ on a role | Role removed | S3 |
| ST-062 | FUNC | Only Zenith roles | (Dev-assisted) try to assign a non-`ZENITH_` group | Rejected: "Only Zenith roles can be assigned" | S2 |
| ST-063 | ISO | Can't manage another tenant's user | As Tenant A admin, try to assign/reset/disable a **Tenant B** user (by id) | **Blocked** — the action checks the user is in your active org (`check#UserInActiveOrg`). Confirm it refuses | S1 |
| ST-064 | SEC | Can't self-escalate cross-tenant | As a tenant admin, try to add yourself/your user to a platform role | Should not grant platform-admin powers; capture actual | S1 |

---

# 12. ROLES & MODULE ACCESS

**Screens:** `…/Settings/Roles`, `…/Settings/EditRole?userGroupId=`.

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ST-070 | FUNC | Roles list | Open Roles | Lists `ZENITH_*` roles with user count + module count | S2 |
| ST-071 | PERM | Create role is platform-admin only | As a **tenant admin**, try Create Role | Rejected/hidden — only the platform `ADMIN` can create roles | S1 |
| ST-072 | FUNC | Create role (platform admin) | Role ID `ZENITH_QATEST`, description → Create | Created and listed | S3 |
| ST-073 | EDGE | Role ID must start `ZENITH_` | Create a role id `QATEST` | Rejected: "Role ID must start with ZENITH_…" | S3 |
| ST-074 | FUNC | Edit module access | Open a role → set modules to No Access / View Only / Full Access → Save All Access | Persists; users with that role get exactly that access | S2 |
| ST-075 | PERM | Module access is platform-admin only | As a **tenant admin**, open Edit Role | **Read-only** — the Save button is hidden and a "managed by the platform administrator" notice shows | S1 |
| ST-076 | SEC | Module-access change is global | (Platform admin) change a shared role's access | **Be careful:** this affects **every tenant** using that role — verify the blast radius is understood, not a surprise | S2 |
| ST-077 | FUNC | View vs Full enforcement | Give a role View Only on a module, log in as a member | They can open but not add/edit/delete in that module | S2 |

---

# 13. MULTI-TENANT ISOLATION (high priority)

| ID | Type | Title | Steps | Expected result | Sev |
|---|---|---|---|---|---|
| ISO-001 | ISO | Users org-scoped | Tenant A admin sees only Tenant A users | Confirmed (the list filters by tenant group) | S1 |
| ISO-002 | ISO | ⚠ Companies list | Tenant A admin opens Companies | **Should** show only Tenant A — **code does not filter**, so verify whether other tenants leak (likely defect) | S1 |
| ISO-003 | ISO | ⚠ Company Setup IDOR | Tenant A admin opens `CompanySetup?partyId=<B>` | Should be denied; **verify** | S1 |
| ISO-004 | ISO | ⚠ Document Sequences | Tenant A admin opens Sequences | **Should** show only Tenant A — **code does not filter**; if other tenants' sequences show/edit, **Critical** | S1 |
| ISO-005 | ISO | ⚠ GST/GSTINs | Tenant A admin opens GST Configuration | Should show only Tenant A's GSTINs; **verify** | S1 |
| ISO-006 | ISO | User actions cross-tenant | Tenant A admin tries to reset/disable a Tenant B user | Blocked (`check#UserInActiveOrg`) | S1 |
| ISO-007 | ISO | Role creation/access global | Tenant admin cannot create roles or change module access | Blocked (platform-admin only) | S1 |

> **Tester note:** Users and user-actions are isolation-guarded in code; **Companies, Company Setup, Document Sequences and GST are not obviously org-filtered** — these are the ones to hammer and record exactly what a tenant admin can see/do.

---

# 14. OTHER SETTINGS + UI / SECURITY

| ID | Type | Title | Check | Expected result | Sev |
|---|---|---|---|---|---|
| ST-080 | FUNC | Notifications templates | Open Notifications | Templates list/edit works | S3 |
| ST-081 | FUNC | Company Groups | Open Company Groups | Group create/list works | S3 |
| ST-082 | FUNC | Backups | Open Backups | Backup list/trigger works; **don't restore** on live | S3 |
| ST-083 | FUNC | Access Control | Open Access Control | Renders without error | S3 |
| ST-084 | FUNC | Digital Signatures | Open Digital Signatures | Cert list/upload works; reject malformed cert gracefully | S3 |
| ST-085 | UI | Desktop layout | All screens at 1920/1366 | Tables aligned, no overflow | S4 |
| ST-086 | UI | Mobile layout | Settings at 360–390px | No horizontal scroll; dialogs fit | S3 |
| ST-087 | A11Y | Keyboard | Tab through create-user / role dialogs | Logical order, visible focus, Enter submits | S3 |
| ST-088 | SEC | XSS in free-text | Put `<img src=x onerror=alert(1)>` in a role description / company name | Stored/escaped as text, never executes | S1 |
| ST-089 | SEC | CSRF | (Dev-assisted) POST a settings transition without the session token | Rejected | S2 |

---

## 15. Cross-flow / regression & defect template

| ID | Type | Title | Expected result | Sev |
|---|---|---|---|---|
| XF-001 | FUNC | New user → role → login → access | Create user, give a role, log in: they see exactly what the role allows | S2 |
| XF-002 | FUNC | Disable hides everywhere | A disabled user can't log in anywhere | S2 |
| XF-003 | ISO | End-to-end isolation | Nothing a Tenant A admin changes is visible/editable by Tenant B (and vice-versa) | S1 |
| XF-004 | FUNC | Sequence change → next doc | (Throwaway) a prefix change shows on the very next created document | S2 |

```
Defect ID:        ZE-SETTINGS-____
Linked Case ID:   ST-0__ / ISO-0__ / XF-0__
Title / Severity / Type:
Environment:      Prod | <browser> | admin tier: platform ADMIN / tenant ZENITH_ADMIN | tenant:
Steps / Expected / Actual:
Evidence:         screenshot + Console/Network (mandatory for ISO/PERM/SEC)
Notes:            user/role/org ids touched — NEVER paste passwords
```

---

## 16. Areas to probe hardest (attention map)

1. **Document Sequences (§10, ISO-004)** — both a **bill-number integrity** risk (never edit live) and a likely **cross-tenant** hole (not org-filtered). The single most dangerous screen here.
2. **Cross-tenant Companies / Company Setup / GST (§13)** — tenant admins reach Settings (`ZENITH_ADMIN`) but these screens don't obviously filter by org; verify exactly what leaks.
3. **Permission gates (§7, ST-071/075)** — non-admins fully blocked; tenant admins can't create roles or change module access.
4. **Password policy (ST-051)** — user create/reset must enforce ≥8/1-digit/1-special.
5. **Admin lockout** — never disable the last admin; confirm there's a safeguard or at least document the risk.

---

## 17. Teardown (mandatory)

1. **List and remove every test user, role, and setting** you created (capture ids).
2. Confirm you **did not change any Document Sequence, GSTIN, or company profile on MARUTHI** (org `100000`) or any live tenant.
3. Confirm no real admin was left disabled.
4. Delete any downloaded backups/exports from the test machine.
5. Attach the run sheet(s) + defect ids to this part's report.

---

*End of Part 3 — Settings. Related: Part 1 — Login & Onboarding; Part 2 — Contacts; Part 4 — POS Billing Terminal; Part 5 — Sales & Invoicing; Part 6 — Inventory. The flagged isolation gaps in Companies / Sequences / GST should be triaged with the dev before broad tenant testing.*
