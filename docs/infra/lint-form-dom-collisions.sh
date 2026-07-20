#!/bin/sh
# Guard (2026-07-20) — catch Moqui form controls whose NAME collides with a DOM property Vue reads
# during render (tagName/nodeName/nodeType). Such a control shadows form.<name> (HTMLFormElement is
# [LegacyOverrideBuiltins]) -> Vue's patch does form.tagName.indexOf(..) on the <input> element ->
# "TypeError: t.tagName.indexOf is not a function" -> the /qapps page renders BLANK. Bit ZE-CONTACTS-018
# (PartyTag's PK is tagName, auto-emitted by the Tags form-list). Catches parameter-map keys, form input
# fields, and form-lists over an entity with such a PK. Logic in lint-form-dom-collisions.js (Node).
#
# Run before a deploy / in review. Exits non-zero on any violation. Requires node.
# Usage: sh docs/infra/lint-form-dom-collisions.sh [component-dir]   (default: ./component)
set -e
DIR="${1:-component}"
SELF_DIR=$(dirname "$0")
if ! command -v node >/dev/null 2>&1; then
  echo "lint-form-dom-collisions: node not found on PATH." >&2
  exit 2
fi
exec node "$SELF_DIR/lint-form-dom-collisions.js" "$DIR"
