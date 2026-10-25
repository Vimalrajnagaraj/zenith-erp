# Clean production shop migration

This workflow creates a **new** workspace. It copies no data from an existing
ZetaERP test account: no old products, customers, suppliers, bills, credits,
balances, payments, stock, sessions, users or settings. The only data source is
the separately supplied legacy POS SQLite catalog, plus reviewed new-workspace
configuration. Merging this PR does not execute a migration or delete live data.

## Prepare privately

Copy `config.example.json` to a private location outside the repository. Replace
the synthetic values with the chosen company ID, new workspace code, real shop
and counter names, new owner email and two cashier logins. The owner plus two
cashiers gives three logins; the three counters may be used by those authorized
users. `ACTIVE_SHOP` selects a starting shop, **not an additional authorization
restriction** on cashiers within their own organization.

Verify the legacy `proactive` flag's meaning and set `activeFlagValue` explicitly.
Likewise review whether source prices include GST. Map every source unit to a
real Moqui UOM; never silently turn boxes or packs into pieces. Do not copy
passwords or access tokens from the competitor backup or old test account.

```sh
python docs/infra/clean-workspace/prepare.py /private/source.db \
  --config /private/new-workspace.json --out /private/catalog-bundle.json
```

The converter opens SQLite read-only, checks integrity and verifies an unchanged
SHA-256. It selects only the configured company's price rows. Retail is
`comrate1`; wholesale is `comrate2`; `commrp` is retained separately as legacy
metadata, since ZetaERP's `mrpAmount` is the POS retail selling price. Source IDs
become unique `SRC-company-id` SKUs; duplicate human display codes remain in
metadata and never merge different items. Names, local names, units, categories,
HSN and the separate CGST/SGST rates are retained. Explicit source barcodes are
validated by the existing Barcode service. Display codes are not automatically
installed as scan aliases when they are duplicated.

Exit code 2 means unresolved source issues remain. The private bundle lists
missing company prices, zero/negative/over-precision prices and unknown units.
Resolve them from authoritative shop records, or record exact reviewed source
IDs in `excludeSourceIds` and regenerate to a NEW output file. Do not fill missing
prices from another company or manufacture free sellable items. Inactive-source
exclusions and orphan-price counts remain visible for reconciliation. A server
preview refuses unresolved issues. Keep the original DB, bundle and review report
private; **none belong in Git or a PR attachment**.

## Preview, then apply

Deploy only after review through the normal maintainer process. Sign in as the
**platform ADMIN**, open **SaaS Admin → Clean Workspace** on `/apps` or `/qapps`,
and paste the private bundle into Preview. The service validates a unique new
workspace code and usernames, exactly two shops/three counters/three users,
plan limits, positive mode prices, real UOMs and an exact active zero-cess GST
slab matching the source rates. No tenant/user/product records are created by
preview. Keep its SHA-256 digest.

Apply requires the **identical bundle**, its digest and three new passwords.
The framework's normal password policy remains enforced; no password is printed
or stored in the bundle/audit. The whole new workspace is one transaction:
existing onboarding provisions its organization/owner/default facility; the shop
service adopts that new facility and creates the second shop; three new counters
and two employee cashier accounts belong to the new organization. Products and
organization-owned retail/wholesale modes are shared by both shops, giving
identical prices without duplicating catalogs. Global modes/plans are untouched.
Late validation/service failure rolls the entire import back. Replaying a bundle
refuses existing workspace/user identities rather than adopting or overwriting
them. Save the successful new organization/tenant identifiers privately.

This operation includes an **explicit platform-admin, audited non-expiring manual
access grant** for this new tenant, with the required reason in the bundle.
It creates no subscription invoice or payment, has no renewal/trial/end date,
and uses the existing manual-grant exclusion from renewal and expiry jobs.
An additional `MANUAL_PLAN_PERMANENT_SUBSCRIPTION` marker must identify the exact
active manual subscription. An undated grant without this matching explicit
marker remains blocked; a stale or foreign marker cannot unlock access.
It does not change shared plan prices, other tenants' entitlements, password
expiry or browser/session security. The platform operator must approve this
specific business entitlement; choosing a plan is not evidence of payment.

## Verify before trading and retire old testing access

Verify three independent logins, exactly two shops and three counters, both mode
prices against the source, categories/barcodes, tenant isolation and zero copied
historical transactions. Reconcile excluded/ambiguous source records. Configure
the shop's verified legal/tax registration and receipt details. Reconcile opening
stock and genuine opening balances separately; **no opening stock/balance is
inferred or fabricated by this import**. Exercise tax on/off, all intended
tenders and 80 mm receipts in a disposable clone before a production handover.

Only after the replacement has been verified, have the platform operator capture
a restorable server backup and an exact old-login retirement list, then retire
those specific test logins through the supported account workflow. Do not retire
the operator's active login or unrelated tenant users. Existing issued documents
remain outside the new workspace and outside this importer. This PR intentionally
does not bypass protected-organization/issued-document purge guards or provide a
global DELETE. The user's lack of need for old test data does not require copying
it into the new workspace or editing issued records to make a purge succeed.

## Tests

```sh
python docs/infra/clean-workspace/test_prepare.py
```

The POS disposable suite invokes `verify-clean-workspace.cjs` against the actual
services and independently reads database state. It covers preview/no writes,
malformed/foreign data, digest mismatch, tenant-admin denial, late rollback,
source-ID collisions, separate mode prices, no historical data, new logins and
both admin surfaces. It runs only with `pos.qa.disposable=true` and synthetic
`cleanqa-*` / `example.com` identities; the entire tmpfs/memory DB is destroyed
after verification. Do not deploy QA fixtures/helpers.
