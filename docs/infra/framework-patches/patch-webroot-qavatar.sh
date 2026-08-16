#!/bin/sh
# ZE-QAVATAR — /qapps account button shows the user's INITIALS in a purple avatar instead of the generic
# Quasar `account_circle` icon (matches the /apps header avatar shipped in ZenithApp.xml, commit 5ce968f).
#
# Replaces the opening `<q-btn dense flat icon="account_circle">` of the header account button in the
# SERVED, human-readable WebrootVue.qvt.ftl (server-rendered, not minified) with a FreeMarker block that
# derives 1-2 letter initials from ec.user.userAccount.userFullName and renders a <q-avatar>. The button's
# existing tooltip + account menu (Welcome / logout / dark-light) are left untouched. Falls back to the
# original account_circle icon when there is no name. The user's full name is already available in this
# template (see the tooltip/Welcome lines), so no new data source is needed.
#
# Idempotent + self-verifying: no-ops if already patched, FAILS LOUDLY if the framework template changed
# (so a Moqui upgrade can't silently ship the unpatched icon or apply a stale patch). Only awk/sed in the
# image. Run from the Docker build (see Dockerfile). Rollback on the running container: restore the
# WebrootVue.qvt.ftl.zebak backup + restart.
set -e
BASE="${1:-/opt/moqui/runtime/base-component/webroot/screen/includes}"
QVT="$BASE/WebrootVue.qvt.ftl"

if [ -f "$QVT" ]; then
  if grep -q 'ZE-QAVATAR' "$QVT"; then
    echo "patch-webroot-qavatar: already patched"
  elif grep -q '<q-btn dense flat icon="account_circle">' "$QVT"; then
    cat > /tmp/qav_qvt.txt <<'QVTNEW'
            <#-- ZE-QAVATAR: purple user-initials avatar in place of the generic account_circle icon --><#assign zUfn=(ec.user.userAccount.userFullName)!""><#assign zIni=""><#if zUfn?has_content><#assign zWd=zUfn?trim?split(" ")><#assign zIni=zWd[0]?substring(0,1)><#if (zWd?size gt 1)><#assign zIni=zIni+zWd[zWd?size-1]?substring(0,1)><#elseif ((zWd[0]?length) gt 1)><#assign zIni=zIni+zWd[0]?substring(1,2)></#if><#assign zIni=zIni?upper_case></#if>
            <q-btn dense flat round>
                <q-avatar size="26px" style="background:linear-gradient(135deg,#6E56CF,#8b7cf7);color:#fff;font-size:11px;font-weight:600;letter-spacing:.02em"><#if zIni?has_content>${zIni}<#else><q-icon name="account_circle"></q-icon></#if></q-avatar>
QVTNEW
    awk -v nf=/tmp/qav_qvt.txt '
      BEGIN { nb=""; while ((getline l < nf) > 0) nb = nb l "\n"; }
      index($0, "<q-btn dense flat icon=\"account_circle\">") && !done { printf "%s", nb; done=1; next }
      { print }
    ' "$QVT" > "$QVT.tmp" && mv "$QVT.tmp" "$QVT"
    rm -f /tmp/qav_qvt.txt
    grep -q 'ZE-QAVATAR' "$QVT" || { echo "patch-webroot-qavatar: FAILED to patch qvt" >&2; exit 1; }
    if grep -q '<q-btn dense flat icon="account_circle">' "$QVT"; then echo "patch-webroot-qavatar: FAILED — old account_circle button still present" >&2; exit 1; fi
    echo "patch-webroot-qavatar: patched qvt (/qapps)"
  else
    echo "patch-webroot-qavatar: FAILED — account_circle q-btn marker not found; framework changed, re-derive." >&2
    exit 1
  fi
fi
