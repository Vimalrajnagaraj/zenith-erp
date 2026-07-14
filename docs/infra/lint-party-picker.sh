#!/bin/sh
# ZE-SEC-JSON guard (2026-07-13) — catch any regression that re-introduces the STOCK, cross-tenant
# party type-ahead. The framework transition `searchPartyList`
# (component://SimpleScreens/template/party/PartyForms.xml) is NOT org-aware: its value-resolution
# branch echoes ANY party's name for a forged exact partyId, and its ElasticSearch branch only scopes
# if the user carries a MANTLE_ACTIVE_ORG find-filter. All party pickers MUST use the org-scoped
# replacement  component://zenith-erp-base/screen/include/PartyPicker.xml  instead.
#
# Run before a deploy / in review. Exits non-zero if a violation is found.
# Usage: sh docs/infra/lint-party-picker.sh [component-dir]   (default: ./component)
set -e
DIR="${1:-component}"
rc=0

# (a) HARD FAIL: a searchPartyList transition-include that points anywhere OTHER than PartyPicker.
bad_include=$(grep -rn 'transition-include name="searchPartyList"' "$DIR" 2>/dev/null | grep -v 'zenith-erp-base/screen/include/PartyPicker.xml' || true)
if [ -n "$bad_include" ]; then
  echo "FAIL: party picker(s) include a non-PartyPicker searchPartyList (stock = cross-tenant leak):" >&2
  echo "$bad_include" | sed 's/^/  /' >&2
  echo "  -> point the transition-include at component://zenith-erp-base/screen/include/PartyPicker.xml" >&2
  rc=1
fi

# (b) HARD FAIL: a consumer (dynamic-options transition="searchPartyList") whose screen file has no
#     PartyPicker include of its own (would inherit a parent/stock include — easy to miss).
for f in $(grep -rl 'dynamic-options transition="searchPartyList"' "$DIR" 2>/dev/null); do
  if ! grep -q 'PartyPicker.xml' "$f"; then
    echo "FAIL: $f uses searchPartyList but has no PartyPicker transition-include of its own." >&2
    echo "  -> add: <transition-include name=\"searchPartyList\" location=\"component://zenith-erp-base/screen/include/PartyPicker.xml\"/>" >&2
    rc=1
  fi
done

[ "$rc" -eq 0 ] && echo "lint-party-picker: OK — all party pickers use the org-scoped PartyPicker."
exit "$rc"
