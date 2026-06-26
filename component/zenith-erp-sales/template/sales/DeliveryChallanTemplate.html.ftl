<html>
<head>
    <style>
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #333; }
        .header { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
        .company-name { font-size: 20px; font-weight: bold; color: #ea580c; }
        .company-details { font-size: 11px; color: #666; margin-bottom: 20px; }
        .box { border: 1px solid #ccc; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
        .row { width: 100%; display: table; }
        .col-half { width: 48%; display: table-cell; }
        .col-spacer { width: 4%; display: table-cell; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #f3f4f6; color: #111; font-weight: bold; border: 1px solid #ddd; padding: 8px; text-align: left; }
        td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .text-right { text-align: right; }
        .total-row { font-weight: bold; background-color: #f9fafb; }
        .sign-box { border-top: 1px solid #333; width: 200px; text-align: center; float: right; padding-top: 5px; font-weight: bold; margin-top: 50px; }
    </style>
</head>
<body>

    <div class="header">
        Delivery Challan
        <div style="font-size:10px; font-weight:normal; text-transform:none;">(Issued for movement of goods other than by way of supply)</div>
    </div>

    <div class="row">
        <div class="col-half box">
            <div class="company-name">${fromOrg.organizationName!}</div>
            <div class="company-details">
                GSTIN: <strong>${invoice.supplierGstin!'N/A'}</strong><br/>
                Address: ${fromContactInfo?.postalAddress?.address1!}, ${fromContactInfo?.postalAddress?.city!}
            </div>
        </div>
        <div class="col-spacer"></div>
        <div class="col-half box">
            <table style="margin-bottom:0; border:none;">
                <tr><td style="border:none; padding:2px;"><strong>Challan No:</strong></td><td style="border:none; padding:2px;">${invoice.gstInvoiceNumber ?: invoice.invoiceId}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>Date:</strong></td><td style="border:none; padding:2px;">${(invoice.invoiceDate?string("dd-MMM-yyyy"))!}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>Vehicle No:</strong></td><td style="border:none; padding:2px;">${invoice.vehicleNumber!'N/A'}</td></tr>
                <tr><td style="border:none; padding:2px;"><strong>E-Way Bill:</strong></td><td style="border:none; padding:2px;">${invoice.ewayBillId!'N/A'}</td></tr>
            </table>
        </div>
    </div>

    <div class="row" style="margin-bottom: 20px;">
        <div class="col-half box">
            <strong>Consignee Details:</strong><br/>
            ${toParty.organizationName!toParty.firstName! + ' ' + toParty.lastName!}<br/>
            GSTIN: <strong>${invoice.buyerGstin!'URP'}</strong><br/>
            State Code: ${invoice.buyerStateCode!}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN/SAC</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Estimated Value</th>
            </tr>
        </thead>
        <tbody>
            <#list invoiceItemList as item>
            <tr>
                <td>${item_index + 1}</td>
                <td>${item.description!}</td>
                <td>${item.hsnSacCode!}</td>
                <td class="text-right">${item.quantity!}</td>
                <td class="text-right">${(item.taxableAmount!0)?string("0.00")}</td>
            </tr>
            </#list>
            <tr class="total-row">
                <td colspan="4" class="text-right">Total Estimated Value</td>
                <td class="text-right">${(invoice.totalTaxableAmount!0)?string("0.00")}</td>
            </tr>
        </tbody>
    </table>

    <div class="amount-words">
        <strong>Amount in Words:</strong> ${invoice.amountInWords!}
    </div>
    
    <div style="margin-top:20px; border:1px solid #ccc; padding:10px; border-radius:4px;">
        <strong>Declaration:</strong><br/>
        We hereby declare that the above goods are being sent for Job Work / Exhibition / Approval and not for sale.
    </div>

    <div class="footer row">
        <div class="col-half" style="text-align:right; width:100%;">
            <div class="sign-box">
                Authorized Signatory<br/>
                <span style="font-size:10px; font-weight:normal;">For ${fromOrg.organizationName!}</span>
            </div>
        </div>
    </div>

</body>
</html>
