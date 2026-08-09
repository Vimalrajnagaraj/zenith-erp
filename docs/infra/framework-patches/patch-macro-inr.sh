#!/bin/sh
# ZE-INR — Indian lakh/crore digit grouping for currency display fields rendered by the framework macro.
#
# Java's DecimalFormat (and every JDK locale, incl. en_IN/hi_IN) can only do a SINGLE grouping size, so
# ec.l10n.format(x,'#,##,##0.00') / formatCurrency(...) always produce Western 3-3 grouping ("34,02,633" is
# impossible). The com.zenith.Fmt helper (runtime/classes) regroups an already-formatted string to Indian
# 3-2-2. Screen-level explicit ec.l10n.format calls are wrapped with zinr.inr(...) in the component XML; this
# patch covers the OTHER server path: form-single <display> fields (currency-unit-field or format="#,##,##0*")
# which the macro formats via ec.getL10n() and emits as ${fieldValue}.
#
# Inserts ONE guarded line right after the display macro finalises fieldValue, regrouping only when the field
# is a currency (currency-unit-field) or carries an Indian currency format — so plain number/year/id display
# fields are untouched. Idempotent (skips if ZE-INR present) + self-verifying (FAILS if the anchor is gone, so
# a Moqui upgrade that changes the display macro can't silently drop the fix). Run in the Docker build.
#
# Usage: patch-macro-inr.sh [path-to-DefaultScreenMacros.qvt.ftl]
set -e
F="${1:-/opt/moqui/runtime/template/screen-macro/DefaultScreenMacros.qvt.ftl}"
[ -f "$F" ] || { echo "patch-macro-inr: file not found: $F" >&2; exit 1; }

if grep -q "ZE-INR" "$F"; then echo "patch-macro-inr: already applied"; exit 0; fi

ANCHOR='@widgetTextValue .node true'
if ! grep -q "$ANCHOR" "$F"; then
  echo "patch-macro-inr: anchor '$ANCHOR' not found (display macro changed?) — FAILING" >&2; exit 1
fi

INS='        <#-- ZE-INR: Indian lakh/crore regrouping for currency / grouped-number display fields (matches both the #,##0 and #,##,##0 format conventions; Java DecimalFormat cannot do 3-2-2 grouping) -->\n        <#if fieldValue?has_content && (.node["@currency-unit-field"]?has_content || (.node["@format"]!)?contains(",##0"))><#assign fieldValue = Static["com.zenith.Fmt"].regroup(fieldValue)></#if>'

awk -v ins="$INS" 'index($0, "@widgetTextValue .node true") && index($0, "dispDynamic") { print; print ins; next } { print }' "$F" > "$F.zinr_tmp" && mv "$F.zinr_tmp" "$F"

grep -q "ZE-INR" "$F" || { echo "patch-macro-inr: verify FAILED" >&2; exit 1; }
echo "patch-macro-inr: OK — form-single currency displays now regroup to Indian"
