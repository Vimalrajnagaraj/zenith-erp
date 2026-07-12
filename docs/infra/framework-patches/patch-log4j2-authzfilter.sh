#!/bin/sh
# ZE-INV-IV-033 f/u: suppress the benign ERROR spam from ArtifactExecutionFacadeImpl.
#
# Every query on StockByFacilityView / ProductStockView logs an ERROR: the org-isolation entity filters
# ZTF_ASSET (mantle.product.asset.Asset) and ZTF_FACILITY (mantle.facility.Facility) filter by ownerPartyId,
# but those views alias ownerPartyId from Product, not from their Asset/Facility members — and those members
# are LEFT-joined, so we CANNOT give them a mapping alias without dropping facility-less stock / stock-less
# products (a ZE-INV-002 regression). Moqui therefore logs "authz entity filter ... not included in
# view-entity" and SKIPS the filter. This is benign: the views are still org-isolated by the working Product
# filter (MANTLE_ACTIVE_ORG_A, which maps to the aliased ownerPartyId) plus the screens' explicit econditions.
# So we suppress ONLY this specific message, exactly like the framework's own "Error warming entity cache"
# RegexFilter. No isolation change, no behaviour change — just quieter logs.
#
# Idempotent + self-verifying (fails the build if the framework log4j2.xml no longer has the anchor).
set -e
LOG4J=/opt/moqui/WEB-INF/classes/log4j2.xml

if [ ! -f "$LOG4J" ]; then echo "patch-log4j2-authzfilter: $LOG4J not found — FAILING" >&2; exit 1; fi
if grep -q "ArtifactExecutionFacadeImpl" "$LOG4J"; then
  echo "patch-log4j2-authzfilter: already applied (ArtifactExecutionFacadeImpl logger present)"; exit 0
fi

ANCHOR='<Logger name="org.moqui" level="info"/>'
grep -qF "$ANCHOR" "$LOG4J" || { echo "patch-log4j2-authzfilter: anchor '$ANCHOR' not found (framework log4j2 changed) — FAILING" >&2; exit 1; }

awk '
  index($0, "<Logger name=\"org.moqui\" level=\"info\"/>") > 0 && !done {
    print "        <Logger name=\"org.moqui.impl.context.ArtifactExecutionFacadeImpl\" level=\"info\">"
    print "            <RegexFilter regex=\".*authz entity filter ZTF_(ASSET|FACILITY).*(StockByFacilityView|ProductStockView).*\" onMatch=\"DENY\" onMismatch=\"NEUTRAL\"/>"
    print "        </Logger>"
    done = 1
  }
  { print }
' "$LOG4J" > "$LOG4J.patched" && mv "$LOG4J.patched" "$LOG4J"

grep -q "ArtifactExecutionFacadeImpl" "$LOG4J" || { echo "patch-log4j2-authzfilter: insertion FAILED" >&2; exit 1; }
echo "patch-log4j2-authzfilter: applied"
