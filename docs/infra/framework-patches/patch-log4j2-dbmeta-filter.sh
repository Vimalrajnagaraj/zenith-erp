#!/bin/sh
# Suppress benign EntityDbMeta "already exists" DDL-redundancy ERRORs on every restart.
#
# EntityDbMeta re-syncs schema on each boot. For a couple of FKs whose REFERENCED entity uses a
# ZENITH_-prefixed `table-name` override (PaymentLink -> ZENITH_PAY_GW_CONFIG, TimesheetEntry ->
# ZENITH_TIMESHEET), its "does this FK already exist?" check misses, so it re-issues ADD CONSTRAINT and
# Postgres throws "constraint ... already exists" -> logged as ERROR. The constraint IS present (created
# on a prior boot); the schema is correct. This is pure idempotency noise, logged on EVERY restart, and
# it clutters error triage. We suppress ONLY the specific "SQL Exception while executing ... already
# exists" message on the EntityDbMeta logger (a REAL DDL failure says e.g. "column ... does not exist" /
# "type ...", never "already exists", so it still logs). Same approach as the ArtifactExecutionFacadeImpl
# authz filter and the framework's own "Error warming entity cache" RegexFilter. No schema/behaviour change.
#
# Idempotent + self-verifying (fails the build if the framework log4j2.xml no longer has the anchor).
set -e
LOG4J=/opt/moqui/WEB-INF/classes/log4j2.xml

if [ ! -f "$LOG4J" ]; then echo "patch-log4j2-dbmeta-filter: $LOG4J not found — FAILING" >&2; exit 1; fi
if grep -q "org.moqui.impl.entity.EntityDbMeta" "$LOG4J"; then
  echo "patch-log4j2-dbmeta-filter: already applied (EntityDbMeta logger present)"; exit 0
fi

ANCHOR='<Logger name="org.moqui" level="info"/>'
grep -qF "$ANCHOR" "$LOG4J" || { echo "patch-log4j2-dbmeta-filter: anchor '$ANCHOR' not found (framework log4j2 changed) — FAILING" >&2; exit 1; }

awk '
  index($0, "<Logger name=\"org.moqui\" level=\"info\"/>") > 0 && !done {
    print "        <Logger name=\"org.moqui.impl.entity.EntityDbMeta\" level=\"info\">"
    print "            <RegexFilter regex=\".*SQL Exception while executing.*already exists.*\" onMatch=\"DENY\" onMismatch=\"NEUTRAL\"/>"
    print "        </Logger>"
    done = 1
  }
  { print }
' "$LOG4J" > "$LOG4J.patched" && mv "$LOG4J.patched" "$LOG4J"

grep -q "org.moqui.impl.entity.EntityDbMeta" "$LOG4J" || { echo "patch-log4j2-dbmeta-filter: insertion FAILED" >&2; exit 1; }
echo "patch-log4j2-dbmeta-filter: applied"
