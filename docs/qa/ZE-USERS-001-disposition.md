# Bug-ID Disposition — `ZE-USERS-001` collision

**Raised:** 2026-07-06 · **Owner:** dev · **For:** QA triage

## Problem
Two **distinct** defects were filed under the **same** Bug ID `ZE-USERS-001`. If the
tracker keys on Bug ID, the second report's status overwrites the first — one is a
shipped fix, the other a non-repro, and they must not share a disposition.

(These are two separate reports, not re-downloads of one — different titles, different
SOP cases, different root causes. See the "not collisions" note at the bottom for the
duplicate `(1)` files, which *are* the same report downloaded twice.)

## The two reports and their dispositions

| Proposed ID | Source PDF | Title | SOP | Sev | Status | Root cause / evidence |
|---|---|---|---|---|---|---|
| **`ZE-USERS-001`** (keep) | `..._New_User_Login_Organization_Error_With_Screenshot.pdf` | New cashier can't log in with a valid Organization ID | ST-041, ST-042 | S2 | ✅ **FIXED** (commit `dd6e3f1`) | `createUser` created the account + `ZENITH_ALL` + `TENANT_` group + `ACTIVE_ORGANIZATION` pref but **not** the `PrtEmployee→org(OrgInternal)` relationship the login org-check requires. Fix creates it; verified live — new user logs in with Org ID `MARUTHI`, lands on Dashboard. Backfilled the reported `cashier3@maruthi.com`. |
| **`ZE-USERS-002`** (new) | `..._User_Not_Visible_After_Creation_Bug_Report.pdf` | New user not visible in Users list after refresh | ST-040, ST-041 | S2 | ⚠️ **NOT REPRODUCIBLE** — closed | Create-then-refresh works on **/apps** and **/qapps** (dialog-create → user gets `TENANT_MARUTHI` → visible after reload). List scopes by `TENANT_` membership (`Users.xml:200-206`), added by `createUser` since the 2026-06-26 baseline (`e542fa5`). Likely observed mid-load: the /qapps SPA takes ~4.4 s to AJAX-load content (India↔Germany latency), rendering an empty list briefly. |

**Recommendation:** keep the fixed login bug as `ZE-USERS-001` (preserves the commit
reference), reassign the list-visibility report to a new ID (`ZE-USERS-002`) and close it
as Not-Reproducible with the note above. Adjust the exact numbers to your convention —
the point is *two IDs, not one*.

## QA intake — re-test against the current build before filing

Several S2 reports this cycle were **already resolved when they arrived**: the defect was
real when the tester saw it, but the fix had shipped (or the data had been corrected)
before the report reached dev. A re-test against the live build at filing time would have
closed them with no dev round-trip.

| Report | Filed | Status on arrival |
|---|---|---|
| `ZE-USERS-002` — reset pw asks "Old Password" | 2026-07-04 | Fixed **2026-07-05** by ZE-ROLE-003 (`448de53`) — one day later |
| `ZE-USERS-001` (list-visibility) | 2026-07-04 | **Not reproducible** — create-then-refresh works on /apps and /qapps |
| `ZE-SETTINGS-0203` — Settings "Access Restricted" | — | Gate works for admins; the tested account simply lacked `ZENITH_ADMIN` (data), since corrected |

**Two cheap checks before filing (both dev-free):**
1. **Re-run the exact repro on https://erp.zetaclantech.com right now.** If it passes, the
   build already has the fix — don't file, or file as "was failing, now passes, please
   confirm closed."
2. **Record the build/date you tested against.** A report dated before the last deploy is a
   prime suspect; noting it lets dev check the fix date first.

This is a process fix on the QA side: dev can't stop pre-fix reports from being written,
but a re-test gate at intake removes most of them before they cost a round-trip.

## Other collisions found while scanning the report set
- **`ZE-AUTH-002`** appears in **two** files: `ZE-AUTH-002-Google-Login-UI-Switch-High.pdf`
  (standalone) **and** `ZE-INV-001_and_ZE-AUTH-002_Bug_Report.pdf` (bundled with `ZE-INV-001`).
  Confirm whether these describe the *same* AUTH-002 defect (duplicate) or the bundle
  re-uses the ID for a different one; split if different.
- **Bundled multi-ID reports** (`ZE-POS-0204-0205`, `ZE-POS-0206-0207`) pack two IDs into
  one PDF — fine as long as each ID gets its own tracker row.

## NOT collisions (same report, downloaded twice — ignore)
`ZE-POS Split-Overpay...(1)`, `ZE-POS-002 (1)`, `ZE-POS-009 (1)`, `ZE-POS-010(1)`,
`ZE-ROLE-012...(1)`, and the three `ZE-SETTINGS-0203_Settings-Access-Restricted*` copies
are re-downloads of a single report each — one disposition applies.
