<#assign period=(withinDays)!''>
<#if ((daysBucket)!'')=='all' || ((daysBucket)!'')=='90+'><#assign period='all'><#elseif ((daysBucket)!'')=='expired'><#assign period='expired'></#if>
<form class="er-filter-form" method="get" action="">
  <label class="er-field er-search"><span>Search</span><input type="search" name="searchText" value="${((searchText)!'')?html}" placeholder="Search by product, batch, supplier, SKU..."/></label>
  <label class="er-field"><span>Expiring within</span><select name="withinDays">
    <#list [['','Next 90 days ('+(((expiryOut.tierCounts.all)!0)-((expiryOut.tierCounts.after90)!0))?c+')'],['all','All expiry dates'],['7','Next 7 days'],['30','Next 30 days'],['60','Next 60 days'],['90','Next 90 days'],['expired','Already expired']] as option><option value="${option[0]}"<#if period==option[0]> selected</#if>>${option[1]}</option></#list>
  </select></label>
  <label class="er-field"><span>Category</span><select name="categoryFilter"><option value="">All Categories</option><#list expiryOut.categoryOptions as option><option value="${option.v?html}"<#if ((categoryFilter)!'')==option.v> selected</#if>>${option.v?html}</option></#list></select></label>
  <label class="er-field"><span>Supplier</span><select name="supplierFilter"><option value="">All Suppliers</option><#list expiryOut.supplierOptions as option><option value="${option.v?html}"<#if ((supplierFilter)!'')==option.v> selected</#if>>${option.v?html}</option></#list></select></label>
  <input type="hidden" name="orderByField" value="${sortField?html}"/><input type="hidden" name="pageSize" value="${pgSize?c}"/>
  <button type="submit" class="er-button er-primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18l-7 8v8l-4-2v-6L3 4Z"/></svg> Filter</button>
  <a class="er-reset" href="?pageSize=${pgSize?c}">↻ &nbsp; Reset</a>
</form>
