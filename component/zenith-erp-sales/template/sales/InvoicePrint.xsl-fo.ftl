<#-- Robu-Style Premium GST Tax Invoice Template for Moqui -->
<#assign dateFormat = dateFormat!"dd/MM/yyyy">
<#macro encodeText textValue>${(Static["org.moqui.util.StringUtilities"].encodeForXmlAttribute(textValue!"", false))!""}</#macro>
<#macro formatINR amount>${ec.l10n.format(amount!0, "#,##0.00")}</#macro>

<#assign amountWords = (amountInWords)!"">

<#assign colorBg = "#f1f5f9"> <#-- Light Gray for boxes -->
<#assign colorText = "#000000">

<fo:root xmlns:fo="http://www.w3.org/1999/XSL/Format" font-family="Helvetica, sans-serif" font-size="8pt" color="${colorText}">
    <fo:layout-master-set>
        <fo:simple-page-master master-name="A4" page-width="210mm" page-height="297mm"
                               margin-top="10mm" margin-bottom="10mm" margin-left="10mm" margin-right="10mm">
            <fo:region-body margin-top="5mm" margin-bottom="15mm"/>
            <fo:region-after extent="15mm"/>
        </fo:simple-page-master>
    </fo:layout-master-set>

    <fo:page-sequence master-reference="A4" id="mainSequence">
        
        <#-- FOOTER -->
        <fo:static-content flow-name="xsl-region-after">
            <fo:block border-top="1pt solid black" padding-top="4pt" text-align="center" font-size="7pt" font-weight="bold">
                <#if supplier??><@encodeText (supplier.organizationName)!(((supplier.firstName)!"") + " " + ((supplier.lastName)!""))/></#if>
                <#if invoice?? && (invoice.supplierGstin)??> • GSTIN: ${invoice.supplierGstin}</#if>
            </fo:block>
            <fo:block text-align="center" font-size="7pt" margin-top="4pt">
                <fo:page-number/> / <fo:page-number-citation-last ref-id="mainSequence"/>
            </fo:block>
        </fo:static-content>

        <fo:flow flow-name="xsl-region-body">
            <#if invoice??>
            
            <#-- HEADER ROW: Logo, QR / Title, Supplier -->
            <fo:table table-layout="fixed" width="190mm" margin-bottom="6mm">
                <fo:table-column column-width="65mm"/>
                <fo:table-column column-width="60mm"/>
                <fo:table-column column-width="65mm"/>
                <fo:table-body>
                    <fo:table-row>
                        <#-- Logo / Company Branding -->
                        <fo:table-cell>
                            <fo:block font-size="20pt" font-weight="bold" color="#ff7a00" margin-top="5mm">
                                <@encodeText (supplier.organizationName)!(((supplier.firstName)!"") + " " + ((supplier.lastName)!""))/>
                            </fo:block>
                            <#if invoice.einvoiceId?? && invoice.einvoiceId?has_content>
                                <fo:block font-size="6pt" margin-top="4pt">IRN No: ${invoice.einvoiceId}</fo:block>
                            </#if>
                        </fo:table-cell>
                        
                        <#-- Title -->
                        <fo:table-cell text-align="center">
                            <fo:block font-size="8pt" margin-bottom="2mm">
                                <#if invoice.documentType??><@encodeText invoice.documentType?upper_case/><#else>TAX INVOICE</#if>
                                (Original for Recipient)
                            </fo:block>
                            <#-- QR Code Placeholder Box -->
                            <fo:block border="1pt solid #ccc" width="30mm" height="30mm" margin-left="15mm" padding="2mm" text-align="center" color="#ccc">
                                [ QR CODE ]
                            </fo:block>
                        </fo:table-cell>
                        
                        <#-- Supplier Details -->
                        <fo:table-cell padding-left="5mm">
                            <fo:block font-size="12pt" font-weight="bold" margin-bottom="4pt">
                                <@encodeText (supplier.organizationName)!(((supplier.firstName)!"") + " " + ((supplier.lastName)!""))/>
                            </fo:block>
                            <#if supplierContactInfo?? && supplierContactInfo.postalAddress?has_content>
                                <#if (supplierContactInfo.postalAddress.address1)?has_content><fo:block font-size="7pt" margin-bottom="1pt"><@encodeText supplierContactInfo.postalAddress.address1/></fo:block></#if>
                                <#if (supplierContactInfo.postalAddress.address2)?has_content><fo:block font-size="7pt" margin-bottom="1pt"><@encodeText supplierContactInfo.postalAddress.address2/></fo:block></#if>
                                <fo:block font-size="7pt" margin-bottom="1pt"><@encodeText (supplierContactInfo.postalAddress.city)!""/><#if (supplierContactInfo.postalAddressStateGeo.geoName)?has_content>, ${supplierContactInfo.postalAddressStateGeo.geoName}</#if><#if (supplierContactInfo.postalAddress.postalCode)?has_content> - ${supplierContactInfo.postalAddress.postalCode}</#if></fo:block>
                            </#if>
                            <#if supplierContactInfo?? && (supplierContactInfo.telecomNumber.contactNumber)?has_content><fo:block font-size="7pt" margin-bottom="1pt">Phone: ${supplierContactInfo.telecomNumber.contactNumber}</fo:block></#if>
                            <#if supplierContactInfo?? && (supplierContactInfo.emailAddress)?has_content><fo:block font-size="7pt" margin-bottom="1pt">Email: ${supplierContactInfo.emailAddress}</fo:block></#if>
                            <#if (supplier.panNumber)?has_content><fo:block font-size="7pt" margin-top="2pt">PAN: <fo:inline font-weight="bold">${supplier.panNumber}</fo:inline></fo:block></#if>
                            <fo:block font-size="7pt" margin-top="2pt">GSTIN: <fo:inline font-weight="bold">${(invoice.supplierGstin)!"Unregistered"}</fo:inline></fo:block>
                        </fo:table-cell>
                    </fo:table-row>
                </fo:table-body>
            </fo:table>

            <#-- 3-COLUMN ADDRESS & INVOICE DETAILS -->
            <fo:table table-layout="fixed" width="190mm" margin-bottom="8mm">
                <fo:table-column column-width="50mm"/>
                <fo:table-column column-width="5mm"/> <#-- Gutter -->
                <fo:table-column column-width="50mm"/>
                <fo:table-column column-width="5mm"/> <#-- Gutter -->
                <fo:table-column column-width="80mm"/>
                <fo:table-body>
                    <fo:table-row>
                        
                        <#-- CUSTOMER (BILLED TO) -->
                        <fo:table-cell>
                            <fo:block background-color="${colorBg}" padding="3pt" font-weight="bold" margin-bottom="4pt">
                                Customer
                            </fo:block>
                            <fo:block font-weight="bold" font-size="10pt" margin-bottom="4pt" text-transform="uppercase">
                                <#if (customer.organizationName)?has_content><@encodeText customer.organizationName/>
                                <#elseif (customer.firstName)?has_content><@encodeText customer.firstName/> <@encodeText customer.lastName!"" />
                                <#else>[Not Provided]</#if>
                            </fo:block>
                            <fo:block font-size="7pt" margin-bottom="1pt">Place of Supply: ${(invoice.placeOfSupplyStateCode)!"-"}</fo:block>
                            <fo:block font-size="7pt" margin-top="4pt">GSTIN: ${(invoice.buyerGstin)!"Unregistered"}</fo:block>
                        </fo:table-cell>
                        
                        <fo:table-cell><fo:block/></fo:table-cell>

                        <#-- SHIPPING ADDRESS -->
                        <fo:table-cell>
                            <fo:block background-color="${colorBg}" padding="3pt" font-weight="bold" margin-bottom="4pt">
                                Shipping Address
                            </fo:block>
                            <fo:block font-weight="bold" font-size="10pt" margin-bottom="4pt" text-transform="uppercase">
                                <#if (customer.organizationName)?has_content><@encodeText customer.organizationName/>
                                <#elseif (customer.firstName)?has_content><@encodeText customer.firstName/> <@encodeText customer.lastName!"" />
                                <#else>[Not Provided]</#if>
                            </fo:block>
                            <fo:block font-size="7pt" margin-bottom="1pt">Place of Supply: ${(invoice.placeOfSupplyStateCode)!"-"}</fo:block>
                        </fo:table-cell>

                        <fo:table-cell><fo:block/></fo:table-cell>

                        <#-- INVOICE DETAILS BOX -->
                        <fo:table-cell background-color="${colorBg}" padding="6pt">
                            <fo:block font-size="16pt" margin-bottom="8pt">
                                Invoice# <fo:inline font-weight="bold">${(invoice.gstInvoiceNumber)!(invoice.invoiceId)}</fo:inline>
                            </fo:block>
                            <fo:table table-layout="fixed" width="100%">
                                <fo:table-column column-width="33%"/>
                                <fo:table-column column-width="33%"/>
                                <fo:table-column column-width="34%"/>
                                <fo:table-body>
                                    <fo:table-row>
                                        <fo:table-cell margin-bottom="4pt">
                                            <fo:block font-weight="bold">Invoice Date:</fo:block>
                                            <fo:block font-size="10pt" font-weight="bold"><#if invoice.invoiceDate??>${ec.l10n.format(invoice.invoiceDate, dateFormat)}<#else>N/A</#if></fo:block>
                                        </fo:table-cell>
                                        <fo:table-cell margin-bottom="4pt">
                                            <fo:block font-weight="bold">Reference:</fo:block>
                                            <fo:block font-size="10pt" font-weight="bold">${(invoice.invoiceId)}</fo:block>
                                        </fo:table-cell>
                                        <fo:table-cell margin-bottom="4pt">
                                            <fo:block font-weight="bold">E-Way Bill:</fo:block>
                                            <fo:block font-size="9pt">${(invoice.ewayBillId)!"-"}</fo:block>
                                        </fo:table-cell>
                                    </fo:table-row>
                                    <fo:table-row>
                                        <fo:table-cell>
                                            <fo:block font-weight="bold">Vehicle No:</fo:block>
                                            <fo:block font-size="9pt">${(invoice.vehicleNumber)!"-"}</fo:block>
                                        </fo:table-cell>
                                        <fo:table-cell>
                                            <fo:block font-weight="bold">LR / Docket:</fo:block>
                                            <fo:block font-size="9pt">${(invoice.lrNumber)!"-"}</fo:block>
                                        </fo:table-cell>
                                        <fo:table-cell>
                                            <fo:block font-weight="bold">Reverse Charge:</fo:block>
                                            <fo:block font-size="9pt">${((invoice.isReverseCharge)!'N' == 'Y')?string('Yes', 'No')}</fo:block>
                                        </fo:table-cell>
                                    </fo:table-row>
                                </fo:table-body>
                            </fo:table>
                        </fo:table-cell>

                    </fo:table-row>
                </fo:table-body>
            </fo:table>

            <#-- ITEMS TABLE -->
            <fo:table table-layout="fixed" width="190mm" margin-bottom="6mm">
                <fo:table-column column-width="8mm"/>  <#-- SN -->
                <fo:table-column column-width="50mm"/> <#-- Desc -->
                <fo:table-column column-width="15mm"/> <#-- HSN -->
                <fo:table-column column-width="18mm"/> <#-- Rate -->
                <fo:table-column column-width="12mm"/> <#-- Qty -->
                <fo:table-column column-width="20mm"/> <#-- Taxable -->
                <fo:table-column column-width="20mm"/> <#-- CGST -->
                <fo:table-column column-width="20mm"/> <#-- SGST -->
                <fo:table-column column-width="27mm"/> <#-- IGST & Total -->
                
                <fo:table-header background-color="${colorBg}" font-weight="bold">
                    <fo:table-row>
                        <fo:table-cell padding="4pt"><fo:block text-align="center">#</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block>Description</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="center">HSN</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="right">Rate</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="center">Qty</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="right">Taxable</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="right">CGST</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="right">SGST</fo:block></fo:table-cell>
                        <fo:table-cell padding="4pt"><fo:block text-align="right">IGST / Total</fo:block></fo:table-cell>
                    </fo:table-row>
                </fo:table-header>
                
                <fo:table-body>
                    <#if invoiceItems?has_content>
                        <#list invoiceItems as item>
                            <#assign taxable = (item.taxableAmount)!(((item.quantity)!1) * ((item.amount)!0))>
                            <#assign totalItem = taxable + (item.cgstAmount!0) + (item.sgstAmount!0) + (item.igstAmount!0)>
                            <fo:table-row font-size="7.5pt" border-bottom="0.5pt solid ${colorBg}">
                                <fo:table-cell padding="4pt"><fo:block text-align="center">${item_index+1}</fo:block></fo:table-cell>
                                <fo:table-cell padding="4pt"><fo:block><@encodeText (item.description)!""/></fo:block></fo:table-cell>
                                <fo:table-cell padding="4pt"><fo:block text-align="center">${item.hsnSacCode!"-"}</fo:block></fo:table-cell>
                                <fo:table-cell padding="4pt"><fo:block text-align="right">Rs. <@formatINR item.amount!0/></fo:block></fo:table-cell>
                                <fo:table-cell padding="4pt"><fo:block text-align="center">${item.quantity!"1.00"}</fo:block></fo:table-cell>
                                <fo:table-cell padding="4pt"><fo:block text-align="right">Rs. <@formatINR taxable/></fo:block></fo:table-cell>
                                
                                <fo:table-cell padding="4pt"><fo:block text-align="right">
                                    <#if item.cgstAmount??>Rs. <@formatINR item.cgstAmount/><fo:block font-size="6pt">(${item.cgstRate!0}%)</fo:block><#else>-</#if>
                                </fo:block></fo:table-cell>
                                
                                <fo:table-cell padding="4pt"><fo:block text-align="right">
                                    <#if item.sgstAmount??>Rs. <@formatINR item.sgstAmount/><fo:block font-size="6pt">(${item.sgstRate!0}%)</fo:block><#else>-</#if>
                                </fo:block></fo:table-cell>
                                
                                <fo:table-cell padding="4pt"><fo:block text-align="right">
                                    <#if item.igstAmount??>Rs. <@formatINR item.igstAmount/><fo:block font-size="6pt">(${item.igstRate!0}%)</fo:block><#else>-</#if>
                                    <fo:block font-weight="bold" margin-top="2pt">Rs. <@formatINR totalItem/></fo:block>
                                </fo:block></fo:table-cell>
                            </fo:table-row>
                        </#list>
                    <#else>
                        <fo:table-row>
                            <fo:table-cell padding="10pt" number-columns-spanned="9" text-align="center">
                                <fo:block font-style="italic">No items added.</fo:block>
                            </fo:table-cell>
                        </fo:table-row>
                    </#if>
                </fo:table-body>
            </fo:table>

            <#-- TOTALS BAR (Like the Robu one: Total: xx.xx) -->
            <fo:block text-align="center" font-weight="bold" margin-bottom="10mm">
                Total Taxable: <@formatINR invoice.totalTaxableAmount!0/>
            </fo:block>

            <#-- BOTTOM SECTION: Words, Terms on Left | Subtotals on Right -->
            <fo:table table-layout="fixed" width="190mm">
                <fo:table-column column-width="120mm"/>
                <fo:table-column column-width="10mm"/> <#-- Spacer -->
                <fo:table-column column-width="60mm"/>
                <fo:table-body>
                    <fo:table-row>
                        <#-- LEFT SIDE: Words & Terms -->
                        <fo:table-cell>
                            <fo:block font-weight="bold" font-size="8pt" margin-bottom="2pt">Amount in Words:<fo:inline font-weight="normal" text-decoration="underline"> ${amountWords}</fo:inline></fo:block>
                            <fo:block font-weight="bold" font-size="8pt" margin-bottom="2pt">Payment terms: <fo:inline font-weight="normal">Immediate Payment</fo:inline></fo:block>
                            <fo:block font-weight="bold" font-size="8pt" margin-bottom="8pt">Whether tax is payable under reverse charge: <fo:inline font-weight="normal">${((invoice.isReverseCharge)!'N' == 'Y')?string('Yes', 'No')}</fo:inline></fo:block>
                            
                            <fo:block font-weight="bold" font-size="8pt" margin-bottom="2pt">Terms &amp; Conditions</fo:block>
                            <fo:block font-size="7pt" margin-bottom="1pt">01) Notify us within 2 days of delivery in case of issues.</fo:block>
                            <fo:block font-size="7pt" margin-bottom="1pt">02) Warranty claims result in product replacement only.</fo:block>
                            <fo:block font-size="7pt" margin-bottom="1pt">03) GST Compliance: Ensure active GST number for input tax credit.</fo:block>
                            
                            <fo:block font-weight="bold" font-size="8pt" text-align="center" margin-top="15pt">This is a computer generated Invoice.</fo:block>
                            <fo:block font-weight="bold" font-size="8pt" text-align="center" margin-top="4pt">Subject to Jurisdiction</fo:block>
                        </fo:table-cell>

                        <fo:table-cell><fo:block/></fo:table-cell>

                        <#-- RIGHT SIDE: Subtotal / Taxes / Total -->
                        <fo:table-cell>
                            <fo:table table-layout="fixed" width="100%">
                                <fo:table-column column-width="30mm"/>
                                <fo:table-column column-width="30mm"/>
                                <fo:table-body>
                                    <fo:table-row>
                                        <fo:table-cell padding="4pt"><fo:block font-weight="bold">Subtotal</fo:block></fo:table-cell>
                                        <fo:table-cell padding="4pt" text-align="right"><fo:block>Rs. <@formatINR invoice.totalTaxableAmount!0/></fo:block></fo:table-cell>
                                    </fo:table-row>
                                    <#assign totalTaxes = (invoice.totalCgst!0) + (invoice.totalSgst!0) + (invoice.totalIgst!0)>
                                    <fo:table-row border-bottom="1pt solid black">
                                        <fo:table-cell padding="4pt"><fo:block font-weight="bold">Taxes</fo:block></fo:table-cell>
                                        <fo:table-cell padding="4pt" text-align="right"><fo:block>Rs. <@formatINR totalTaxes/></fo:block></fo:table-cell>
                                    </fo:table-row>
                                    <fo:table-row>
                                        <fo:table-cell padding="4pt"><fo:block font-weight="bold">Total</fo:block></fo:table-cell>
                                        <fo:table-cell padding="4pt" text-align="right"><fo:block font-weight="bold" text-decoration="underline">Rs. <@formatINR invoice.invoiceTotal!0/></fo:block></fo:table-cell>
                                    </fo:table-row>
                                </fo:table-body>
                            </fo:table>
                        </fo:table-cell>
                        
                    </fo:table-row>
                </fo:table-body>
            </fo:table>

            <#else>
            <fo:block font-size="14pt" font-weight="bold" text-align="center" margin-top="60mm" color="#b00020">This document is not available or you do not have permission to view it.</fo:block>
            </#if>
        </fo:flow>
    </fo:page-sequence>
</fo:root>
