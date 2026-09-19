# Security Policy

ZetaERP is a live, multi-tenant SaaS holding real customer, billing, and tax data. Security is
everyone's responsibility on this team.

## Reporting a vulnerability

Do **not** open a public issue or PR for a security problem. Report it privately to the owner
(repository admin) directly. Include the class of problem and how to reproduce it — do **not**
include a working exploit or a step-by-step data-extraction path in writing.

## Secrets

- **No secrets in git — ever.** No passwords, API keys, tokens, private keys, or real `.env`
  files. Real config lives in the server `.env` and the app's `CompanySettings`.
- `.env` and common key/cert file types are git-ignored. Keep example files
  (`*.env.example`) filled with **placeholders only** (e.g. `rzp_live_xxxx`).
- If a secret is committed by accident: **rotate it immediately** (deleting the commit is not
  enough — assume it is compromised) and tell the owner.

## Multi-tenant isolation

Cross-tenant data exposure is the highest-severity bug class here. Every list, detail, and
JSON transition must scope by `organizationPartyId`. Screen transitions run outside the
active-org entity filter, so they must scope org **explicitly**. Use the org-scoped
`PartyPicker`, never the stock non-org-aware lookup. Detail/edit screens must assert access on
the requested id (IDOR guard) before rendering or mutating.

## Live-data safety

- Billing paths must be **no-op-safe for live tenants**; verify on a throwaway tenant.
- Never alter or renumber an already-issued bill/invoice.
- On the live DB, delete only by exact captured ids.

## Access

This repository is **private**. Access is by explicit collaborator invitation only. Do not
add collaborators, deploy keys, or forks without the owner's approval.
