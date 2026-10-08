# Pricing Rules verification

Based on master `1997a90f97fb1743b88c8d51a4e2aee418aab2b5`. Final disposable acceptance: **344 checks, zero failures**; see `report.json` and inspected synthetic mobile screenshots. Run only against a fresh disposable Moqui runtime with the complete candidate component tree, committed CI base overrides and canonical framework patches. This verifies Pricing Rules CRUD, matching, exports and the changed UI; it does not certify all Pricing or Purchase behavior.

## Problems and fixes

- Numeric `in` conditions attempted to cast the whole CSV value before splitting it; weekday operators were ignored and time ranges crossing midnight never matched. The matcher now validates operators and values, uses the user's time zone, handles ISO/full/abbreviated weekdays and supports inclusive overnight ranges. Default Minimum equals semantics remain `>=`.
- Invalid actions/amounts/percentages, fractional priorities, incomplete or reversed conditions and foreign product/group references could be saved. Typed write services validate the complete header and children before creating rows, preserve explicit zero values, derive the organization from authorized active membership and keep stored ownership immutable. Nested validation snapshots its input before Moqui changes execution contexts.
- Foreign/no-org transitions and forged child-parent parameters could bypass screen-only ownership checks. Every write resolves its stored parent, enforces Pricing write access and preserves the existing platform ADMIN maintenance exception; creation still requires an authorized active organization. Search/export organization fields cannot override explicit fail-closed predicates.
- Duplicate copied only the header. It now creates an inactive copy with all validated conditions. Delete resolves and removes only the stored rule and children. A legacy invalid rule can be disabled without first repairing it, but cannot be reactivated until its conditions are valid.
- Margin on Cost has no approved cost calculation and previously appeared applied without changing the price. Activation is unavailable and existing unsupported actions neither appear applied nor stop supported rules. Inactive legacy drafts remain editable; cost semantics require owner approval.
- Quasar page replacements could lose inline tab/save/copy wiring. Registered leaf JavaScript delegates these controls. Both interfaces use escaped summary strings, configured currency and the correct surface breadcrumb. Scoped CSS reserves the wrapped Quasar header, fits mobile forms and keeps all four summary cards visible.

## Evidence

`verify.cjs` invokes real services/transitions and real Duplicate/Update/tab controls on `/apps` and `/qapps`, compares independently queried SQL rows, exercises valid and invalid numeric/category/day/time conditions, zero and capped actions, ownership and CSRF boundaries, actual standalone CSV and responsive geometry. `PricingRuleDbProbe.java` accepts one SELECT only and connects exclusively to loopback H2 memory `purchase-pricing-qa`. All invoices must remain unchanged before and after exact fixture cleanup.

The fixture uses synthetic parties/products and mechanical arithmetic regression amounts, not business defaults. It contains no GSTIN/PAN/HSN or production records. The synthetic user's UTC time zone differs from the JVM's Asia/Kolkata setting to expose timezone mistakes. Cleanup resolves stored composite membership keys and exact parent/child keys, then independent SQL must confirm zero residue across 12 fixture tables and all captured generated parents.

Configure `RULE_QA_RUNTIME`, `RULE_QA_JAVA` and `RULE_QA_OUT`; run `node docs/qa/pricing-rules/verify.cjs` with Playwright, local Chrome and JDK 21. Copy `fixture.xml` only to the disposable Pricing component as `PricingRuleQaFixture.xml`, and `qa-screen.xml` only to the disposable Pricing screen directory as `PricingRuleQaAcceptance.xml` before boot. The helper requires `purchase.pricing.qa.disposable=true`; initialize/cleanup require platform ADMIN and operations require the synthetic QA account. Never deploy helpers.

## Gates and dependencies

Pricing Engine PR #30 owns canonical calculation context, list/date/currency selection and zero-cap behavior; those changes are not duplicated here. Rebase and reverify the combined tree before deployment, particularly shared `PricingServices.xml` and `ZenithApp.xml` edits. No schema migration is introduced.

Keep draft until exact-head trusted GitHub staging passes and the owner supplies the SOP-required MARUTHI before/after no-op database evidence and approves unsupported cost-margin behavior. Local framework verification is a public rebuild, not byte-identical production evidence. Live checks are read-only and the site's cached/offline notice prevents a deployed-source-parity claim. This task does not merge or deploy.
