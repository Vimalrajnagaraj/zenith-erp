<#macro icon name>
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
<#if name=='document'><path d="M6 2h8l4 4v16H6zM14 2v5h5M9 11h6M9 15h6M9 18h4"/>
<#elseif name=='box'><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>
<#elseif name=='truck'><path d="M2 4h12v13H2zM14 9h4l4 4v4h-8M17 9v5h5"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
<#else><path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6l9-4ZM12 7v7M12 17h.01"/></#if>
</svg>
</#macro>
<div class="sn-stats">
<#list [{'label':'Total Serials','value':totalSerials!0,'tone':'violet','icon':'document'}, {'label':'In Stock','value':inStockCount!0,'tone':'green','icon':'box'}, {'label':'Sold','value':soldCount!0,'tone':'blue','icon':'truck'}, {'label':'Defective / Warranty','value':defectiveCount!0,'tone':'red','icon':'shield'}] as card>
<section class="sn-stat sn-${card.tone}"><span class="sn-stat-icon"><@icon name=card.icon/></span><div><div class="sn-stat-label">${card.label}</div><div class="sn-stat-value">${card.value}</div></div></section>
</#list>
</div>
