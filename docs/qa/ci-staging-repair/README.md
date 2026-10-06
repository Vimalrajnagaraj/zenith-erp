# Staging runtime and seed repair

The acceptance workflow now requires the private [`staging-image-clean-v1` release](https://github.com/amalnathkp13-boop/zenith-erp/releases/tag/staging-image-clean-v1), with asset `zetaerp-moqui-clean.tar.gz`. Its pinned SHA256 is `0305b2d2f7124781c41de04eb8aa8a7847ee5116ee01f09dc52d7f12dc513b93`. The workflow checks this checksum before `docker load` and explicitly rejects the known unsafe original archive. It does not load that original archive or reuse its image layers, environment, databases or signing keys.

The fresh image contains public OS/Java dependencies and an allowlisted Moqui runtime. CI overlays this checkout's application components, shared classes, base webroot overrides and framework patches. Its temporary `ci-staging-fixtures` component loads the synthetic isolation records through normal data discovery, after contacts prerequisites. The loader uses one `types=seed,seed-initial,demo` invocation with no `location`: an explicit location bypasses normal framework/component discovery.

The compose container initially waits for `/tmp/ci-start-moqui`. This keeps the HTTP JVM from owning the same Bitronix transaction journal or schema while the loader runs. Required login, organization, relationship and tenant-owned contact records are asserted in PostgreSQL before the workflow creates the marker and starts HTTP. Existing login, isolation and both-shell smoke gates then run. A manual compose run needs the same overlays, seed and assertions before creating the marker; see the compose comments.

[Sanitized verification evidence](verification.json) records:

- Four repository guards passed, with `git diff --check` clean.
- Forty-five workflow/compose syntax, checksum rejection, candidate input and lifecycle/discovery checks passed. Local checksum behavior tests use Python SHA256 and field-extraction shims because the Windows Git bundle omits those coreutils; Ubuntu CI uses its real tools.
- Eleven committed framework patch applications passed against scratch copies of clean-image assets. These checks used the Windows GNU Git tools; the image itself was unchanged.
- A separate fresh native Java21/H2 database loaded 7,706 records in one discovery call. Six read-only required-record checks passed. Authenticated All Contacts returned HTTP 200, showed the synthetic active tenant's contact and excluded the foreign tenant's contact.
- The native loader skipped 30 unrelated existing demo/region/index files. Required records and live scope were checked independently. This local proof does not establish complete demo-data loading or Linux/PostgreSQL acceptance.
- The separate native CI server was stopped, and only its four task-specific disposable H2/Bitronix files were removed. The reusable runtime and the customer-group UI QA environment were retained.

The original repair passed Linux/Docker/PostgreSQL acceptance in [run 37454821875](https://github.com/amalnathkp13-boop/zenith-erp/actions/runs/37454821875). That proves the original repair commit; subsequent changes need their own run. No production access, merge or deployment was performed. Raw runtime logs, HTTP bodies, local machine paths and credentials are excluded from this evidence.

## Pinned candidate checks

Manual dispatch can keep this clean-image workflow while checking another same-repository commit. Supply its exact 40-character `candidate_sha`; the workflow checks out that SHA separately and overlays its application components. The clean runtime, framework patches, lifecycle and foundation fixture stay controlled by this workflow's checkout. This allows older PRs to be verified without running their earlier staging workflow.

`contacts_profile=none` runs the existing login, isolation and seven-route smoke checks. `ui` additionally requires `docs/qa/contacts-ui-runtime/{fixture.xml,verify-runtime.cjs}` from the candidate. `security` uses the corresponding `contacts-security-runtime` directory and its authenticated, synthetic-fixture-restricted QA screen. The latter is copied only into the ephemeral CI runtime; it is never part of a deployed component. Both profiles require a candidate SHA, load their fixtures after the foundation fixture, and run browser/database assertions with the seeded public demo login. Sanitized profile evidence is retained for 14 days, and the stack's volumes are removed on every outcome.
