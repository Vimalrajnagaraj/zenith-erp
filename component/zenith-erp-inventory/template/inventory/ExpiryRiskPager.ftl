<#assign qs='searchText='+((searchText)!'')?url('UTF-8')+'&amp;withinDays='+((withinDays)!'')?url('UTF-8')+'&amp;categoryFilter='+((categoryFilter)!'')?url('UTF-8')+'&amp;supplierFilter='+((supplierFilter)!'')?url('UTF-8')+'&amp;daysBucket='+((daysBucket)!'')?url('UTF-8')+'&amp;orderByField='+((orderByField)!'expiryDate')?url('UTF-8')+'&amp;pageSize='+pgSize?c>
<#macro arrow title glyph page enabled>
<#if enabled><a class="er-page" aria-label="${title}" href="?pageIndex=${page?c}&amp;${qs}">${glyph}</a><#else><button class="er-page" type="button" aria-label="${title}" disabled>${glyph}</button></#if>
</#macro>
<footer class="er-footer">
<span>Showing ${pgShowFrom} to ${pgShowTo} of ${pgTotal} items</span>
<nav class="er-pages" aria-label="Expiry report pages">
<select class="er-page-size" aria-label="Rows per page"><#list [20,50,100] as size><option value="${size?c}"<#if pgSize==size> selected</#if>>${size?c} / page</option></#list></select>
<@arrow title='First page' glyph='|‹' page=0 enabled=(pgIndex gt 0)/>
<@arrow title='Previous page' glyph='‹' page=(pgIndex-1) enabled=(pgIndex gt 0)/>
<span class="er-page current" aria-current="page">${pgIndex+1}</span>
<@arrow title='Next page' glyph='›' page=(pgIndex+1) enabled=(pgIndex lt pgCount-1)/>
<@arrow title='Last page' glyph='›|' page=(pgCount-1) enabled=(pgIndex lt pgCount-1)/>
</nav>
</footer>
