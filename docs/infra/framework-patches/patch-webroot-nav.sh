#!/bin/sh
# ZE-INV-012 / IV-113 — patch the Moqui /qapps left-nav so module submenus COLLAPSE.
#
# Root cause: the framework component m-menu-nav-item renders each active-trail module as
#   <q-expansion-item :value="true" ... :to="..." @input="go">
# :value="true" is a frozen constant (expand state derived from the active route, not a toggle) and
# @input="go" makes the chevron NAVIGATE — so a module submenu can never be collapsed once open.
# Fix: swap :value="true" + @input="go" for  default-opened expand-separate-toggle-icon  (keeping :to).
# The chevron becomes an independent real toggle; the label still navigates via :to. Leaf items
# (:value="false") are untouched.
#
# This targets the SERVED, minified file (production serves *.min.js; the *.js is dev-only). In the
# minified file '=' '<' '>' are stored escaped as \x3d \x3c \x3e. Idempotent + self-verifying: it
# no-ops if already patched and FAILS LOUDLY if the framework template changed (so a Moqui upgrade
# can't silently ship the bug). Run in the Docker build (see Dockerfile) so it survives rebuilds.
#
# Usage: patch-webroot-nav.sh [path-to-WebrootVue.qvt.min.js]
set -e
F="${1:-/opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js}"

if [ ! -f "$F" ]; then
  echo "patch-webroot-nav: file not found: $F" >&2
  exit 1
fi

if grep -q 'default-opened expand-separate-toggle-icon' "$F"; then
  echo "patch-webroot-nav: already patched, nothing to do"
  exit 0
fi

sed -i 's|:value\\x3d"true" :content-inset-level\\x3d"0\.3" switch-toggle-side dense dense-toggle expanded-icon\\x3d"arrow_drop_down" :to\\x3d"navMenuItem\.pathWithParams" @input\\x3d"go"\\x3e|default-opened expand-separate-toggle-icon :content-inset-level\\x3d"0.3" switch-toggle-side dense dense-toggle expanded-icon\\x3d"arrow_drop_down" :to\\x3d"navMenuItem.pathWithParams"\\x3e|g' "$F"

N=$(grep -o 'default-opened expand-separate-toggle-icon' "$F" | wc -l)
if [ "$N" -ne 3 ]; then
  echo "patch-webroot-nav: FAILED — expected 3 patched menu items, found $N. The framework menu template likely changed; re-derive the patch." >&2
  exit 1
fi
echo "patch-webroot-nav: patched $N nav-menu items"
