<#assign total=(serialListCount!0)?number size=(serialListPageSize!10)?number index=(serialListPageIndex!0)?number max=(serialListPageMaxIndex!0)?number low=(serialListPageRangeLow!0)?number high=(serialListPageRangeHigh!0)?number>
<#macro arrow label glyph page enabled><#if enabled><a class="sn-page" aria-label="${label}" href="${snPagePath?html}?pageIndex=${page?c}&amp;${snFilterQuery?html}">${glyph}</a><#else><button type="button" class="sn-page" aria-label="${label}" disabled>${glyph}</button></#if></#macro>
<footer class="sn-footer"><span>Showing ${low} to ${high} of ${total} entries</span><nav aria-label="Serial pages">
<select class="sn-page-size" aria-label="Rows per page"><#list [10,20,50,100] as n><option value="${n?c}"<#if size==n> selected</#if>>${n} per page</option></#list></select>
<@arrow label='First page' glyph='|‹' page=0 enabled=(index gt 0)/><@arrow label='Previous page' glyph='‹' page=(index-1) enabled=(index gt 0)/>
<span class="sn-page current" aria-current="page">${index+1}</span>
<@arrow label='Next page' glyph='›' page=(index+1) enabled=(index lt max)/><@arrow label='Last page' glyph='›|' page=max enabled=(index lt max)/>
</nav></footer>
