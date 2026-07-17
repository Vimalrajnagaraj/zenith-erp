#!/bin/sh
# ZE-GATE-004 guard (2026-07-17) — keep the cross-module transition registry honest.
#
# The plan gate (ZenithApp.xml always-actions -> zenith.base.SecurityServices check#ModulePlanAccess) infers the
# module a request belongs to from its URL. That is wrong for a transition in module B called by a screen in module
# A: the tenant is using A, but the gate sees B and demands B in the plan. ZE-GATE-003 fixed the one known case
# (the POS bulk label printer GETs /apps/zenith/barcode/renderLabels) by registering it in the _sharedTx map, so
# the gate stops depending on the coincidence that every plan holding 'pos' happens to hold 'barcode' too.
#
# The audit that found it was a point-in-time fact in a comment. This script makes it an invariant: add a new
# cross-module transition and CI/review fails here instead of a tenant silently losing a feature on some plan.
#
# Run before a deploy / in review. Exits non-zero if a violation is found.
# Usage: sh docs/infra/lint-cross-module-transitions.sh [component-dir]   (default: ./component)
set -e
DIR="${1:-component}"
REG="$DIR/zenith-erp-base/service/zenith/base/SecurityServices.xml"
rc=0

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

[ -d "$DIR" ] || { echo "FAIL: component dir not found: $DIR" >&2; exit 1; }
[ -f "$REG" ] || { echo "FAIL: _sharedTx registry not found: $REG" >&2; exit 1; }

# The module owning a screen/js file = the first path segment under .../screen/zenith/ .
# Handles both  .../screen/zenith/<mod>/Sub/File.xml  and a module root  .../screen/zenith/<mod>.xml .
# Returns empty for shared static assets (.../screen/zenithstatic/...), which have no module of their own.
modof() {
  printf '%s\n' "$1" \
    | sed -n 's#.*/screen/zenith/\([^/]*\)/.*#\1#p; s#.*/screen/zenith/\([^/]*\)\.xml$#\1#p' \
    | tr 'A-Z' 'a-z' | head -1
}

# A shared static js has no module in its path — it belongs to whichever screen(s) LOAD it.
ownersof_js() {
  b=$(basename "$1")
  for s in $(grep -rl "$b" --include='*.xml' "$DIR" 2>/dev/null); do modof "$s"; done | sort -u
}

# (1) Every transition that exists, as "<module>:<transitionName>".
for f in $(grep -rl '<transition name=' --include='*.xml' "$DIR" 2>/dev/null); do
  m=$(modof "$f"); [ -n "$m" ] || continue
  grep -Eo '<transition name="[A-Za-z0-9_]+"' "$f" | sed -E 's/.*name="([^"]+)".*/\1/' \
    | while read -r t; do printf '%s:%s\n' "$m" "$t"; done
done | sort -u > "$tmp/tx"

# (2) Every transition REGISTERED as legitimately cross-module (the "// SHARED-TX" marked map entries).
grep -E "'[a-z0-9]+:[A-Za-z0-9_]+'[[:space:]]*:.*// SHARED-TX" "$REG" 2>/dev/null \
  | sed -E "s/^[^']*'([^']+)'.*/\1/" | sort -u > "$tmp/reg"

# (3) HARD FAIL: a URL that targets another module's TRANSITION without being registered.
#     A cross-module URL pointing at a SCREEN is fine — screens are gated at render (pre-actions), where the
#     module the URL names is genuinely the module being entered. Only transitions have the inference problem.
grep -rEno "/(apps|qapps)/zenith/[A-Za-z0-9_]+(/[A-Za-z0-9_]+)+" --include='*.js' --include='*.xml' "$DIR" 2>/dev/null \
| while IFS= read -r hit; do
    f=${hit%%:*}; rest=${hit#*:}; ln=${rest%%:*}; url=${rest#*:}
    tgt=$(printf '%s\n' "$url" | sed -E 's#^/(apps|qapps)/zenith/([^/]+)/.*#\2#' | tr 'A-Z' 'a-z')
    last=${url##*/}
    # Not a transition of that module -> it's a screen link. Case-sensitive on the name so a screen
    # "CreateOrder" is never confused with a transition "createOrder".
    grep -qx "$tgt:$last" "$tmp/tx" || continue
    owners=$(modof "$f"); [ -n "$owners" ] || owners=$(ownersof_js "$f")
    same=0
    for o in $owners; do [ "$o" = "$tgt" ] && same=1; done
    [ "$same" = 1 ] && continue
    grep -qx "$tgt:$last" "$tmp/reg" \
      || printf '%s:%s  ->  %s:%s   (called from module: %s)\n' "$f" "$ln" "$tgt" "$last" "${owners:-UNKNOWN}" >> "$tmp/bad"
  done

if [ -s "$tmp/bad" ]; then
  echo "FAIL: cross-module transition call(s) not registered in _sharedTx (plan gate will block them" >&2
  echo "      for any tenant whose plan lacks the TARGET module, even though it grants the CALLING one):" >&2
  sed 's/^/  /' "$tmp/bad" >&2
  echo "  -> register each in the _sharedTx map in $REG, e.g." >&2
  echo "     'barcode:renderLabels': ['pos'] as Set   // SHARED-TX" >&2
  echo "     then prove it with: check#ModulePlanAccess {moduleId:'<tgt>', transitionName:'<tx>', planModules:['<caller>']}" >&2
  rc=1
fi

# (4) HARD FAIL the other way: a registry entry naming a transition that no longer exists = rot. It would
#     silently grant nothing, and the next reader would trust it as evidence the call is still covered.
while read -r e; do
  [ -n "$e" ] || continue
  grep -qx "$e" "$tmp/tx" || { echo "FAIL: _sharedTx registers '$e' but no such transition exists — stale entry." >&2; rc=1; }
done < "$tmp/reg"

if [ "$rc" -eq 0 ]; then
  echo "lint-cross-module-transitions: OK — $(wc -l < "$tmp/reg" | tr -d ' ') registered shared transition(s), no unregistered cross-module calls."
fi
exit "$rc"
