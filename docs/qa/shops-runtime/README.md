# Disposable Shops runtime verification

Run from the repository root on a machine with Docker and Python 3. This harness
uses synthetic `SHOP_QA_*` tenants only. Never install the fixture or helper screen
on production. No real tenant data or credentials are required.

## Runtime

Use the sanitized `zetaerp-moqui-clean.tar.gz` asset from the repository's
`staging-image-clean-v1` release. Verify SHA256
`0305b2d2f7124781c41de04eb8aa8a7847ee5116ee01f09dc52d7f12dc513b93`
before `docker load`, and tag the loaded image `zetaerp-moqui:clean-staging`.
The framework is the approved clean staging rebuild; it is not a byte-identical
production image. The stack binds HTTP to loopback port 18085, uses a RAM-backed
Postgres database, and has no persistent database volume.

```sh
docker compose -f docs/qa/shops-runtime/docker-compose.yml up -d
sh docs/qa/shops-runtime/setup.sh
# Wait until http://127.0.0.1:18085/Login returns HTTP 200.
python3 docs/qa/shops-runtime/acceptance.py
```

`setup.sh` requires the exact disposable Compose project and a fresh container
with HTTP still stopped. It overlays this checkout and the existing master CI
framework patches, then runs one seed loader before starting HTTP. The QA helper
requires the `stores.qa.disposable` JVM flag and synthetic selectors. Initialization
is POST + CSRF, requires the demo administrator, and refuses an already initialized
fixture. Its test accounts use the public demo hash inside this disposable database.
The viewer gets Shops VIEW access and access to the isolated QA helper, not Shops
write access.

The acceptance script refuses any destination except loopback port 18085 and
asserts the database's Compose label. It tests the real Shops services and HTTP
transitions, captures rejected-write snapshots, and asserts the invoice table is
unchanged. Results default to `/tmp/zenith-shops-qa/results/services-summary.json`.
Run once per fresh stack; do not weaken initialization checks to reuse old data.

## Browser pass

Sign in through the native local login using organization `SHOPQA`, user
`shops.qa`, and the public demo password `moqui`. Exercise both `/apps` and `/qapps`:
create, edit, operating hours, targets, holidays, search, filters, export and
pagination. Assert stored state independently with Postgres. Use `shops.viewer`
for read-only UI checks. Capture only synthetic content; never copy session tokens,
account hashes or production records into evidence.

Measure the actual browser viewport before recording a responsive pass. A requested
375-pixel override that still renders at 1280 pixels is an environment limitation,
not successful mobile verification.

## Cleanup (mandatory)

```sh
docker compose -f docs/qa/shops-runtime/docker-compose.yml down --volumes
# Every command below must return no objects:
docker ps -a --filter label=com.docker.compose.project=zenith-shops-qa --format '{{.Names}}'
docker volume ls --filter label=com.docker.compose.project=zenith-shops-qa --format '{{.Name}}'
docker network ls --filter label=com.docker.compose.project=zenith-shops-qa --format '{{.Name}}'
```

The fixture DB and local Bitronix journal live only in the removed containers;
no real database is purged. Keep the sanitized JSON results and screenshots, not
HTML dumps or container logs containing session/account information.

## GitHub gate

Run all four repository lint guards and the unchanged master
`staging-acceptance.yml` workflow with the PR's exact 40-character `candidate_sha`
and `contacts_profile=none`. The standard suite checks billing goldens, tenant
isolation and render smoke; it does not run this Shops-specific harness. Do not
present those suites as interchangeable. Maintainer review and the production
MARUTHI deploy gate remain separate from a PR or a green CI result.
