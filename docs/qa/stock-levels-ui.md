# Stock Levels UI review

Branch: `codex/stock-level-ui`, based on master `1997a90f` with the merged
Stock Levels functional fixes from PR #29. This change does not rewrite any
existing dashboard, catalog, or functional-fix branch.

## Reference and scope

Use the supplied Stock Levels screenshot, `stock-levels-components.md`,
`stock-levels-design-system.md`, and the referenced `zcerpthemepalette.md`.
The screen now has five tinted KPI cards with outline icons, warehouse and
filter controls, a CSV/XLSX export menu, the stock table, numbered pagination,
a page-size selector, refresh, and product overflow actions.

Positive physical stock is green; zero/negative physical stock is red.
Free-to-sell quantities use dark text except negative quantities, which are
red as shown in the screenshot. Existing organization/user identities,
available shell actions, and the Site Map footer remain real application
controls. KPI totals and pagination remain calculated from actual data;
the reference image's unrelated totals and page counts are not hardcoded.

The screen's root actions, stock queries, summary calculations, tenant scope,
and export/edit transitions are unchanged. The shared screen registers only
the new scoped stylesheet and script. Both HTML and Quasar layouts retain
native find/sort/export controls; the enhanced toolbar delegates to them.

## Local visual samples

Review `/qapps/zenith/Inventory/StockLevels?pseudoId=MTC&pseudoId_op=begins&pageSize=20&facilityId=__ALL_WAREHOUSES__`
on localhost. The six samples include cotton quantities 10/770/0, roll
quantities 150/0 with free-to-sell -903, and an empty bottle at zero.
The sample warehouses are Demo Main Store and Demo Second Store.

`docs/infra/ci/seed/stock-level-ui-preview.sql` is an optional manual seed
for the named `LOCAL_ERP_ORG` demo only. It is not included in application
startup or production migrations. Duplicate IDs fail atomically instead of
overwriting records. Its paired cleanup removes only the named sample IDs
owned by the local demo organization. Leave the requested preview samples
in place for visual review.

## Validation

- XML parsing and comparison of root actions and both transitions to master.
- JavaScript syntax and repository CSS-comment, cross-module-transition,
  form-DOM-collision, and party-picker guards.
- Full `STOCK_LEVEL_FIXTURE=1` regression: authentication, warehouse/global
  shop scope, tenant isolation, unique counts, batches, valuation fallbacks,
  zero/negative/facility-less stock, future dates, search/paging, fragment
  rendering, filtered all-page CSV/XLSX contents, and encoded product links.
  Restart Moqui after importing its temporary audit user to clear caches;
  remove only the regression fixture through its paired cleanup afterward.
- Browser review: six-row preview, empty HSN search through Filters, numbered
  page two, page-size reset with search retention, warehouse selection,
  product overflow and export disclosures, desktop and mobile layouts.

The reference review uses a 1535x1023 desktop viewport and checks a 390x844
mobile viewport. The table scrolls horizontally on narrow screens. Local
validation is separate from remote PR checks, which run after an approved
push. Do not claim remote merge readiness before those checks complete.
