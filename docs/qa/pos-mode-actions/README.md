# Sales-mode delete control

## Findings and fix

| File | Cause | Fix |
| --- | --- | --- |
| SalesMode.xml | Delete was hidden inside Customize, although cashiers/admins expected the reference's adjacent trash control. | Render the same POST/CSRF form beside Customize. Keep an accessible mode-specific name, confirmation, authorization, organization and default-mode checks. |
| SalesMode.xml | Archive checked only the cart header, missing line-level modes in mixed-mode unpaid or held carts. | Check the current organization's active/held headers and joined line modes before archiving. |
| zenith-theme-v4.css | No direct card delete-button treatment. | Scoped 44px outlined trash control with keyboard focus and a disabled state. Shared/default modes remain protected. |

Delete archives the owned mode (`isActive=N`); it never deletes prices, mappings or historical bills. A shop cannot delete a shared system mode. The default/shared disabled buttons explain that restriction. No price, tax, payment or invoice calculation changes.

## Verification

The local check used the clean staging image, a fresh tmpfs PostgreSQL database and the repository POS_QA fixtures on loopback port 18086. Native browser checks and independent SELECT assertions verified persisted row quantity, manual price, Wholesale pricing, Custom colour and item removal. API/DB checks cover open/held mixed-mode refusal, foreign/default/shared refusal, GET/CSRF rejection and archive after void while retaining price/line references. See functional-checks.json for completed assertions.

Before/after images contain disposable fixtures only. The reference image's customer/product values are not fixtures and were not copied. Local manual confirmation/cancel checks were interrupted when the host Mac locked. The independent PR acceptance run 39410961485 passed against merge candidate 7c38bbae, including both-shell mode Rename/Delete, archive/database checks and responsive layouts. Latest-master acceptance is rerun after rebase. The local temporary containers and tmpfs database were removed; the loopback listener closed (teardown.json). No Safari or payment/printer hardware acceptance is claimed.

## Scope and deployment

Advanced cart styling is a separate follow-up. Only mode-card controls, archive eligibility, synthetic login fixtures and regression assertions belong to this change. Test fixture organization codes enable real browser login and are not deployed to production. The shared stylesheet cache version is bumped; terminal assets use their existing modification-time versions.

Maintainer review and a MARUTHI read-only no-op gate remain required before deployment. This change does not deploy or modify a production tenant.
