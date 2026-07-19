#!/bin/sh
# CSS comment guard (2026-07-19) — catch the recurring "*/ inside a /* … */ comment" footgun.
# A '*/' can only legally appear as a comment terminator, so a '*/' found OUTSIDE comment state
# means an earlier comment held an inner '*/' and closed early — silently dropping the CSS rule
# that follows (bit the /apps light-mode theme fix and ZE-CONTACTS-028; each cost a redeploy).
# Also flags an unterminated '/*'. Scans authored .css files AND CSS inside XML <style>…</style>
# blocks (the per-screen injection pattern from ~/CLAUDE.md).
#
# Run before a CSS deploy / in review. Exits non-zero on any violation. Requires node.
# Usage: sh docs/infra/lint-css-comments.sh [component-dir]   (default: ./component)
set -e
DIR="${1:-component}"
SELF_DIR=$(dirname "$0")
if ! command -v node >/dev/null 2>&1; then
  echo "lint-css-comments: node not found on PATH (needed to parse CSS comment state)." >&2
  exit 2
fi
exec node "$SELF_DIR/lint-css-comments.js" "$DIR"
