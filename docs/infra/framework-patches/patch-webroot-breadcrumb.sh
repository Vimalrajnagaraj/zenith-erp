#!/bin/sh
# ZE-INV-015 / IV-119 — make the top breadcrumb crumbs NAVIGATE on a single click.
#
# Root cause: in BOTH Moqui web shells, a breadcrumb crumb that HAS subscreens was rendered as a
# menu-opener that never navigated, so a single click only popped a sibling dropdown (and the
# open/close toggle felt like "needs multiple clicks"):
#   /qapps  WebrootVue.qvt.ftl : <div class="cursor-pointer"> {{title}} <q-menu>...</q-menu> </div>
#   /apps   WebrootVue.vuet.ftl: <a href="#" class="dropdown-toggle" data-toggle="dropdown">{{title}} ...</a>
# Fix: the crumb TITLE becomes an <m-link> (single click -> $root.setUrl, same mechanism as every other
# link, incl. the dropdown items) and the sibling jump-list moves behind a small caret. Uses
# navMenuItem.pathWithParams || navMenuItem.path directly (getNavHref(0) is buggy: `if(!navIndex)` maps
# index 0 back to the LAST crumb, so the top "Applications" crumb would not navigate).
#
# Targets the SERVED, human-readable *.ftl templates (server-rendered, not minified). Idempotent +
# self-verifying: no-ops if already patched, FAILS LOUDLY if the framework template changed (so a Moqui
# upgrade can't silently ship the bug or apply a stale patch). Run in the Docker build (see Dockerfile).
# Only awk/sed are available in the image.
set -e
BASE="${1:-/opt/moqui/runtime/base-component/webroot/screen/includes}"
QVT="$BASE/WebrootVue.qvt.ftl"
VUET="$BASE/WebrootVue.vuet.ftl"

# ---- /qapps : WebrootVue.qvt.ftl (multi-line block replace) ----
if [ -f "$QVT" ]; then
  if grep -q 'navMenuItem.pathWithParams || navMenuItem.path' "$QVT"; then
    echo "patch-webroot-breadcrumb: qvt already patched"
  elif grep -q '<div v-else-if="navMenuItem.subscreens && navMenuItem.subscreens.length" class="cursor-pointer gt-xs">' "$QVT"; then
    cat > /tmp/bc_qvt.txt <<'QVTNEW'
                <span v-else-if="navMenuItem.subscreens && navMenuItem.subscreens.length" class="gt-xs" style="white-space:nowrap"><#-- IV-119: crumb TITLE navigates on a single click (was a menu-only <div> that never navigated); the sibling jump-list moved behind the caret. -->
                    <m-link :href="navMenuItem.pathWithParams || navMenuItem.path">{{navMenuItem.title}}</m-link><q-icon name="arrow_drop_down" size="1.4em" class="cursor-pointer" style="vertical-align:middle;"><q-menu anchor="bottom left" self="top left"><q-list dense style="min-width: 200px">
                        <q-item v-for="subscreen in navMenuItem.subscreens" :key="subscreen.name" :class="{'bg-primary':subscreen.active, 'text-white':subscreen.active}" clickable v-close-popup><q-item-section>
                            <m-link :href="subscreen.pathWithParams">
                                <template v-if="subscreen.image">
                                    <i v-if="subscreen.imageType === 'icon'" :class="subscreen.image" style="padding-right: 4px;"></i>
                                    <img v-else :src="subscreen.image" :alt="subscreen.title" width="18" class="invertible" style="padding-right: 4px;">
                                </template>
                                <i v-else class="fa fa-link" style="padding-right: 8px;"></i>
                                {{subscreen.title}}
                            </m-link>
                        </q-item-section></q-item>
                    </q-list></q-menu></q-icon>
                </span>
QVTNEW
    awk -v nf=/tmp/bc_qvt.txt '
      BEGIN { nb=""; while ((getline l < nf) > 0) nb = nb l "\n"; }
      index($0, "<div v-else-if=\"navMenuItem.subscreens && navMenuItem.subscreens.length\" class=\"cursor-pointer gt-xs\">") { printf "%s", nb; skip=1; next }
      skip && index($0, "</div>") { skip=0; next }
      skip { next }
      { print }
    ' "$QVT" > "$QVT.tmp" && mv "$QVT.tmp" "$QVT"
    rm -f /tmp/bc_qvt.txt
    grep -q 'navMenuItem.pathWithParams || navMenuItem.path' "$QVT" || { echo "patch-webroot-breadcrumb: FAILED to patch qvt" >&2; exit 1; }
    echo "patch-webroot-breadcrumb: patched qvt (/qapps)"
  else
    echo "patch-webroot-breadcrumb: FAILED — qvt div-crumb marker not found; framework changed, re-derive." >&2
    exit 1
  fi
fi

# ---- /apps : WebrootVue.vuet.ftl (single-line replace) ----
if [ -f "$VUET" ]; then
  if grep -q 'navMenuItem.pathWithParams || navMenuItem.path' "$VUET"; then
    echo "patch-webroot-breadcrumb: vuet already patched"
  elif grep -q '<a href="#" class="dropdown-toggle" data-toggle="dropdown">{{navMenuItem.title}} <i class="fa fa-chevron-right"></i></a>' "$VUET"; then
    NEWLINE='                            <m-link :href="navMenuItem.pathWithParams || navMenuItem.path">{{navMenuItem.title}}</m-link><a href="#" class="dropdown-toggle" data-toggle="dropdown" style="cursor:pointer;padding:0 3px"><i class="fa fa-caret-down"></i></a> <i class="fa fa-chevron-right"></i>'
    awk -v repl="$NEWLINE" '
      index($0, "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\">{{navMenuItem.title}} <i class=\"fa fa-chevron-right\"></i></a>") { print repl; next }
      { print }
    ' "$VUET" > "$VUET.tmp" && mv "$VUET.tmp" "$VUET"
    grep -q 'navMenuItem.pathWithParams || navMenuItem.path' "$VUET" || { echo "patch-webroot-breadcrumb: FAILED to patch vuet" >&2; exit 1; }
    echo "patch-webroot-breadcrumb: patched vuet (/apps)"
  else
    echo "patch-webroot-breadcrumb: FAILED — vuet dropdown-toggle marker not found; framework changed, re-derive." >&2
    exit 1
  fi
fi
