#!/usr/bin/env bash
# Keep the git repo (and therefore GitHub) reflecting the LIVE production system.
#
# The normal flow already keeps them in sync: edit locally -> deploy to the container -> commit
# -> push. Run THIS script to catch drift that bypassed that flow — e.g. a file edited directly
# inside the running container (a server-side hotfix). It:
#   1. pulls the live container's zenith-erp-* component tree,
#   2. finds repo-tracked source files whose CONTENT really differs (ignoring CRLF/LF, since the
#      repo is CRLF on Windows and the container is LF on Linux),
#   3. writes the live version back into the repo (text files re-normalised to CRLF so only real
#      content changes show up in git; binaries copied as-is),
#   4. lists any NEW source files present in the container but not tracked (for manual review),
#   5. prints `git status` and the exact commit/push commands.
#
# It does NOT commit or push — you review the diff first (a live hotfix must still pass the
# secret / customer-data checks before it reaches GitHub). Usage:
#   bash docs/infra/sync-from-live.sh [user@host]
set -euo pipefail

HOST="${1:-root@167.233.117.229}"
CONTAINER="${CONTAINER:-deploy-moqui-1}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "==> Pulling live component tree from ${HOST} (${CONTAINER}) ..."
ssh -o StrictHostKeyChecking=no "$HOST" \
  "docker exec ${CONTAINER} sh -c 'cd /opt/moqui/runtime/component && tar cf - zenith-erp-*'" > "$TMP/live.tar"
mkdir -p "$TMP/live"; tar xf "$TMP/live.tar" -C "$TMP/live"

cd "$REPO"
# Skip test/ files — they are not deployed to the running container, so the repo (not the
# container) is authoritative for them; pulling the stale container copy would be wrong.
EXCLUDE='(^|/)test/'
updated=0
while IFS= read -r f; do
  rel="${f#component/}"; src="$TMP/live/$rel"
  [ -f "$src" ] || continue                                   # repo-only file (dev/reference) — skip
  if diff -q --strip-trailing-cr "$f" "$src" >/dev/null 2>&1; then continue; fi   # same content
  if grep -Iq . "$src"; then
    sed 's/\r$//' "$src" | sed 's/$/\r/' > "$f"               # text: re-normalise to CRLF
  else
    cp "$src" "$f"                                            # binary: copy as-is
  fi
  echo "   updated from live: $f"; updated=$((updated+1))
done < <(git ls-files component | grep -vE "$EXCLUDE")

echo "==> ${updated} file(s) updated from the live container."

echo "==> NEW source files in the container but not tracked in git (review, add if intended):"
( cd "$TMP/live" && find . -type f -not -path '*/test/*' \( -name '*.xml' -o -name '*.groovy' \
      -o -name '*.ftl' -o -name '*.css' -o -name '*.js' \) ) \
  | sed 's#^\./#component/#' \
  | while IFS= read -r p; do git ls-files --error-unmatch "$p" >/dev/null 2>&1 || echo "     $p"; done \
  | head -50
echo "   (none listed = no new source files)"

echo "==> git status:"
git status -s | head -80

cat <<'NEXT'
==> Review the changes above (git diff). A live hotfix must still be clean of secrets and
    customer data before it reaches GitHub. When satisfied:

      git add -u                      # (git add <new paths> for any new source files)
      git commit -m "sync: capture live hotfix(es) into the repo"
      git push origin master          # (or via a PR if you are not on the allowlist)
NEXT
