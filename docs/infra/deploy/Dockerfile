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
# Activate the tracked /qapps wrapper at the framework's served screen path. A component copy alone
# leaves the base image's wrapper active, including its stale redirect for resolved deep routes.
COPY ./zenith-erp/zenith-erp-saas/framework-overrides/webroot/screen/webroot/qapps.xml /opt/moqui/runtime/base-component/webroot/screen/webroot/qapps.xml
COPY ./MoquiDevConf.xml /opt/moqui/runtime/conf/MoquiDevConf.xml
COPY ./qz-private-key.pem /opt/moqui/WEB-INF/classes/qz-private-key.pem
# ZE-INV-012 (IV-113): patch the /qapps framework left-nav so module submenus collapse. Idempotent +
# self-verifying (fails the build if the framework menu template changed) so the fix survives image
# rebuilds. Source of truth: docs/infra/framework-patches/patch-webroot-nav.sh.
COPY ./framework-patches/patch-webroot-nav.sh /tmp/patch-webroot-nav.sh
RUN sh /tmp/patch-webroot-nav.sh && rm /tmp/patch-webroot-nav.sh
# ZE-INV-015 (IV-119): patch BOTH web shells' top breadcrumb so a crumb with subscreens NAVIGATES on a
# single click (was a menu-opener that never navigated). Idempotent + self-verifying (fails the build if
# the framework breadcrumb template changed). Source: docs/infra/framework-patches/patch-webroot-breadcrumb.sh.
COPY ./framework-patches/patch-webroot-breadcrumb.sh /tmp/patch-webroot-breadcrumb.sh
RUN sh /tmp/patch-webroot-breadcrumb.sh && rm /tmp/patch-webroot-breadcrumb.sh
# ZE-QAVATAR: /qapps header account button shows the user's INITIALS in a purple avatar instead of the
# generic Quasar account_circle icon (matches the /apps header avatar in ZenithApp.xml). Patches the same
# WebrootVue.qvt.ftl; idempotent + self-verifying (fails the build if the account button template changed).
# Source: docs/infra/framework-patches/patch-webroot-qavatar.sh.
COPY ./framework-patches/patch-webroot-qavatar.sh /tmp/patch-webroot-qavatar.sh
RUN sh /tmp/patch-webroot-qavatar.sh && rm /tmp/patch-webroot-qavatar.sh
# ZE-STORES-UI (defect_report_new_store_ui): make required/rule'd form fields validate ONLY on submit, not
# eagerly on blur (so a required field can't flash its error the moment an autofocused dialog loses focus).
# Adds lazy-rules="ondemand" to m-text-line + m-date-time q-inputs; m-form's submit still calls qForm.validate()
# so submit-time validation is fully preserved. Idempotent + self-verifying (fails the build if the field
# template changed). Source: docs/infra/framework-patches/patch-webroot-lazy-rules.sh.
COPY ./framework-patches/patch-webroot-lazy-rules.sh /tmp/patch-webroot-lazy-rules.sh
RUN sh /tmp/patch-webroot-lazy-rules.sh /opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js \
 && sh /tmp/patch-webroot-lazy-rules.sh /opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.js \
 && rm /tmp/patch-webroot-lazy-rules.sh
# ZE-INV-IV-033: suppress the benign ZTF_ASSET/ZTF_FACILITY "not included in view-entity" ERROR spam from
# ArtifactExecutionFacadeImpl. StockByFacilityView/ProductStockView LEFT-joined Asset/Facility members can't
# carry the filter's ownerPartyId alias without dropping facility-less/stock-less rows (ZE-INV-002 regression),
# so Moqui logs-and-SKIPS those filters — isolation stays intact via the Product filter. Only the log line is
# suppressed (same as the framework's own "Error warming entity cache" RegexFilter). Idempotent + self-verifying.
# Source: docs/infra/framework-patches/patch-log4j2-authzfilter.sh.
COPY ./framework-patches/patch-log4j2-authzfilter.sh /tmp/patch-log4j2-authzfilter.sh
RUN sh /tmp/patch-log4j2-authzfilter.sh && rm /tmp/patch-log4j2-authzfilter.sh
# Suppress benign EntityDbMeta "already exists" DDL-redundancy ERRORs (FKs to ZENITH_-table-name-override
# entities re-add every restart). Idempotent + self-verifying. Source: docs/infra/framework-patches/patch-log4j2-dbmeta-filter.sh.
COPY ./framework-patches/patch-log4j2-dbmeta-filter.sh /tmp/patch-log4j2-dbmeta-filter.sh
RUN sh /tmp/patch-log4j2-dbmeta-filter.sh && rm /tmp/patch-log4j2-dbmeta-filter.sh
# ZE-INR: Indian lakh/crore digit grouping (Java's DecimalFormat/locales can only do single 3-grouping).
#  (1) com.zenith.Fmt on the runtime classpath regroups a formatted number string to 3-2-2. Component XML
#      wraps explicit ec.l10n.format currency calls (both #,##0 and #,##,##0 conventions) with zinr.inr(...),
#      a shared instance set in ZenithApp pre-actions (CSV exports deliberately left Western).
#  (2) patch-macro-inr.sh regroups <display> currency/grouped-number fields in the render macros for EVERY
#      surface: html (/apps), vuet, and qvt (/qapps). Self-verifying (fails the build if an anchor moved).
#  (3) patch-webroot-inr-grid.sh wraps m-display's displayValue (client-rendered grid cells) as a backstop.
# Source: docs/infra/zenith-classes/ + docs/infra/framework-patches/patch-macro-inr.sh + patch-webroot-inr-grid.sh
COPY ./zenith-classes/ /opt/moqui/runtime/classes/
COPY ./framework-patches/patch-macro-inr.sh /tmp/patch-macro-inr.sh
RUN for m in html vuet qvt; do sh /tmp/patch-macro-inr.sh /opt/moqui/runtime/template/screen-macro/DefaultScreenMacros.$m.ftl; done && rm /tmp/patch-macro-inr.sh
COPY ./framework-patches/patch-webroot-inr-grid.sh /tmp/patch-webroot-inr-grid.sh
RUN sh /tmp/patch-webroot-inr-grid.sh /opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js \
 && sh /tmp/patch-webroot-inr-grid.sh /opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.js \
 && rm /tmp/patch-webroot-inr-grid.sh
