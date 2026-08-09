#!/bin/sh
# ZE-STORES-UI (defect_report_new_store_ui) — make required/rule'd form fields validate ONLY on submit,
# not eagerly on blur.
#
# Root cause: Moqui's m-text-line and m-date-time components render their inner <q-input :rules="rules">
# with Quasar's DEFAULT lazy-rules (validate on blur). Combined with a dialog autofocusing its first field,
# an empty required field (e.g. New Store -> Store Name) flashes its "Please enter a value" error the moment
# the user clicks elsewhere — before any submit — which reads as "errored on open".
# Fix: add  lazy-rules="ondemand"  to those two inner q-inputs. 'ondemand' validates ONLY when the wrapping
# q-form calls validate(), which m-form.submitForm() always does before submitGo() — so submit-time
# validation is fully preserved (invalid required fields still block submit and show the error); only the
# premature blur validation is removed. Server-side service validation remains the backstop regardless.
#
# Targets the SERVED minified file (production serves *.min.js; *.js is dev-only — patch it too for parity via
# the second invocation). In the minified file '=' is stored escaped as \x3d. Idempotent + self-verifying:
# no-ops if already patched and FAILS LOUDLY if the framework template changed (so a Moqui upgrade can't
# silently reintroduce the blur behaviour). Run in the Docker build (see Dockerfile) so it survives rebuilds.
#
# Usage: patch-webroot-lazy-rules.sh [path-to-WebrootVue.qvt(.min).js]
set -e
F="${1:-/opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js}"

if [ ! -f "$F" ]; then
  echo "patch-webroot-lazy-rules: file not found: $F" >&2
  exit 1
fi

# minified files escape '=' as \x3d; the dev *.js uses a literal '='. Detect which form this file uses.
case "$F" in
  *.min.js) EQ='\\x3d' ;;
  *)        EQ='=' ;;
esac

if grep -q "lazy-rules${EQ}\"ondemand\"" "$F"; then
  echo "patch-webroot-lazy-rules: already patched ($F), nothing to do"
  exit 0
fi

sed -i "s|:rules${EQ}\"rules\"|:rules${EQ}\"rules\" lazy-rules${EQ}\"ondemand\"|g" "$F"

N=$(grep -o "lazy-rules${EQ}\"ondemand\"" "$F" | wc -l)
if [ "$N" -ne 2 ]; then
  echo "patch-webroot-lazy-rules: FAILED — expected 2 patched fields (m-text-line + m-date-time), found $N. The framework field template likely changed; re-derive the patch." >&2
  exit 1
fi
echo "patch-webroot-lazy-rules: patched $N q-input fields in $F"
