#!/bin/sh
# ZE-INR-GRID — Indian lakh/crore grouping for server-rendered form-LIST grid currency cells.
#
# Grid cells render through the m-display Vue component as <span class="text-inline BigDecimal">146,209.00</span>
# from a value formatted server-side in Java (single grouping size => Western for >= 1 lakh). All display cells
# (form-single AND form-list) flow through m-display's `displayValue` computed — the one choke point. We define
# moqui.zinrDisp and wrap displayValue with it. zinrDisp regroups ONLY strings that are ENTIRELY a comma-grouped
# number (optional sign/decimals) to Indian 3-2-2; anything else — dates, times, status, names, bill numbers,
# phones, years, amounts < 1 lakh, already-Indian values — is returned untouched. Idempotent + self-verifying.
# Patches the served *.min.js (and dev *.js for parity — call once per file). Run in the Docker build.
#
# Usage: patch-webroot-inr-grid.sh [path-to-WebrootVue.qvt(.min).js]
set -e
F="${1:-/opt/moqui/runtime/base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js}"
[ -f "$F" ] || { echo "patch-webroot-inr-grid: file not found: $F" >&2; exit 1; }
if grep -q "zinrDisp" "$F"; then echo "patch-webroot-inr-grid: already applied ($F)"; exit 0; fi

# backslash-free (safe as a sed '#'-delimited replacement); gate requires the WHOLE value to be a comma-grouped number
FN='moqui.zinrDisp=function(v){if(typeof v!=="string")return v;if(!/^[ ]*-?[0-9]+(,[0-9]+)+([.][0-9]+)?[ ]*$/.test(v))return v;return v.replace(/([0-9][0-9,]*)([.][0-9]+)?/,function(m,ip,dc){ip=ip.replace(/,/g,"");dc=dc||"";if(ip.length<=3)return ip+dc;var l=ip.slice(-3),r=ip.slice(0,-3),o="",c=0,i;for(i=r.length-1;i>=0;i--){o=r.charAt(i)+o;c++;if(c%2===0){if(i!==0)o=","+o;}}return o+","+l+dc;});};'

if grep -q 'Vue.component("m-display",{' "$F"; then           # minified
  sed -i "s#Vue.component(\"m-display\",{#${FN}Vue.component(\"m-display\",{#" "$F"
  sed -i "s#this.curDisplay&&this.curDisplay.length?this.curDisplay:this.value#moqui.zinrDisp(&)#" "$F"
elif grep -q "Vue.component('m-display', {" "$F"; then         # dev
  sed -i "s#Vue.component('m-display', {#${FN}Vue.component('m-display', {#" "$F"
  sed -i "s#this.curDisplay && this.curDisplay.length ? this.curDisplay : this.value#moqui.zinrDisp(&)#" "$F"
else
  echo "patch-webroot-inr-grid: m-display component anchor not found (framework changed?) — FAILING" >&2; exit 1
fi

if grep -q "moqui.zinrDisp(this.curDisplay" "$F"; then
  echo "patch-webroot-inr-grid: OK — grid currency cells regroup to Indian ($F)"
else
  echo "patch-webroot-inr-grid: verify FAILED (displayValue not wrapped) — FAILING" >&2; exit 1
fi
