#!/bin/sh
# ZE-STORES-UI (defect_report_new_store_ui + follow-up form audit) — make required/rule'd form fields
# validate ONLY on submit, not eagerly on blur.
#
# Root cause: Moqui's field components render their inner Quasar control with the DEFAULT lazy-rules
# (validate on blur). Combined with a dialog autofocusing its first field, an empty required field flashes
# its error the moment the user clicks elsewhere — before any submit — which reads as "errored on open".
# Fix: add  lazy-rules="ondemand"  to the three data-entry controls that carry a :rules validation:
#   1. m-text-line  -> inner <q-input :rules="rules">        (text/number/etc.)
#   2. m-date-time  -> inner <q-input :rules="rules">        (dates)
#   3. m-drop-down  -> inner <q-select ... :rules="[...]">   (required selects: "Please select an option")
# 'ondemand' validates ONLY when the wrapping q-form calls validate(), which m-form.submitForm() always does
# before submitGo() — so submit-time validation is fully preserved (invalid required fields still block submit
# and show the error); only the premature blur validation is removed. Server-side service validation remains
# the backstop regardless.
# DELIBERATELY EXCLUDED: m-form-go-page's page-number input (a pagination navigation control, not a data-entry
# form field — its "digits only" feedback on blur is appropriate there).
#
# Targets the SERVED minified file (production serves *.min.js; *.js is dev-only — patch it too for parity via a
# second invocation). In the minified file '=' is stored escaped as \x3d. Idempotent (each anchor guarded) +
# self-verifying (FAILS if the field templates changed, so a Moqui upgrade can't silently reintroduce the blur
# behaviour). Run in the Docker build (see Dockerfile) so it survives rebuilds.
#
# Usage: patch-webroot-lazy-rules.sh [path-to-WebrootVue.qvt(.min).js]
set -e
F="${1:-/opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js}"

if [ ! -f "$F" ]; then
  echo "patch-webroot-lazy-rules: file not found: $F" >&2
  exit 1
fi

# minified files escape '=' as \x3d; the dev *.js uses a literal '='.
case "$F" in
  *.min.js) EQ='\\x3d' ;;
  *)        EQ='=' ;;
esac

# 1+2) m-text-line & m-date-time inner q-inputs (both render :rules="rules")
if ! grep -q ":rules${EQ}\"rules\" lazy-rules${EQ}\"ondemand\"" "$F"; then
  sed -i "s|:rules${EQ}\"rules\"|:rules${EQ}\"rules\" lazy-rules${EQ}\"ondemand\"|g" "$F"
fi
# 3) m-drop-down q-select — anchor on its unique input-debounce="500" attribute
if ! grep -q "input-debounce${EQ}\"500\" lazy-rules${EQ}\"ondemand\"" "$F"; then
  sed -i "s|input-debounce${EQ}\"500\"|input-debounce${EQ}\"500\" lazy-rules${EQ}\"ondemand\"|g" "$F"
fi

N=$(grep -o "lazy-rules${EQ}\"ondemand\"" "$F" | wc -l)
if [ "$N" -ne 3 ]; then
  echo "patch-webroot-lazy-rules: FAILED — expected 3 patched fields (m-text-line + m-date-time + m-drop-down), found $N. The framework field templates likely changed; re-derive the patch." >&2
  exit 1
fi
echo "patch-webroot-lazy-rules: patched $N form fields in $F"
