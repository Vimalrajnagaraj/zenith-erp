<#-- GST Credit/Debit Note Template for Moqui (CBIC Compliant) -->
<#assign dateFormat = dateFormat!"dd-MMM-yyyy">
<#macro encodeText textValue>${(Static["org.moqui.util.StringUtilities"].encodeForXmlAttribute(textValue!"", false))!""}</#macro>
<#macro formatINR amount>${ec.l10n.format(amount!0, "#,##0.00")}</#macro>

<#assign amountWords = "">
<#if invoice.invoiceTotal??>
    <#assign amt = invoice.invoiceTotal?string("0")?number>
    <#assign amountWords = ec.l10n.format(amt, "spellout") + " Rupees Only">
</#if>

<fo:root xmlns:fo="http://www.w3.org/1999/XSL/Format" font-family="Helvetica, sans-serif" font-size="8pt">
    <fo:layout-master-set>
        <fo:simple-page-master master-name="A4" page-width="210mm" page-height="297mm"
                               margin-top="10mm" margin-bottom="15mm" margin-left="10mm" margin-right="10mm">
            <fo:region-body margin-top="0mm" margin-bottom="20mm"/>
            <fo:region-after extent="15mm"/>
        </fo:simple-page-master>
    </fo:layout-master-set>

    <fo:page-sequence master-reference="A4" id="mainSequence">
        <fo:static-content flow-name="xsl-region-after">
            <fo:block text-align="center" font-size="8pt" border-top="0.5pt solid black" padding-top="2pt">
                This is a computer generated note and does not require a physical signature.
            </fo:block>
            <fo:block text-align="center" font-size="7pt">Page <fo:page-number/> of <fo:page-number-citation-last ref-id="mainSequence"/></fo:block>
        </fo:static-content>

        <fo:flow flow-name="xsl-region-body">
            
            <#-- HEADER -->
            <fo:block text-align="center" font-size="14pt" font-weight="bold" margin-bottom="2mm">
                <#if invoice.documentType??>
                    <@encodeText invoice.documentType?upper_case/>
                <#else>
                    CREDIT NOTE
                </#if>
            </fo:block>
            
            <#if invoice.einvoiceId?? && invoice.einvoiceId?has_content>
                <fo:block text-align="center" font-size="7pt" margin-bottom="2mm">
                    <fo:inline font-weight="bold">IRN:</fo:inline> ${invoice.einvoiceId}
                </fo:block>
            </#if>

            <fo:block border="0.5pt solid black">
                
                <#-- TOP ROW: SUPPLIER & NOTE DETAILS -->
                <fo:table table-layout="fixed" width="190mm" border-bottom="0.5pt solid black">
                    <fo:table-column column-width="95mm"/>
                    <fo:table-column column-width="95mm"/>
                    <fo:table-body>
                        <fo:table-row>
                            <#-- SUPPLIER DETAILS -->
                            <fo:table-cell padding="4pt" border-right="0.5pt solid black">
                                <fo:block font-weight="bold" font-size="10pt"><#if supplier??><@encodeText (supplier.organizationName)!""/> <@encodeText (supplier.firstName)!""/> <@encodeText (supplier.lastName)!""/><#else>ZINC ORGANIZATION</#if></fo:block>
                                <fo:block margin-top="4pt" font-weight="bold">GSTIN: <fo:inline font-weight="normal">${(invoice.supplierGstin)!"Unregistered"}</fo:inline></fo:block>
                                <fo:block font-weight="bold">State: <fo:inline font-weight="normal">${(invoice.placeOfSupplyStateCode)!"-"}</fo:inline></fo:block>
                            </fo:table-cell>

                            <#-- NOTE & ORIGINAL INVOICE DETAILS -->
                            <fo:table-cell padding="0pt">
                                <fo:table table-layout="fixed" width="95mm">
                                    <fo:table-column column-width="47.5mm"/>
                                    <fo:table-column column-width="47.5mm"/>
                                    <fo:table-body>
                                        <fo:table-row border-bottom="0.5pt solid black">
                                            <fo:table-cell padding="3pt" border-right="0.5pt solid black"><fo:block font-weight="bold">Note No.</fo:block><fo:block font-weight="bold" font-size="9pt">${invoice.gstInvoiceNumber ! invoice.invoiceId}</fo:block></fo:table-cell>
                                            <fo:table-cell padding="3pt"><fo:block font-weight="bold">Note Date</fo:block><fo:block font-weight="bold" font-size="9pt"><#if invoice.invoiceDate??>${ec.l10n.format(invoice.invoiceDate, dateFormat)}<#else>N/A</#if></fo:block></fo:table-cell>
                                        </fo:table-row>
                                        <fo:table-row border-bottom="0.5pt solid black">
                                            <fo:table-cell padding="3pt" border-right="0.5pt solid black" background-color="#f0f0f0"><fo:block font-weight="bold">Original Inv. No.</fo:block><fo:block font-weight="bold"><#if origInv??>${origInv.gstInvoiceNumber ! origInv.invoiceId ! "N/A"}<#else>N/A</#if></fo:block></fo:table-cell>
                                            <fo:table-cell padding="3pt" background-color="#f0f0f0"><fo:block font-weight="bold">Original Inv. Date</fo:block><fo:block><#if origInv?? && origInv.invoiceDate??>${ec.l10n.format(origInv.invoiceDate, dateFormat)}<#else>N/A</#if></fo:block></fo:table-cell>
                                        </fo:table-row>
                                        <fo:table-row>
                                            <fo:table-cell padding="3pt" border-right="0.5pt solid black" number-columns-spanned="2"><fo:block font-weight="bold">Reason for Issuance:</fo:block><fo:block><@encodeText invoice.invoiceMessage ! 'Sales Return'/></fo:block></fo:table-cell>
                                        </fo:table-row>
                                    </fo:table-body>
                                </fo:table>
                            </fo:table-cell>
                        </fo:table-row>
                    </fo:table-body>
                </fo:table>

                <#-- MIDDLE ROW: BUYER DETAILS -->
                <fo:table table-layout="fixed" width="190mm" border-bottom="0.5pt solid black">
                    <fo:table-column column-width="95mm"/>
                    <fo:table-column column-width="95mm"/>
                    <fo:table-body>
                        <fo:table-row>
                            <#-- BUYER DETAILS -->
                            <fo:table-cell padding="4pt" border-right="0.5pt solid black">
                                <fo:block font-size="7pt" color="gray" margin-bottom="2pt">Details of Receiver (Billed To)</fo:block>
                                <fo:block font-weight="bold" font-size="9pt"><#if customer??><@encodeText (customer.organizationName)!""/> <@encodeText (customer.firstName)!""/> <@encodeText (customer.lastName)!""/><#else>[NOT PROVIDED]</#if></fo:block>
                                <fo:block margin-top="4pt" font-weight="bold">GSTIN/UIN: <fo:inline font-weight="normal">${(invoice.buyerGstin)!"Unregistered"}</fo:inline></fo:block>
                            </fo:table-cell>

                            <#-- CONSIGNEE DETAILS -->
                            <fo:table-cell padding="4pt">
                                <fo:block font-size="7pt" color="gray" margin-bottom="2pt">Details of Consignee (Shipped To)</fo:block>
                                <fo:block font-weight="bold" font-size="9pt"><#if customer??><@encodeText (customer.organizationName)!""/> <@encodeText (customer.firstName)!""/> <@encodeText (customer.lastName)!""/><#else>[NOT PROVIDED]</#if></fo:block>
                                <fo:block margin-top="4pt" font-weight="bold">GSTIN/UIN: <fo:inline font-weight="normal">${(invoice.buyerGstin)!"Unregistered"}</fo:inline></fo:block>
                            </fo:table-cell>
                        </fo:table-row>
                    </fo:table-body>
                </fo:table>

                <#-- ITEMS TABLE -->
                <fo:table table-layout="fixed" width="190mm" border-bottom="0.5pt solid black">
                    <fo:table-column column-width="10.0mm"/> <#-- SN -->
                    <fo:table-column column-width="50.0mm"/> <#-- Desc -->
                    <fo:table-column column-width="15.0mm"/> <#-- HSN -->
                    <fo:table-column column-width="15.0mm"/> <#-- Qty -->
                    <fo:table-column column-width="18.0mm"/> <#-- Rate -->
                    <fo:table-column column-width="22.0mm"/> <#-- Taxable -->
                    <fo:table-column column-width="20.0mm"/> <#-- CGST -->
                    <fo:table-column column-width="20.0mm"/> <#-- SGST -->
                    <fo:table-column column-width="20.0mm"/> <#-- IGST -->
                    
                    <fo:table-header font-size="7pt" font-weight="bold" text-align="center">
                        <fo:table-row border-bottom="0.5pt solid black">
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>S.No.</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>Description of Goods/Services</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>HSN/SAC</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>Qty</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>Rate</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>Taxable Val.</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>CGST Amt</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block>SGST Amt</fo:block></fo:table-cell>
                            <fo:table-cell padding="2pt"><fo:block>IGST Amt</fo:block></fo:table-cell>
                        </fo:table-row>
                    </fo:table-header>
                    <fo:table-body>
                        <#list invoiceItems as item>
                            <#assign taxable = item.taxableAmount ! ((item.quantity!1)*(item.amount!0))>
                            <fo:table-row font-size="7.5pt" border-bottom="0.1pt solid gray">
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="center">${item_index+1}</fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block><@encodeText (item.description)!""/></fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="center">${item.hsnSacCode!"-"}</fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="center">${item.quantity!"1"}</fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="right"><@formatINR item.amount!0/></fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="right"><@formatINR taxable/></fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="right"><#if item.cgstAmount??><fo:block font-size="6pt" color="gray">${item.cgstRate!0}%</fo:block><@formatINR item.cgstAmount/><#else>-</#if></fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt" border-right="0.5pt solid black"><fo:block text-align="right"><#if item.sgstAmount??><fo:block font-size="6pt" color="gray">${item.sgstRate!0}%</fo:block><@formatINR item.sgstAmount/><#else>-</#if></fo:block></fo:table-cell>
                                <fo:table-cell padding="2pt"><fo:block text-align="right"><#if item.igstAmount??><fo:block font-size="6pt" color="gray">${item.igstRate!0}%</fo:block><@formatINR item.igstAmount/><#else>-</#if></fo:block></fo:table-cell>
                            </fo:table-row>
                        </#list>
                        
                        <#-- AGGREGATE ROW -->
                        <fo:table-row font-size="8pt" font-weight="bold" border-top="0.5pt solid black">
                            <fo:table-cell padding="3pt" border-right="0.5pt solid black" number-columns-spanned="5" text-align="right"><fo:block>TOTALS</fo:block></fo:table-cell>
                            <fo:table-cell padding="3pt" border-right="0.5pt solid black"><fo:block text-align="right"><@formatINR invoice.totalTaxableAmount!0/></fo:block></fo:table-cell>
                            <fo:table-cell padding="3pt" border-right="0.5pt solid black"><fo:block text-align="right"><@formatINR invoice.totalCgst!0/></fo:block></fo:table-cell>
                            <fo:table-cell padding="3pt" border-right="0.5pt solid black"><fo:block text-align="right"><@formatINR invoice.totalSgst!0/></fo:block></fo:table-cell>
                            <fo:table-cell padding="3pt"><fo:block text-align="right"><@formatINR invoice.totalIgst!0/></fo:block></fo:table-cell>
                        </fo:table-row>
                    </fo:table-body>
                </fo:table>

                <#-- GRAND TOTAL & WORDS -->
                <fo:table table-layout="fixed" width="190mm">
                    <fo:table-column column-width="130mm"/>
                    <fo:table-column column-width="60mm"/>
                    <fo:table-body>
                        <fo:table-row>
                            <fo:table-cell padding="5pt" border-right="0.5pt solid black">
                                <fo:block font-weight="bold" margin-bottom="2pt">Amount in Words:</fo:block>
                                <fo:block font-size="9pt">${amountWords}</fo:block>
                            </fo:table-cell>
                            <fo:table-cell padding="5pt" background-color="#f5f5f5">
                                <fo:block font-weight="bold" font-size="11pt" text-align="right">Total (Rs.)</fo:block>
                                <fo:block font-weight="bold" font-size="14pt" text-align="right" margin-top="4pt">
                                    <@formatINR invoice.invoiceTotal!0/>
                                </fo:block>
                                
                                <fo:block margin-top="20pt" text-align="center" font-size="7pt">for <#if supplier??><@encodeText (supplier.organizationName)!""/><#else>ZINC ORGANIZATION</#if></fo:block>
                                <fo:block margin-top="25pt" text-align="center" font-size="7pt" border-top="0.5pt solid black">Authorized Signatory</fo:block>
                            </fo:table-cell>
                        </fo:table-row>
                    </fo:table-body>
                </fo:table>

            </fo:block>
        </fo:flow>
    </fo:page-sequence>
</fo:root>
