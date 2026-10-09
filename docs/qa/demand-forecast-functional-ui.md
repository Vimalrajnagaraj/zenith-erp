# Inventory Demand Forecast — functional fixes and reference UI

Verified locally on 2026-10-08. Main screen: `component/zenith-erp-inventory/screen/zenith/inventory/Inventory/DemandForecast.xml`. Routes: `/apps/zenith/Inventory/DemandForecast` and `/qapps/zenith/Inventory/DemandForecast`.

## Problems corrected

| Area | Root cause and resulting behavior |
| --- | --- |
| Mutating transitions | Update, acknowledgement and hours changes lacked consistent scope/write checks. They now require a selected internal organization, Inventory write access, POST and a valid session token. Acknowledgements explicitly check the loaded alert's organization. |
| Product and group lookup | Primary-key entity lookups could bypass an additional owner condition; group searches were global and partial names picked the first match. Check loaded ownership, reject ambiguous service searches, and resolve the screen's selected IDs exactly. The bounded picker searches owned products and groups. |
| Native lookup navigation | The redirect discarded the submitted product. Preserve the selection and period parameters; the lookup is read-only and works for viewers. |
| Sales inputs | Draft, held, voided and future transactions entered the forecast. Use completed sales, their completion date (entry date for legacy completed records), and an explicit IST day boundary. |
| Stale history | The model ended its series at the last selling day and started predictions in the past. Include zero-sale days through yesterday; predictions start today. Recent comparison demand is actual sales in the preceding 7/30 completed days, rather than the full-history mean multiplied by a period. |
| Update cycle | A seven-day prediction was stored with an eight-day inclusive range, and today's existing row was never refreshed. Store exactly seven days, refresh the matching uncalibrated organization forecast and serialize cycles by organization. Preserve historical and facility-specific records. |
| Group membership | Expired/future links, foreign categories and duplicate memberships distorted group forecasts. Use active memberships and owned categories/products, and count each group member once. |
| Business hours | Invalid input silently replaced settings with defaults and midnight zero became 8 AM. Validate both hours before any write, retain midnight zero, and evaluate the window in IST. The notice reflects today's Store override when applicable. |
| Overview metrics | History filters/pagination changed health values; future/expired records and overlapping predictions distorted live counts/distribution. Compute independently from current organization-wide forecasts, choose one current row per SKU and average completed accuracy records. |
| Distribution | Unequal forecast windows were compared as if they all covered 30 days. Normalize current forecast rates to a labeled 30-day estimate; largest-remainder rounding totals 100% without assigning a percentage to an empty tier. |
| Unknown actuals and CSV | Unknown actual sales defaulted to zero, while actual zero and accuracy zero exported as missing. Leave new actuals null until calibration and preserve numeric zero in CSV. Quote fields and neutralize textual spreadsheet formulas. |
| History controls | The list skipped its form despite having submit/filter controls. Retain the native form, date/ID filters, stable ordering and history-view/filter parameters on redirects. |
| Chart rendering | Manually concatenated names could break inline chart JavaScript. Use an escaped, data-derived SVG chart, with accessible descriptions and local horizontal scrolling on narrow screens. Failed/insufficient models do not become fabricated zero predictions. |
| Automatic updates | No nightly demand-cycle job was registered despite the screen promising nightly updates. Add the daily 01:30 job seed. |

## Verification

- 34 runtime assertions against isolated throwaway organizations, covering ownership, write roles, GET/CSRF rejection, hours validation, midnight, CSV zero values, completed-sales inputs, stale history, exact forecast dates, group membership and repeated refreshes.
- 7 additional assertions covering current SKU counts, pagination-independent metrics, group/month rendering, escaped product text, native detail forms and unknown actuals.
- Native history-find assertion verifies filter/view retention without placing a session token in the redirect URL. The viewer lookup assertion checks the actual forecast result, not merely HTTP success.
- Browser checks on both surfaces at 320, 375, 768, 1024 and 1536 pixels: no page-level horizontal overflow. Chart scrolling remains inside its own container. Product lookup and populated history worked in `/qapps`; no browser console errors were observed.
- XML parsing and the four repository lint guards passed. Commit hooks remain enabled.
- Throwaway records were captured by their exact primary keys and purged, including test-user visit/login records. Zero residue was verified across 17 affected tables before commit. Local review samples were recreated at the user's request, visually approved, then purged by captured primary keys before publication; zero residue verified across all 12 review tables.

No stock, prices, tax rates, legal identifiers, invoices or bill numbers were fabricated. Synthetic completed-sales quantities and predictions were confined to local throwaway organizations. No billing services or issued documents were changed; no production system was accessed.

## Review and deployment gates

The user approved the visual preview and authorized publication. Rebased onto the latest fetched master and resolved only additive stylesheet-registration overlaps while retaining newer registrations. Run repo-guards and staging acceptance against the published candidate SHA before marking the PR ready.

**Deploy gate:** review the ownership/permission changes and nightly-job registration. Load the updated job seed using the normal deployment procedure; confirm the scheduler timezone and avoid a duplicate manually configured demand job. The 30-day distribution is an estimate from current forecast rates, not thirty days of independently stored predictions.
