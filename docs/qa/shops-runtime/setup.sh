#!/bin/sh
set -eu
CID=zenith-shops-qa-moqui-1
[ "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$CID")" = zenith-shops-qa ]
[ "$(docker exec "$CID" sh -c 'test ! -f /tmp/ci-start-moqui && echo fresh')" = fresh ]
mkdir -p /tmp/zenith-shops-qa
docker exec "$CID" sh -c 'rm -rf /opt/moqui/runtime/component/zenith-erp-*'
COPYFILE_DISABLE=1 tar --no-xattrs -czf - component | docker exec -i "$CID" sh -c 'cd /opt/moqui/runtime/component && tar xzf - --strip-components=1'
for f in Login.xml Login.ftl qapps.xml; do docker cp "docs/infra/ci/base-overrides/$f" "$CID:/opt/moqui/runtime/base-component/webroot/screen/webroot/$f"; done
docker cp docs/infra/zenith-classes/. "$CID:/opt/moqui/runtime/classes/"
docker cp docs/infra/framework-patches "$CID:/tmp/ci-framework-patches"
docker exec "$CID" sh -c 'set -eu; P=/tmp/ci-framework-patches; sh "$P/patch-webroot-nav.sh"; sh "$P/patch-webroot-breadcrumb.sh"; sh "$P/patch-webroot-qavatar.sh"; sh "$P/patch-log4j2-authzfilter.sh"; for asset in WebrootVue.qvt.js WebrootVue.qvt.min.js; do F=/opt/moqui/runtime/base-component/webroot/screen/webroot/js/$asset; sh "$P/patch-webroot-lazy-rules.sh" "$F"; sh "$P/patch-webroot-inr-grid.sh" "$F"; done; for surface in html vuet qvt; do sh "$P/patch-macro-inr.sh" /opt/moqui/runtime/template/screen-macro/DefaultScreenMacros.$surface.ftl; done'
docker exec "$CID" mkdir -p /opt/moqui/runtime/component/ci-staging-fixtures/data /opt/moqui/runtime/component/ci-billing-fixtures/data
docker cp docs/infra/ci/seed/component.xml "$CID:/opt/moqui/runtime/component/ci-staging-fixtures/component.xml"
docker cp docs/infra/ci/seed/isolation.xml "$CID:/opt/moqui/runtime/component/ci-staging-fixtures/data/CiIsolationDemoData.xml"
docker cp docs/infra/ci/seed/billing-component.xml "$CID:/opt/moqui/runtime/component/ci-billing-fixtures/component.xml"
docker cp docs/infra/ci/seed/billing.xml "$CID:/opt/moqui/runtime/component/ci-billing-fixtures/data/CiBillingDemoData.xml"

docker exec "$CID" mkdir -p /opt/moqui/runtime/component/ci-shops-fixtures/data
docker cp docs/qa/shops-runtime/component.xml "$CID:/opt/moqui/runtime/component/ci-shops-fixtures/component.xml"
docker cp docs/qa/shops-runtime/fixture.xml "$CID:/opt/moqui/runtime/component/ci-shops-fixtures/data/ShopsDemoData.xml"
docker cp docs/qa/shops-runtime/qa-screen.xml "$CID:/opt/moqui/runtime/component/zenith-erp-stores/screen/zenith/stores/ShopsQaAcceptance.xml"
docker exec "$CID" sh -lc 'cd /opt/moqui && /opt/java/openjdk/bin/java -cp . MoquiStart load types=seed,seed-initial,demo no-run-es' > /tmp/zenith-shops-qa/seed.log 2>&1
SHOP_ROWS=$(docker exec zenith-shops-qa-db-1 psql -U moqui -d moqui -Atc "select count(*) from store where store_id in ('SHOP_QA_A_S1','SHOP_QA_B_S1')")
[ "$SHOP_ROWS" = 2 ] || { echo 'Shops fixture failed to load; HTTP will stay stopped' >&2; exit 1; }
printf 'Disposable seed command and Shops DB assertion passed\n'
docker exec "$CID" touch /tmp/ci-start-moqui
