<#assign bucket=(daysBucket)!''>
<#assign qs='searchText='+((searchText)!'')?url('UTF-8')+'&amp;categoryFilter='+((categoryFilter)!'')?url('UTF-8')+'&amp;supplierFilter='+((supplierFilter)!'')?url('UTF-8')+'&amp;orderByField='+((orderByField)!'expiryDate')?url('UTF-8')+'&amp;pageSize='+pgSize?c>
<#assign counts=(expiryOut.tierCounts)!{}>
<#macro chip key title count color>
<a class="er-chip er-${color}<#if bucket==key> is-active</#if>" href="?daysBucket=${key?url('UTF-8')}&amp;withinDays=all&amp;${qs}" <#if bucket==key>aria-current="true"</#if>>${title} (${count})</a>
</#macro>
<nav class="er-chips" aria-label="Expiry date ranges">
<@chip key='all' title='All' count=(counts.all)!0 color='accent'/>
<@chip key='0-30' title='Within 30 days' count=(counts.d30)!0 color='orange'/>
<@chip key='31-60' title='Within 31-60 days' count=(counts.d3160)!0 color='red'/>
<@chip key='61-90' title='Within 61-90 days' count=(counts.d6190)!0 color='green'/>
<@chip key='90+' title='After 90 days' count=(counts.after90)!0 color='blue'/>
<@chip key='expired' title='Expired' count=(counts.expired)!0 color='red'/>
</nav>
