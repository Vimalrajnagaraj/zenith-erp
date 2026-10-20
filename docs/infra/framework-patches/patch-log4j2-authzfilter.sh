#!/bin/sh
# ZE-INV-IV-033 (+ ZE-SALES-AUTHZLOG f/u): suppress benign authz-entity-filter ERROR spam from
# ArtifactExecutionFacadeImpl. Both suppressed messages are the SAME class — Moqui tries to add a
# MANTLE active-org authz filter condition on a field a query-only aggregate view does not alias, so it
# logs "authz entity filter ... not included in view-entity" and SKIPS that one condition. In every case
# the view is still org-isolated by an EXPLICIT econdition on an aliased owner field, so the skip is
# harmless and only the log line is noise. We suppress ONLY these two specific, view-named messages; any
# other "not included in view-entity" error (a genuinely unscoped view) still logs at ERROR.
#
#   (1) StockByFacilityView / ProductStockView: the ZTF_ASSET/ZTF_FACILITY filters key on ownerPartyId,
#       which those views alias from Product (LEFT-joined Asset/Facility members can't carry the alias
#       without dropping facility-less stock / stock-less products — a ZE-INV-002 regression). Isolation
#       holds via the working Product filter (MANTLE_ACTIVE_ORG_A -> aliased ownerPartyId) + the screens'
#       explicit econditions.
#   (2) InvoiceSalesSummaryView / InvoiceCategorySalesView: the MANTLE_ACTIVE_ORG_1 filter keys on
#       toPartyId, but these SALES aggregates group by and alias fromPartyId (the selling org), not
#       toPartyId. EVERY consumer (SalesDashboard, SalesForecastServices, AiServices) pins
#       fromPartyId = active org explicitly, so the skipped toPartyId condition is redundant. No leak.
#
# Same approach as the framework's own "Error warming entity cache" RegexFilter. No isolation change,
# no behaviour change — just quieter logs. Both filters live under ONE ArtifactExecutionFacadeImpl Logger
# (log4j2 honours a single Logger per name) via a <Filters> composite: an event matching EITHER regex is
# DENYed; anything else is NEUTRAL and logs normally.
#
# Idempotent + self-verifying. Handles three states: pristine (insert), old ZTF-only block from a prior
# apply (upgrade in place), and already-composite (no-op). Fails the build if the framework log4j2.xml no
# longer has the anchor, or if either suppression is missing after applying.
set -e
LOG4J=/opt/moqui/WEB-INF/classes/log4j2.xml
MARKER=InvoiceSalesSummaryView
ANCHOR='<Logger name="org.moqui" level="info"/>'

if [ ! -f "$LOG4J" ]; then echo "patch-log4j2-authzfilter: $LOG4J not found — FAILING" >&2; exit 1; fi
if grep -q "$MARKER" "$LOG4J"; then
  echo "patch-log4j2-authzfilter: already applied (composite present)"; exit 0
fi

# Step 1 — if an OLD single-filter ArtifactExecutionFacadeImpl Logger exists (prior ZTF-only apply),
# strip it so step 2 can re-insert the full composite in its place.
if grep -q 'org.moqui.impl.context.ArtifactExecutionFacadeImpl' "$LOG4J"; then
  awk '
    !stripped && index($0, "<Logger name=\"org.moqui.impl.context.ArtifactExecutionFacadeImpl\"") > 0 { skip=1; stripped=1; next }
    skip && index($0, "</Logger>") > 0 { skip=0; next }
    skip { next }
    { print }
  ' "$LOG4J" > "$LOG4J.patched" && mv "$LOG4J.patched" "$LOG4J"
fi

# Step 2 — insert the composite ArtifactExecutionFacadeImpl Logger just before the org.moqui anchor.
grep -qF "$ANCHOR" "$LOG4J" || { echo "patch-log4j2-authzfilter: anchor '$ANCHOR' not found (framework log4j2 changed) — FAILING" >&2; exit 1; }
awk '
  index($0, "<Logger name=\"org.moqui\" level=\"info\"/>") > 0 && !done {
    print "        <Logger name=\"org.moqui.impl.context.ArtifactExecutionFacadeImpl\" level=\"info\">"
    print "            <Filters>"
    print "                <RegexFilter regex=\".*authz entity filter ZTF_(ASSET|FACILITY).*(StockByFacilityView|ProductStockView).*\" onMatch=\"DENY\" onMismatch=\"NEUTRAL\"/>"
    print "                <RegexFilter regex=\".*authz entity filter MANTLE_ACTIVE_ORG.*toPartyId.*(InvoiceSalesSummaryView|InvoiceCategorySalesView).*\" onMatch=\"DENY\" onMismatch=\"NEUTRAL\"/>"
    print "            </Filters>"
    print "        </Logger>"
    done = 1
  }
  { print }
' "$LOG4J" > "$LOG4J.patched" && mv "$LOG4J.patched" "$LOG4J"

grep -q "ZTF_(ASSET|FACILITY)" "$LOG4J" || { echo "patch-log4j2-authzfilter: ZTF suppression missing after apply — FAILING" >&2; exit 1; }
grep -q "$MARKER" "$LOG4J" || { echo "patch-log4j2-authzfilter: InvoiceSales suppression missing after apply — FAILING" >&2; exit 1; }
echo "patch-log4j2-authzfilter: applied (composite: ZTF + InvoiceSales)"
