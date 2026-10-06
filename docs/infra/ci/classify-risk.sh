#!/usr/bin/env bash
# Phase-2 groundwork (REPORT-ONLY): classify a change's risk tier from its changed file paths.
#
# Reads changed file paths on stdin (one per line) and prints:
#   TIER=trivial   -> only docs / CI config / presentation assets changed; in Phase 2 this tier
#                     would auto-deploy after a green staging run.
#   TIER=sensitive -> touches app behaviour (any component XML/JS, services, entities, the billing/
#                     auth/tax/isolation paths); always needs a human one-click approve.
# plus a short rationale and, for sensitive, the deciding files. Exit code is always 0 — this only
# reports; it never gates or deploys. The mapping errs toward "sensitive" on purpose (hand on the
# wheel where it matters; an empty/unknown changeset is treated as sensitive).
#
# Deliberately conservative: only things that NEVER ship to the prod Moqui container (docs, .github,
# docs/infra/ci) or are pure presentation (CSS/images/fonts under zenithstatic) count as trivial.
# JS is behaviour (pos-terminal.js IS the billing engine), so .js is always sensitive.
#
# Usage:  printf '%s\n' file1 file2 | docs/infra/ci/classify-risk.sh
set -euo pipefail

is_trivial() {
  case "$1" in
    docs/*)                         return 0 ;;  # documentation (never ships to the container)
    .github/*)                      return 0 ;;  # CI config (never ships to the container)
    *.md|LICENSE|*/LICENSE)         return 0 ;;  # docs / license
    *.gitignore|.gitattributes)     return 0 ;;
    # pure presentation assets under the static dir (CSS/images/fonts — NOT .js)
    *zenithstatic/*.css|*zenithstatic/*.png|*zenithstatic/*.jpg|*zenithstatic/*.jpeg) return 0 ;;
    *zenithstatic/*.svg|*zenithstatic/*.gif|*zenithstatic/*.webp|*zenithstatic/*.ico) return 0 ;;
    *zenithstatic/*.woff|*zenithstatic/*.woff2|*zenithstatic/*.ttf|*zenithstatic/*.eot) return 0 ;;
    *)                              return 1 ;;  # everything else is sensitive
  esac
}

tier="trivial"
n=0
sensitive_files=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  n=$((n + 1))
  if ! is_trivial "$f"; then
    tier="sensitive"
    sensitive_files="${sensitive_files}  - ${f}"$'\n'
  fi
done

if [ "$n" -eq 0 ]; then
  # No files detected — don't let an unknown changeset look safe.
  echo "TIER=sensitive"
  echo "RATIONALE=no changed files detected; defaulting to sensitive (human approve)"
  exit 0
fi

echo "TIER=${tier}"
if [ "$tier" = "trivial" ]; then
  echo "RATIONALE=all ${n} changed file(s) are docs / CI config / presentation assets — no app behaviour"
else
  echo "RATIONALE=touches app behaviour (component code, services/entities, scripts, or a billing/auth/tax/isolation path) — human approve"
  printf 'SENSITIVE_FILES<<EOF\n%sEOF\n' "$sensitive_files"
fi
