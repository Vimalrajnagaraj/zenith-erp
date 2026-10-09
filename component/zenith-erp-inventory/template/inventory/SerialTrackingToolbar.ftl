<div class="sn-toolbar">
<form class="sn-search" method="get" action="${snPagePath?html}">
<button type="submit" aria-label="Search serial numbers"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button>
<input type="search" name="serialNumber" aria-label="Search Serial Numbers" placeholder="Search Serial Numbers..." value="${(serialNumber!'')?html}" maxlength="100"/>
<input type="hidden" name="serialNumber_op" value="contains"/><input type="hidden" name="pageSize" value="${serialSearch.serialSearchParams.pageSize?c}"/>
<#list snFilterFields as field><#if field.paramName!='serialNumber' && field.paramName!='serialNumber_op'><input type="hidden" name="${field.paramName?html}" value="${field.paramValue?html}"/></#if></#list>
</form>
<div class="sn-native-controls"></div>
<a class="sn-tool sn-csv" href="${snExportUrl?html}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg>CSV</a>
<a class="sn-reset" href="${snPagePath?html}?pageSize=${serialSearch.serialSearchParams.pageSize?c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7V2l-3 3a9 9 0 1 0 3 10M20 2h-5"/></svg>Reset</a>
</div>
