# Proposal — a safe auto-deploy pipeline for ZetaERP

**Status:** Draft / proposal (not adopted). **Audience:** owner + maintainers.
**Scope:** how a change on GitHub `master` could reach the live container with less manual toil,
**without** giving up the "verified before it's live" guarantee of today's hand-run flow.

> This is a **live commercial multi-tenant SaaS**. Read [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md),
> [`../../SECURITY.md`](../../SECURITY.md) and [`../SOP-commit-and-deploy.md`](../SOP-commit-and-deploy.md)
> first — their non-negotiables override anything here.

## Why

Today GitHub and production are kept in sync by discipline (see the SOP's *"Keeping GitHub in sync
with production"*): a change only reaches prod by being deployed **from the repo**, direct container
edits are forbidden, and `audit-live-sync.sh` runs daily to catch drift. It works, but every deploy
is a manual sequence (upload → `docker commit` → `restart` → poll → verify both surfaces) that only
the owner can run — so merged PRs sit undeployed until someone does it by hand.

The goal of this proposal is to **automate the toil while keeping the safety**, and to make the
git→prod lag small and visible instead of dependent on someone remembering to deploy.

## Invariants this pipeline must never break

Carried verbatim from the manual flow — these are hard gates, not aspirations:

1. Nothing reaches prod **unverified** (rendered on `/apps` **and** `/qapps`, ground-truth checked).
2. Any billing-path change is **no-op-safe for MARUTHI** (org `100000`), proven on a throwaway tenant.
3. **No secrets, no customer/user data, no fabricated GSTIN/HSN/PAN/prices** ever ship.
4. **Instant rollback** is always available.
5. `docker compose restart moqui` — **never `up -d`** (recreate discards in-container state).
6. `docker commit` to the **tag** `zetaerp-moqui:latest` + `docker image prune` every time — the
   untagged-commit disk-fill once caused a whole-site outage ([[deploy-disk-commit-hazard]]).
7. **One deploy at a time** (a deploy lock); git stays the **source of record**.
8. **No direct container edits, ever** — the pipeline is the only path to prod.
9. Never alter or renumber an already-issued bill/invoice (including during rollback).

## The shape — "verify on ephemeral staging, promote to prod behind a gate"

```
PR ──► merge to master  (CI: lint guards + review + secret/customer-data scan)
  │
  ▼
[Build]  zetaerp-moqui:<sha>   (from docs/infra/deploy/Dockerfile; QZ key from a secret store, not git)
  │
  ▼
[Ephemeral staging — OFF prod]  boot moqui + postgres (+opensearch opt.), seed a DEMO tenant
  │     and a MARUTHI-SHAPED throwaway tenant, deploy the change, then run acceptance:
  │       • render changed screens + a fixed smoke set on /apps AND /qapps  → 200, no error
  │       • org-isolation asserts (tenant A cannot see tenant B — DB ground truth)
  │       • billing no-op smoke (only if diff touches a billing path): cash/card/split sale on the
  │         MARUTHI-shaped tenant → bill mints, pricing/tax == a golden baseline
  │       • purge test data (residue 0) → tear the stack down
  ├── fail ─► block, report on the commit/PR, notify.  NEVER touches prod.
  ▼ pass
[Risk tier]   docs / CSS / non-billing  ──► auto-promote
              billing / auth / org-isolation / entity / service  ──► HUMAN one-click approve
  │
  ▼
[Prod deploy job]  acquire lock → df check → BACKUP changed files (tar) → upload →
  docker commit :<sha> + retag :latest → prune → compose restart moqui (NOT up -d) →
  poll 200 → post-deploy smoke
  ├── poll/smoke fail ─► AUTO-ROLLBACK (restore backup / re-tag previous image) + restart + alert
  ▼ pass
[Confirm]  audit-live-sync.sh asserts git == prod (byte-identical) → log the deploy (sha, approver,
           time) → notify.
```

## The three gates that make it safe

1. **Ephemeral staging acceptance (the core).** Every merge is deployed to a *throwaway* stack and
   put through the same checks the owner does by hand today — Puppeteer render on both surfaces,
   org-isolation asserts, and a **MARUTHI-shaped billing smoke** (a seeded tenant mirroring MARUTHI's
   plan/pricing, so "no-op-safe for MARUTHI" is proven **without using MARUTHI's data**). It runs
   off-prod, so a bad change never reaches a live tenant. This is what replaces "the owner eyeballed
   it." Reuses [[reference_pos-terminal-puppeteer-harness]] and [[reference_throwaway-tenant-seed]].

2. **Risk-tiered human gate.** A path classifier (same idea as the pre-commit lint guards, plus
   `CODEOWNERS`) splits changes: pure docs/CSS/presentation auto-promote after green staging;
   anything touching **billing, auth, org-isolation, entities, or services** requires a **one-click
   human approve**. The hand stays on the wheel exactly where it matters; toil is dropped where it
   doesn't.

3. **Auto-rollback on the prod job.** The prod step backs up the current files first (the same tar
   approach used for a manual verify-then-rollback) and keeps the previous image tag; after `restart`
   + poll it runs a smoke check, and if 200 never comes or smoke fails it **restores and restarts
   automatically** before users notice. The `df` check + commit-to-tag + prune make the disk-fill
   outage unrepeatable.

## New infrastructure required (honest list)

- **An ephemeral staging environment** — the biggest new piece, and the thing to build **first**.
  - *Recommended:* spin it up inside the CI runner per-change and tear it down (off-prod, no standing
    cost). The ~1.8 GB image + Moqui heap is tight on a hosted runner → tune the heap down, or use a
    small **dedicated staging VM** for headroom.
  - *Avoid:* a second compose project on the prod host — it shares RAM and failure domain with
    production.
- **A controlled staging image.** Earlier anonymous/cross-org GHCR pulls returned 403. CI now uses
  the audited `staging-image-clean-v1` release asset, assembled from public dependencies and an
  allowlisted runtime with the matching framework JAR. Its checksum is verified before loading;
  no production image layers, environment, database or signing keys are reused. The old
  `staging-image-v1` archive is refused. See [runtime provenance and checks](../qa/ci-staging-repair/README.md).
- **Versioned seed fixtures** — a demo tenant + a **MARUTHI-shaped** tenant (synthetic plan/pricing;
  never prod data), kept in the repo under `docs/infra/ci/seed/`.
- **A deploy runner with scoped prod access** — a GitHub Actions self-hosted runner, or a hosted
  runner using a stored deploy key. Prefer a **least-privilege deploy user**, not `root`.
- **A secret store** for the QZ signing key and any build secrets (GitHub Actions secrets / a vault)
  — never in git. Staging builds use a **dummy** QZ key (receipt signing is irrelevant to rendering).
- **A deploy lock + an audit log** (who/what/when/sha/approver) + **CODEOWNERS** + the path-based
  risk classifier + a **monitoring/alert** hook for the post-deploy watch window.

## What stays manual (v1 non-goals)

- **DB / entity schema migrations** — auto-applying schema changes to a live multi-tenant DB is a
  different risk class; keep them human-run with explicit review.
- **Fully hands-off deploys of billing/auth/isolation paths** — always a human approve.
- Anything the staging acceptance can't yet cover stays a manual verify.

## Phased rollout (earn the trust)

- **Phase 1 — report-only staging acceptance.** Load the pinned clean staging runtime
  (published as the `staging-image-clean-v1` release asset), overlay the
  checked-out component tree, boot the ephemeral stack, and run the render smoke on demand (and
  later on every merge), **reporting** pass/fail. No auto-deploy. Prove the gate catches real
  problems for a few weeks. *(Starter workflow:
  [`../../.github/workflows/staging-acceptance.yml`](../../.github/workflows/staging-acceptance.yml),
  staging stack [`ci/docker-compose.staging.yml`](ci/docker-compose.staging.yml), smoke
  [`ci/smoke.mjs`](ci/smoke.mjs).)*
  - **Status: implemented — 7 screens on /apps AND /qapps.** Runs on master pull requests,
    master pushes and manual dispatch; assess the result for the exact tested commit. Three
    requirements keep staging reproducible:
    1. **Pinned clean image** → verify its audited checksum before loading and overlay the
       checked-out application components.
    2. **The image lacks the container-only base overrides** `Login.xml`/`Login.ftl`/`qapps.xml`
       (prod bind-mounts them; `docker commit` doesn't capture mounts) → overlay the snapshots in
       `ci/base-overrides/`, or stock `/qapps` redirect-loops.
    3. **Login/data** = Moqui's `demo` load via `java -cp . MoquiStart` (exploded runtime, java at
       `/opt/java/openjdk/bin/java`) gives `john.doe`/`moqui`; a per-screen **retry** absorbs a
       transient Moqui session race on the /qapps SPA (`Invalid for read` → `Response is committed`).
  - **Deeper acceptance — org-isolation: implemented & green.** Beyond "does it render", the workflow
    now seeds two throwaway tenants (`docs/infra/ci/seed/isolation.xml`), makes `john.doe` an internal
    agent of Tenant A, and asserts the live contacts page shows Tenant A's contact and **not** Tenant
    B's — real active-org scoping, gated on DB ground truth so a load failure or a stripped pref fails
    precisely. Four more gotchas surfaced building it (all in the workflow comments):
    1. **CI has no OpenSearch** → keep `elasticsearch_url` empty and indexing disabled. The clean
       runtime also disables external SMTP and automatic jobs; CI requires no production secrets.
    2. **`MoquiStart load` with both `types=` and `location=` loads ONLY the location** (suppresses
       types) → demo never loads, login 302. Use one normal types-based discovery invocation.
    3. **A concurrent HTTP JVM owns the loader's Bitronix journal/schema.** Keep HTTP idle until
       overlays, the single discovery loader and required-record assertions finish. The temporary
       fixture component depends on contacts and uses `type="demo"`; one bad row rolls back its file.
    4. The framework seed creates the `john.doe` **UserAccount but no mantle Party** → create the
       person party + link it, or the party-based org membership FK-fails.
  - **Deeper acceptance — MARUTHI-shaped billing no-op smoke: implemented & green.** A synthetic
    MARUTHI-shaped tenant (tax-exclusive + GST, the three POS modes; synthetic values, never prod
    GSTIN/HSN/prices — `docs/infra/ci/seed/billing.xml`) plus a headless driver
    (`docs/infra/ci/billing.mjs`) that replays the /apps mint transitions (there is no REST) for a
    RETAIL cash, WHOLESALE cash, EMPLOYEE cash, and a split-tender sale. psql then asserts the stored
    per-mode price, per-slab CGST+SGST, whole-rupee rounding, and split reconciliation against a golden
    baseline (DB ground truth) — this is what proves "no-op-safe for MARUTHI" without MARUTHI's data.
    Two more gotchas surfaced:
    1. **Entity-embedded `<seed-data>` isn't applied by the CI types-load** — the POS price-source
       enums, sales modes, and status items live in `<seed-data>` blocks inside `PosEntities.xml`, and
       geo/state data is `type="install"` (skipped), so `PsOpen`/`PosSalesMode`/`IndiaState` are absent
       and the FKs roll the whole fixture file back (Moqui loads each file in one transaction). Seed
       what the mint path needs directly in the fixture.
    2. **Web must not run during the load** — web and the `docker exec` load JVM share one Bitronix
       tx-log (`/opt/moqui/runtime/txlog/btm*.tlog`); whichever boots first wins the lock, so the
       container is held (web off) until the load finishes, then released. (This also de-flaked the
       earlier checks, which had been winning the race by luck.)
- **Phase 2 — auto-deploy the trivial tier.** docs/CSS/presentation auto-deploy after green staging;
  one-click approve for everything else. This is a comfortable place to sit for a long time.
  - **Groundwork done (report-only):** the risk classifier that this tiering needs is built and runs
    on every PR/push — [`ci/classify-risk.sh`](ci/classify-risk.sh), surfaced in the run's job summary
    by the `Classify change risk` step. It labels a change `trivial` (only docs / CI / presentation
    assets — nothing that ships to the container) or `sensitive` (any component code, service, entity,
    script, or billing/auth/tax/isolation path), erring toward `sensitive`. It **only reports** — no
    deploy job exists yet. Standing up the actual prod-deploy half still needs owner decisions (the
    *Open decisions* below): a deploy runner with scoped prod access, where the QZ key / deploy
    credentials live, the approvers, and the `CODEOWNERS` map. Nothing touches prod until those are set.
  - **Build + prod-deploy mechanism built & proven (2026-10-17): [`build-from-git.sh`](build-from-git.sh).**
    This is the `[Build]` + `[Prod deploy job]` boxes above, as a single on-host script. It makes **git the
    mechanical source of truth**: the app `component/zenith-erp-*` tree comes straight from `git` at a ref,
    the Moqui infra (Dockerfile, framework-patches, conf) + the host-only QZ secret come from the host, and
    it runs a **COPY-based `docker build`** on the prod host (the only place the pinned base is cached — GHCR
    403 elsewhere). Prod then moves by **re-tagging** the freshly built image, never by `docker commit` of a
    mutated container — which **eliminates both the build-context drift** (the context's app tree is git, not
    the running container) **and the per-deploy commit/rollback-image churn** behind the disk-fill outages.
    Two modes: `candidate [REF]` builds `:gitbuild-<sha>` and boot-verifies it in a throwaway pg+moqui stack
    (127.0.0.1:8099, empty DB → expect login 302/401) with **zero prod impact**; `promote [REF]` tags a
    rollback, re-tags `:latest`, refreshes the canonical context, `compose restart`s (never `up -d`), polls,
    and **auto-rolls-back** if health never returns. It carries the same single-flight `flock` + disk-guard +
    rollback-tag-trim as the hardened manual pipeline. **Verified 2026-10-17:** `candidate master` builds in
    ~13 s and boots clean (302, no screen/service/Groovy parse errors); an A/B control proved the git-built
    image is behaviorally identical to the deployed `:latest` (same empty-DB cold-load FK noise, which is
    intrinsic and absent on real prod). DB/entity-schema migrations and seed/data loads stay **out of scope**
    (manual), exactly as the non-goals above. `promote` is human-invoked today; a CI deploy runner can call it
    once owner decisions 2/4/5 are made.
- **Phase 3 — widen the auto tiers** as confidence grows; add monitoring-driven auto-rollback.

## The honest tradeoff

Even done well, auto-deploy raises the baseline chance that a bad change reaches prod versus today's
fully hand-verified flow. The staging acceptance, the MARUTHI billing smoke, the human gate on risk
paths, and auto-rollback are precisely what buy that back. **The whole thing lives or dies on a
trustworthy ephemeral staging env** — without one, "auto-deploy" is just a faster way to break
production. So staging is step one, and Phase 1 (report-only) is the safe way in.

## Open decisions (for the owner)

1. Staging on a hosted runner (cheap, tight on RAM) vs a dedicated staging VM (clean, costs money)?
2. Self-hosted deploy runner on/near the prod host vs a hosted runner with a stored deploy key?
3. How faithful must the MARUTHI-shaped seed be (which plan, price lists, GST config) to trust the
   billing smoke?
4. Where the QZ key and deploy credentials live (GitHub secrets vs an external vault)?
5. Who are the approvers for the human gate, and what's the `CODEOWNERS` map for risk paths?
