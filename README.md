# ZetaERP (Zenith)

> Proprietary, multi-tenant **POS / ERP SaaS** built on the **Moqui Framework 4.0**.
> Live at **https://erp.zetaclantech.com**.

ZetaERP is a full ERP suite (POS, Sales, Purchase, Inventory, Accounting, CRM, HR,
Manufacturing, Pricing, Subscriptions, Tax/GST, and more) delivered as a multi-tenant
SaaS. Each tenant is an isolated organization; the platform bills tenants and the tenants
run their own retail/wholesale businesses.

**This is a private, proprietary repository.** See [`LICENSE`](LICENSE). Do not share, fork,
or publish any part of it outside the team.

---

## ⚠️ Read this before you touch anything

This repo backs a **live commercial system with real customer data**. A handful of rules are
non‑negotiable — they are spelled out in [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`SECURITY.md`](SECURITY.md). The short version:

1. **Never commit secrets** — no passwords, API keys, tokens, private keys, or real `.env`
   files. Real config lives in the server's `.env` / the app's `CompanySettings`, never in git.
2. **Never expose** customer, user, or security data in code, commits, issues, or PRs.
3. **Never fabricate** business/legal data (GSTIN, HSN, PAN, prices, stock) — ask the owner.
4. Any change on a **billing path must be no‑op‑safe for the flagship tenant** (MARUTHI,
   org `100000`). Verify on a throwaway tenant, never on a live one.
5. **Clean up all test data** after verifying.
6. **Never alter or renumber an already‑issued bill / invoice.**

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Moqui Framework 4.0 (Java / Groovy) |
| Screens & logic | XML screens + entities + services; Groovy lives inside `<script>` CDATA |
| Templating | FreeMarker |
| Database | PostgreSQL |
| Search | OpenSearch |
| UI surfaces | **/apps** (Bootstrap 3) and **/qapps** (Quasar/Vue SPA) — same XML, two renderers |
| Deploy | Docker (app + Postgres containers) behind nginx + Cloudflare |

There are **0** `.java` / `.groovy` files — everything is XML with embedded Groovy, so no Java
LSP applies.

## Two UI surfaces

The same Moqui screens render on both **/apps** (server-rendered Bootstrap) and **/qapps**
(Quasar SPA). They do **not** share utility classes, and **/qapps strips `<script>` and
`<style>` tags** from screen content (bootstrap JS there via an `<img onload>` attribute).
The shared theme lives in
`component/zenith-erp-app/screen/zenithstatic/css/zenith-theme-v4.css`.

## Repository layout

```
component/            56 Moqui components (zenith-erp-*), ~770 XML files
  zenith-erp-app/       shell, theme CSS/JS, ZenithApp.xml
  zenith-erp-base/      shared services, party picker, org scoping
  zenith-erp-pos/       point of sale
  zenith-erp-saas/      platform billing, tenants, plans, invoices
  zenith-erp-<module>/  sales, purchase, inventory, accounting, crm, hr, …
docs/
  infra/                deploy scripts, lint guards, git hooks, nginx, systemd, migrations
  qa/                   QA notes and SOPs
  security/             security notes
  superpowers/          design plans & specs
.github/workflows/    repo-guards CI (runs the static lint guards on every push/PR)
```

Modules present: `accounting analytics app approvals assets attendance barcode base contacts
crm discuss distribution documents ecommerce events expenses fieldservice fleet franchise
giftcard helpdesk hr india integrations inventory loyalty maintenance manufacturing marketing
omnichannel payroll plm pos pricing project promotions purchase quality recruitment rental
returns saas sales settings sign stores studio subscriptions tax timeoff timesheets uae uk
us website workshop`.

## Getting started

```bash
git clone https://github.com/<owner>/zenith-erp.git
cd zenith-erp

# Arm the pre-commit lint guards (do this once per clone)
sh docs/infra/install-git-hooks.sh
```

This repo is the **working copy / source of truth for source**. The running system is the
Docker container on the server; changes are deployed to it (see
[`CONTRIBUTING.md`](CONTRIBUTING.md) and `docs/infra/`). Ask the owner for server access and
the deploy walkthrough — infra credentials are **not** in this repo.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short:

- Branch from `master`; never commit straight to `master`.
- Run the lint guards locally (the pre-commit hook does this automatically); the same guards
  run in CI on every push and PR and **cannot be skipped**.
- One logical change per PR; fill in the PR checklist.
- End of the road for any change: it must be **safe for live tenants** and leave **no test
  data** behind.

## License

Proprietary — **All Rights Reserved**. See [`LICENSE`](LICENSE).
