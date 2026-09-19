#!/usr/bin/env bash
# READ-ONLY audit: does the git repo still match the LIVE production container?
#
# Non-destructive — it reports drift but NEVER modifies the repo, commits, or pushes. Intended to
# run daily from a scheduled task. It compares repo-tracked source content-only (ignoring the
# repo's CRLF vs the container's LF). Behaviour:
#   - in sync  -> logs "IN SYNC", removes the Desktop marker, exit 0
#   - drift    -> logs "DRIFT", writes a Desktop marker file listing the drifted/new files, exit 1
#   - unreachable host -> logs "AUDIT ERROR", exit 2
#
# To fix drift once alerted, run the (writing) reconciler and review before pushing:
#   bash docs/infra/sync-from-live.sh
#
# Usage: bash docs/infra/audit-live-sync.sh [user@host]
set -uo pipefail

HOST="${1:-root@167.233.117.229}"
CONTAINER="${CONTAINER:-deploy-moqui-1}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="${MARKER:-$HOME/Desktop/ZENITH-SYNC-DRIFT.txt}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25 "$HOST" \
     "docker exec ${CONTAINER} sh -c 'cd /opt/moqui/runtime/component && tar cf - zenith-erp-*'" \
     > "$TMP/live.tar" 2>"$TMP/err"; then
  echo "[$STAMP] AUDIT ERROR: could not reach live host — $(head -1 "$TMP/err" 2>/dev/null)"
  exit 2
fi
mkdir -p "$TMP/live"; tar xf "$TMP/live.tar" -C "$TMP/live" 2>/dev/null

cd "$REPO"
# Only compare files that are actually part of the RUNNING app. Exclude test/ (test files are
# never deployed to the container, so they legitimately differ / lag) — see EXCLUDE below.
EXCLUDE='(^|/)test/'
drift="$TMP/drift.txt"; : > "$drift"
while IFS= read -r f; do
  rel="${f#component/}"; src="$TMP/live/$rel"
  [ -f "$src" ] || continue
  diff -q --strip-trailing-cr "$f" "$src" >/dev/null 2>&1 || echo "$f" >> "$drift"
done < <(git ls-files component | grep -vE "$EXCLUDE")

newf="$TMP/new.txt"; : > "$newf"
( cd "$TMP/live" && find . -type f -not -path '*/test/*' \( -name '*.xml' -o -name '*.groovy' \
      -o -name '*.ftl' -o -name '*.css' -o -name '*.js' \) ) | sed 's#^\./#component/#' \
  | while IFS= read -r p; do git ls-files --error-unmatch "$p" >/dev/null 2>&1 || echo "$p" >> "$newf"; done

nd=$(wc -l < "$drift" | tr -d ' '); nn=$(wc -l < "$newf" | tr -d ' ')
if [ "${nd:-0}" -eq 0 ] && [ "${nn:-0}" -eq 0 ]; then
  echo "[$STAMP] IN SYNC — repo matches live (0 drift)."
  rm -f "$MARKER" 2>/dev/null || true
  exit 0
fi

echo "[$STAMP] DRIFT DETECTED — ${nd} changed, ${nn} new file(s) in live. Marker: $MARKER"
{
  echo "ZENITH — the GitHub repo no longer matches PRODUCTION  (detected $STAMP)"
  echo "-------------------------------------------------------------------------"
  echo "Reconcile: open a terminal in the repo and run"
  echo "    bash docs/infra/sync-from-live.sh"
  echo "then review the diff (check for secrets/customer data), commit, and push."
  echo ""
  [ "${nd:-0}" -gt 0 ] && { echo "Changed in live (${nd}):"; sed 's/^/  - /' "$drift"; echo ""; }
  [ "${nn:-0}" -gt 0 ] && { echo "New in live (${nn}):";     sed 's/^/  - /' "$newf"; }
} > "$MARKER" 2>/dev/null || true
exit 1
