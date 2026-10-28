# Migration UI parity regression report

Scope: the native product importer, its product lookup/export, terminal setup and pricing pagination. No migration datasets, database dumps, credentials or customer screenshots are included.

| Defect | Root cause | Correction |
|---|---|---|
| Product add/import fails with JSON parse error on `/apps` | Import requests used only the Quasar Vue session token; the Bootstrap page supplied none. | Render the existing session token on both surfaces, read it before the Vue fallback, and report HTTP/session failures clearly. Escape names and server errors shown in import feedback. |
| Terminal create/update does not save on `/qapps` | Method-specific transition lookup made the Quasar macro render a navigation form, issuing GET. | Make the transition discoverable to the macro; require POST and a matching session token before the existing module/organization guards and writes. |
| Product-pricing page size appears to change but does not navigate | Quasar inline-handler scope did not expose the bare `URL` constructor. | Use `window.URL`, retaining filter parameters and resetting the page index. |
| Import lookup misses existing products in a large catalog | It limited the first 500 products before applying the name/SKU search. | Apply the case-insensitive predicate in the query before limiting the result to 12. |
| Import export/search relied on implicit tenant filtering | Export had no explicit product-owner condition; lookup had a no-org all-records fallback. | Scope to the organization already authorized by the POS parent, with a fail-closed sentinel. |

## Reproduction and verification

A fresh disposable local Moqui/Postgres stack used the clean staging image, current repository components and tracked framework patches. No production writes or production migration data were used.

- Before: Bootstrap CSV import produced the reported JSON parse error; DB contained no corresponding product.
- Before: Quasar terminal Create navigated to `createTerminal?...`; DB contained no new terminal.
- Before: Quasar page-size change raised `TypeError: URL is not a constructor`.
- Before: search missed a known product with more than 500 alphabetically earlier own-org products.
- After: CSV paste on both surfaces created exactly one own-org product per unique SKU; repeating a SKU updated the existing record. A negative-price row was rejected and created nothing.
- After: Quasar terminal create and update persisted under the authorized organization; Bootstrap create also persisted.
- After: pricing page size changed the URL and retained the selected value on reload.
- After: the late-catalog product was returned and selected into edit mode; an other-org lookup returned no match. The native CSV export contained 511 own-org products and excluded both other-org records.
- Unit check: `node docs/qa/migration-ui-parity/check-import.cjs` covers both token sources, POST encoding, missing sessions, HTTP failures, and HTML escaping.
- JavaScript syntax, XML parsing and all four repository guards pass locally.
- No bills/payments were created. Database checks showed zero POS transactions and payments.

The previously reported New Store popup failure did **not** reproduce on current master in Bootstrap; no speculative Shops change was made. Source data with missing prices, duplicate phones and differing shop prices requires explicit migration decisions, not altered validation rules.

## Deployment and remaining gates

Not deployed. Merge and deployment remain separate. Review the transition/CSRF changes and recheck on a disposable deployment tenant; never use real tenant records for writes. The existing POS script URLs use resource last-modified versions, so the updated asset is already cache-busted.

CI and cleanup evidence are recorded in the PR after verification completes. Native file-chooser upload, all possible malformed CSV formats and unrelated POS workflows are not claimed as exhaustively tested.
