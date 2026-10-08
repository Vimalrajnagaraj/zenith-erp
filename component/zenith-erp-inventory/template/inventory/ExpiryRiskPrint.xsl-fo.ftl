<fo:root xmlns:fo="http://www.w3.org/1999/XSL/Format" font-family="Helvetica, sans-serif" font-size="8pt">
<#macro encodeText textValue>${(Static["org.moqui.util.StringUtilities"].encodeForXmlAttribute(textValue!"", false))!""}</#macro>
<#macro inr amount>Rs. ${Static["com.zenith.Fmt"].regroup(ec.l10n.format(amount!0, "#,##0.00"))}</#macro>
<#assign items = (expiryOut.expiringAssets)![]>

    <fo:layout-master-set>
        <fo:simple-page-master master-name="A4L" page-width="297mm" page-height="210mm"
                               margin-top="10mm" margin-bottom="14mm" margin-left="10mm" margin-right="10mm">
            <fo:region-body margin-top="0mm" margin-bottom="8mm"/>
            <fo:region-after extent="8mm"/>
        </fo:simple-page-master>
    </fo:layout-master-set>

    <fo:page-sequence master-reference="A4L" id="mainSequence">
        <fo:static-content flow-name="xsl-region-after">
            <fo:block text-align="center" font-size="7pt" color="#666666">
                Computer-generated report &#8226; Page <fo:page-number/> of <fo:page-number-citation-last ref-id="mainSequence"/>
            </fo:block>
        </fo:static-content>

        <fo:flow flow-name="xsl-region-body">
            <#-- HEADER -->
            <fo:block text-align="center" font-size="15pt" font-weight="bold" margin-bottom="2mm">Expiry Risk Report</fo:block>
            <fo:block text-align="center" font-size="10pt" margin-bottom="1mm"><@encodeText orgName!""/></fo:block>
            <fo:block text-align="center" font-size="8pt" color="#444444" margin-bottom="4mm">
                As of ${reportDate!""} &#8226; Filtered expiry stock report &#8226;
                Total value at risk: <fo:inline font-weight="bold"><@inr expiryOut.totalExpiryValue!0/></fo:inline>
                <#if (searchText!"")?has_content> &#8226; Search: &#8220;<@encodeText searchText/>&#8221;</#if>
                <#if (withinDays!"")?has_content> &#8226; Filter: <#if withinDays=='expired'>already expired<#else><#if withinDays=='all'>all expiry dates<#else>within ${withinDays} days</#if></#if></#if>
            </fo:block>

            <#-- TABLE -->
            <fo:table table-layout="fixed" width="100%" border="0.5pt solid #999999">
                <fo:table-column column-width="9%"/><fo:table-column column-width="18%"/><fo:table-column column-width="11%"/>
                <fo:table-column column-width="16%"/><fo:table-column column-width="11%"/><fo:table-column column-width="7%"/>
                <fo:table-column column-width="7%"/><fo:table-column column-width="12%"/><fo:table-column column-width="9%"/>
                <fo:table-header>
                    <fo:table-row font-weight="bold" background-color="#e8e8e8">
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Stock ID</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Product Name</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Batch / Lot</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Supplier</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Expiry Date</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block text-align="right">Days</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block text-align="right">Qty</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block text-align="right">Value at Risk</fo:block></fo:table-cell>
                        <fo:table-cell padding="3pt" border-bottom="0.5pt solid #999999"><fo:block>Basis</fo:block></fo:table-cell>
                    </fo:table-row>
                </fo:table-header>
                <fo:table-body>
                    <#if items?has_content>
                        <#list items as r>
                        <#assign expired = (r.daysToExpiry!999)?number &lt; 0>
                        <fo:table-row>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><@encodeText r.assetId!""/></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><@encodeText r.productName!""/></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><@encodeText r.batchNumber!""/></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><#if (r.supplierName!"")?has_content><@encodeText r.supplierName/><#else>&#8212;</#if></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><#if r.expiryDate??>${ec.l10n.format(r.expiryDate, "yyyy-MM-dd")}</#if></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block text-align="right" <#if expired>color="#c0392b" font-weight="bold"</#if>><#if expired>EXPIRED<#else>${r.daysToExpiry!""}</#if></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block text-align="right">${ec.l10n.format(r.quantity!0, "#,##0.###")}</fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block text-align="right"><@inr r.value!0/></fo:block></fo:table-cell>
                            <fo:table-cell padding="2.5pt" border-bottom="0.25pt solid #cccccc"><fo:block><#if r.valueBasis=='MRP'>MRP<#elseif r.valueBasis=='unvalued'>&#8212;<#else>cost</#if></fo:block></fo:table-cell>
                        </fo:table-row>
                        </#list>
                    <#else>
                        <fo:table-row>
                            <fo:table-cell number-columns-spanned="9" padding="6pt"><fo:block text-align="center" color="#666666">No stock is expiring within this period.</fo:block></fo:table-cell>
                        </fo:table-row>
                    </#if>
                </fo:table-body>
            </fo:table>

            <fo:block margin-top="4mm" font-size="7pt" color="#666666">Value at Risk is at cost where known; &#8220;MRP&#8221; basis rows are valued at retail, &#8220;&#8212;&#8221; are unvalued.</fo:block>
        </fo:flow>
    </fo:page-sequence>
</fo:root>
