# Moqui 4.0.0 framework base, pinned BY DIGEST for reproducible rebuilds. This is the maintained
# ghcr.io/moqui/moqui-framework:latest as of 2026-07-09; its moqui-framework-4.0.0.jar is byte-identical
# (md5 df7e767ac4dbefdb4aac35fbccb86192) to the running image's, runtime/version.json matches (framework
# head d12a86e1ac / runtime tag v4.0.0), and its User/Entrypoint/Cmd are identical to the running image
# (root, /__cacert_entrypoint.sh, MoquiProductionConf.xml). So this reproduces the SAME Moqui the live app
# runs. To upgrade Moqui, deliberately bump this digest.
#
# NOTE: the base (and the running image) run as ROOT — there is no `moqui` user. The previous host
# Dockerfile had `FROM moqui/moqui:latest` + `chown moqui:moqui` + `USER moqui`; that base no longer
# resolves and no `moqui` user exists, and the running image is NOT `USER moqui` (Config.User is empty),
# so those lines were stale and are removed. Do NOT re-add a chown to a moqui user against this base.
FROM ghcr.io/moqui/moqui-framework@sha256:6bd31bf1123f4871a5831fe35617fe719c4197a5f14e21547e9357d4d203ef34
# The base carries a STALE copy of the zenith-erp-* components. COPY merges (it doesn't delete files that
# were later removed from the app), so overlaying onto the base resurrects since-deleted screens. Clear the
# base's zenith components first so the COPY below is an EXACT reproduction of the current component tree.
RUN rm -rf /opt/moqui/runtime/component/zenith-erp-*
COPY ./zenith-erp/ /opt/moqui/runtime/component/
COPY ./MoquiDevConf.xml /opt/moqui/runtime/conf/MoquiDevConf.xml
COPY ./qz-private-key.pem /opt/moqui/WEB-INF/classes/qz-private-key.pem
# ZE-INV-012 (IV-113): patch the /qapps framework left-nav so module submenus collapse. Idempotent +
# self-verifying (fails the build if the framework menu template changed) so the fix survives image
# rebuilds. Source of truth: docs/infra/framework-patches/patch-webroot-nav.sh.
COPY ./framework-patches/patch-webroot-nav.sh /tmp/patch-webroot-nav.sh
RUN sh /tmp/patch-webroot-nav.sh && rm /tmp/patch-webroot-nav.sh
