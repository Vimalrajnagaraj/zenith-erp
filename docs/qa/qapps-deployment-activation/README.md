# Activate the tracked Quasar wrapper

The deployment recipe copied the corrected wrapper only into the SaaS component. Moqui serves it from `runtime/base-component/webroot/screen/webroot/qapps.xml`, so a rebuild could leave the base image's old deep-route redirect active. The Dockerfile now copies the existing tracked wrapper to its served path; the deployment SOP records the exception for file-only updates.

The wrapper's source and authentication logic are unchanged. `contract-verification.json` records seven passing path/order/XML/copy checks. `route-verification.json` records actual execution of its Groovy pre-actions for 24 synthetic cases: anonymous and authenticated requests, bare roots and resolved deep routes, production and development script modes. Every case passed.

To repeat the route checks with the framework's Groovy classpath, invoke `groovy.ui.GroovyMain probe-qapps.groovy <tracked-qapps.xml> <external-output.json>`. This uses synthetic screen bindings and does not start HTTP or access a database. No production credentials or data are required.

A Docker build did not run on the native host. The isolated file copy verifies paths and bytes, and the Groovy probe verifies routing logic; neither establishes the running production container's active file. Clean staging smoke independently overlays its base wrapper and cannot prove this deployment COPY. A production bind mount takes precedence over an image copy, so the senior should verify the served wrapper and an authenticated deep route during deployment.

No merge or deployment was performed. This recipe repair complements the dashboard replacement in #12, which retains every #11 commit.
