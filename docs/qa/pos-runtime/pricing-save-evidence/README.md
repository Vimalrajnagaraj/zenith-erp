# POS-01-04 / POS-01-06: pricing save and history

Vimal Raj's 17 October reports show the same raw JSON parser error. On `/apps`, the Save handler read only Quasar's Vue token, sent an empty token and received the framework's HTTP 401 text. Parsing `401 Session token required ...` as JSON produced the reported character-position error. A valid-token request to the unchanged endpoint succeeded.

The screen now provides its session token and canonical save URL. A shared external handler works on both shells, binds once through SPA navigation, and handles denied/non-JSON responses without displaying a parser exception. Server write permission, product ownership, pricing validation and CSRF checks remain enforced. Hidden mode prices remain absent from row saves.

The restored Back/Forward test also reproduced Quasar's initial mount pushing its already-current URL. A one-use POS bootstrap replaces only that initial self-entry, then restores the native history function. Ordinary navigation continues to push history. The bootstrap loads before WebrootVue in the production and disposable CI overrides.

Native disposable Moqui/H2 with real Chrome: **696 checks passed**, 56 pages, 100 layout checks, zero failures and zero browser errors. Pricing cases assert 500/600 in independent synthetic shops, persistence after refresh/Back/Forward, one POST per click after navigation, validation/CSRF/foreign-shop denials, and restoration of both original prices. The in-memory database was stopped and its port closed; no test records remain. These are synthetic QA values, never production writes.

`verification.json` summarizes this run. Screenshots show the controlled session message. The same cases run in `staging-acceptance` against PostgreSQL. Native results do not substitute for the final GitHub candidate run or authorize production deployment. The owner should verify the new asset and Quasar override are deployed together and perform the prescribed live read-only/no-op checks before deployment.
