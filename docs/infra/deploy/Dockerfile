FROM moqui/moqui:latest
COPY ./zenith-erp/ /opt/moqui/runtime/component/
COPY ./MoquiDevConf.xml /opt/moqui/runtime/conf/MoquiDevConf.xml
COPY ./qz-private-key.pem /opt/moqui/WEB-INF/classes/qz-private-key.pem
# ZE-INV-012 (IV-113): patch the /qapps framework left-nav so module submenus collapse. Idempotent +
# self-verifying (fails the build if the framework menu template changed) so the fix survives image
# rebuilds. Source of truth: docs/infra/framework-patches/patch-webroot-nav.sh.
COPY ./framework-patches/patch-webroot-nav.sh /tmp/patch-webroot-nav.sh
USER root
RUN sh /tmp/patch-webroot-nav.sh \
 && chown moqui:moqui /opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js \
 && rm /tmp/patch-webroot-nav.sh
RUN chown -R moqui:moqui /opt/moqui/runtime/component/ && chown moqui:moqui /opt/moqui/runtime/conf/MoquiDevConf.xml /opt/moqui/WEB-INF/classes/qz-private-key.pem
USER moqui
