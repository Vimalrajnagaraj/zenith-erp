<html>
<head>
    <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; }
        .header { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
        .company-name { font-size: 20px; font-weight: bold; color: #1e3a8a; }
        .company-details { font-size: 11px; color: #666; margin-bottom: 20px; }
        .box { border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
        .row { width: 100%; display: table; }
        .col-half { width: 48%; display: table-cell; }
        .col-spacer { width: 4%; display: table-cell; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #f3f4f6; color: #111; font-weight: bold; border: 1px solid #ddd; padding: 8px; text-align: left; }
        td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-row { font-weight: bold; background-color: #f9fafb; }
        .amount-words { font-style: italic; font-size: 11px; margin-top: 5px; }
        .footer { margin-top: 40px; }
        .sign-box { border-top: 1px solid #333; width: 200px; text-align: center; float: right; padding-top: 5px; font-weight: bold; margin-top: 50px; }
        .einvoice-box { border: 1px solid #ddd; padding: 10px; background-color: #f8fafc; margin-bottom: 15px; border-radius: 4px; font-size: 10px; }
        .qr-code { width: 100px; height: 100px; float: right; border: 1px solid #eee; }
    </style>
</head>
<body>

    <div class="header">
        Tax Invoice
    </div>

    <div class="row">
        <div class="col-half box">
            <div class="company-name">${fromOrg.organizationName!}</div>
            <div class="company-details">
                GSTIN: <strong>${invoice.supplierGstin!'N/A'}</strong><br/>
                State Code: ${invoice.supplierStateCode!}<br/>
                Address: ${fromContactInfo?.postalAddress?.address1!}, ${fromContactInfo?.postalAddress?.city!}
            </div>
        </div>
        <div class="col-spacer"></div>
        <div class="col-half box">
            <table style="margin-bottom:0; border:none;">
                <tr><td style="border:none; padding:2px;"><strong>Invoice No:</strong></td><td style="border:none; padding:2px;">${invoice.gstInvoiceNumber ?: invoice.invoiceId}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>Date:</strong></td><td style="border:none; padding:2px;">${(invoice.invoiceDate?string("dd-MMM-yyyy"))!}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>Vehicle No:</strong></td><td style="border:none; padding:2px;">${invoice.vehicleNumber!'N/A'}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>E-Way Bill:</strong></td><td style="border:none; padding:2px;">${invoice.ewayBillId!'N/A'}</td></tr>
            </table>
        </div>
    </div>

    <#if einvoice?has_content>
    <div class="einvoice-box row">
        <div style="display:table-cell; vertical-align:top; width:80%;">
            <strong>IRN:</strong> ${einvoice.irn!}<br/>
            <strong>Ack No:</strong> ${einvoice.ackNumber!} &nbsp;&nbsp;&nbsp; <strong>Ack Date:</strong> ${(einvoice.ackDate?string("dd-MMM-yyyy HH:mm"))!}
        </div>
        <div style="display:table-cell; vertical-align:top; width:20%; text-align:right;">
            <#-- Mock QR code image for PDF -->
            <img class="qr-code" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="QR Code"/>
        </div>
    </div>
    </#if>

    <div class="row" style="margin-bottom: 20px;">
        <div class="col-half box">
            <strong>Billed To:</strong><br/>
            ${toParty.organizationName!toParty.firstName! + ' ' + toParty.lastName!}<br/>
            GSTIN: <strong>${invoice.buyerGstin!'URP'}</strong><br/>
            Place of Supply: ${invoice.placeOfSupplyStateCode!}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN/SAC</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Taxable Val</th>
                <th class="text-right">CGST</th>
                <th class="text-right">SGST</th>
                <th class="text-right">IGST</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            <#list invoiceItemList as item>
            <tr>
                <td>${item_index + 1}</td>
                <td>${item.description!}</td>
                <td>${item.hsnSacCode!}</td>
                <td class="text-right">${item.quantity!}</td>
                <td class="text-right">${item.amount?string("0.00")}</td>
                <td class="text-right">${(item.taxableAmount!0)?string("0.00")}</td>
                <td class="text-right">${(item.cgstAmount!0)?string("0.00")}<br/><small>@${item.cgstRate!0}%</small></td>
                <td class="text-right">${(item.sgstAmount!0)?string("0.00")}<br/><small>@${item.sgstRate!0}%</small></td>
                <td class="text-right">${(item.igstAmount!0)?string("0.00")}<br/><small>@${item.igstRate!0}%</small></td>
                <td class="text-right">${((item.taxableAmount!0) + (item.cgstAmount!0) + (item.sgstAmount!0) + (item.igstAmount!0) + (item.cessAmount!0))?string("0.00")}</td>
            </tr>
            </#list>
            
            <#if (invoice.tcsAmount!0) &gt; 0>
            <tr>
                <td colspan="9" class="text-right"><strong>TCS Amount</strong></td>
                <td class="text-right">${invoice.tcsAmount?string("0.00")}</td>
            </tr>
            </#if>

            <tr class="total-row">
                <td colspan="5" class="text-right">Grand Total</td>
                <td class="text-right">${(invoice.totalTaxableAmount!0)?string("0.00")}</td>
                <td class="text-right">${(invoice.totalCgst!0)?string("0.00")}</td>
                <td class="text-right">${(invoice.totalSgst!0)?string("0.00")}</td>
                <td class="text-right">${(invoice.totalIgst!0)?string("0.00")}</td>
                <td class="text-right">${((invoice.totalTaxableAmount!0) + (invoice.totalCgst!0) + (invoice.totalSgst!0) + (invoice.totalIgst!0) + (invoice.totalCess!0) + (invoice.tcsAmount!0))?string("0.00")}</td>
            </tr>
        </tbody>
    </table>

    <div class="amount-words">
        <strong>Amount in Words:</strong> ${invoice.amountInWords!}
    </div>

    <div class="footer row">
        <div class="col-half">
            <strong>Terms &amp; Conditions:</strong><br/>
            1. Subject to local jurisdiction.<br/>
            2. E. &amp; O.E.
        </div>
        <div class="col-half" style="text-align:right;">
            <div class="sign-box">
                Authorized Signatory<br/>
                <span style="font-size:10px; font-weight:normal;">For ${fromOrg.organizationName!}</span>
            </div>
        </div>
    </div>

</body>
</html>
