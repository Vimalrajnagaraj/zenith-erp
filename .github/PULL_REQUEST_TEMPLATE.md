<!-- Keep PRs to one logical change. Fill in every section. -->

## What & why

<!-- What does this change do, and why? Link any related issue. -->

## Screens / modules touched

<!-- e.g. component/zenith-erp-pos/... — and which surfaces: /apps, /qapps, both -->

## How it was verified

<!-- Ground-truth verification, not "it looks right". For write paths: throwaway tenant,
     asserted DB state, then purged. Note both /apps and /qapps if UI. -->

## Safety checklist

- [ ] **No secrets** committed (no passwords, API keys, tokens, private keys, real `.env`).
- [ ] **No customer / user / security data** in the diff, commits, or screenshots.
- [ ] **No fabricated** business/legal data (GSTIN, HSN, PAN, prices, stock, tax).
- [ ] **Org isolation** preserved — every list/detail/JSON path scopes by `organizationPartyId`.
- [ ] **Billing-path safe:** verified no-op-safe for live tenants (tested on a throwaway, not a real tenant).
- [ ] **No test data left behind** (seeded with a prefix, verified, purged by exact ids).
- [ ] **No issued bill/invoice** altered or renumbered.
- [ ] Lint guards pass locally (pre-commit hook) and in CI (repo-guards).
- [ ] Renders correctly on **both** /apps and /qapps (if UI).
- [ ] Staged explicit paths (no `git add -A` / `.`).
