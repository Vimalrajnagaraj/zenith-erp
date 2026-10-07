// PR #23 follow-ups: only the already initialized disposable QA runtime.
const fs=require('fs'),path=require('path'),cp=require('child_process');
module.exports=async function({ctx,p,post,invoke,q,rows,inv,count,check,base,out,report}) {
 const init=await post('SalesQaAcceptance','postMergeFixtures');
 check('Post-merge fixtures initialize once',(await init.json()).initialized===true,{});
 const legacyBefore=JSON.stringify(rows('invoice',"invoice_id LIKE 'SALES_QA_PM_LEGACY_%'"));
 const created=await post('CreateInvoice','createInvoice',{toPartyId:'SALES_QA_PM_CUSTOMER',invoiceDate:'1999-01-15 12:00:00',gstInvoiceNumber:'SALES_QA_PM_REPORT'});
 const id=new URL(created.headers().location,base).searchParams.get('invoiceId');
 check('Post-merge reporting invoice created',!!id&&!!inv(id),{id});report.created.push({type:'post-merge reporting invoice',id});
 await post('EditInvoice','addItem',{invoiceId:id,quantity:'1',amount:'100.30',taxPercentage:'18',description:'Disposable GST reconciliation'});
 check('Post-merge writer stores tax-inclusive totals',Number(inv(id).invoice_total)===118.36&&Number(inv(id).unpaid_total)===118&&Number(inv(id).total_taxable_amount)===100.30,inv(id));
 await post('EditInvoice','updateInvoice',{invoiceId:id,statusId:'InvoiceFinalized'});
 for(const shell of ['apps','qapps'])for(const screen of ['Invoices?invoiceId='+id,'AgingReport']){
  const r=await p.goto(`${base}/${shell}/zenith/Accounting/${screen}`,{waitUntil:'networkidle'}),text=await p.locator('body').innerText();
  check('Post-merge '+shell+' accounting '+screen+' renders correct gross balance',r.status()===200&&!/Error rendering|Template Error|ScreenRenderException/.test(text)&&text.includes('Disposable Reporting Customer')&&/118\.00/.test(text),{status:r.status()});
 }
 const gst=await invoke('gstr3b',{organizationPartyId:'SALES_QA_A',returnPeriod:'011999'});
 check('Post-merge GSTR-3B charged tax reconciles new plus legacy, excludes foreign',Number(gst.table31.taxableValue)===2100.30&&Number(gst.table31.cgst)===99.03&&Number(gst.table31.sgst)===99.03&&Number(gst.table31.igst)===0,gst);
 const pdf=await ctx.request.get(`${base}/fop/apps/zenith/sales/InvoicePrint?invoiceId=${id}`),file=path.join(out,'postmerge-gst-invoice.pdf');
 check('Post-merge GST PDF renders',pdf.status()===200&&(await pdf.body()).subarray(0,5).toString()==='%PDF-',{status:pdf.status()});fs.writeFileSync(file,await pdf.body());
 const parsed=JSON.parse(cp.execFileSync(process.env.SALES_QA_PYTHON||'python3',[path.join(__dirname,'inspect-pdf.py'),file,'--text'],{encoding:'utf8',timeout:30000}));
 check('Post-merge PDF subtotal plus tax plus round-off equals printed total',/Subtotal.*100\.30/.test(parsed.text)&&/9\.03/.test(parsed.text)&&/Round-off.*-0\.36/.test(parsed.text)&&/Total Rs\. 118\.00/.test(parsed.text),parsed);
 const snapshot=JSON.stringify(inv(id));
 await post('EditInvoice','addItem',{invoiceId:id,quantity:'1',amount:'1',taxPercentage:'18'});
 check('Post-merge issued reporting invoice unchanged after denied edit',JSON.stringify(inv(id))===snapshot,{id});
 for(const note of report.created.filter(x=>['Credit Note','Debit Note'].includes(x.type))){
  // A nonzero adjustment makes rejection meaningful; zero balance alone must not explain it.
  await post('EditCreditNote','addItem',{invoiceId:note.id,quantity:'1',amount:'100',taxPercentage:'18'});
  const before=JSON.stringify(inv(note.id)),links=count('payment_link',`invoice_id='${note.id}'`);
  for(const op of ['link','upi'])await invoke(op,{invoiceId:note.id,upiId:'qa@example',merchantName:'Disposable QA'},true);
  check('Post-merge '+note.type+' creates no payment link and changes no invoice',count('payment_link',`invoice_id='${note.id}'`)===links&&JSON.stringify(inv(note.id))===before,{id:note.id});
 }
 const returned=report.created.find(x=>x.type==='SOP challan').id;
 for(const challanId of [returned,'SALES_QA_PM_RETURNED'])for(const shell of ['apps','qapps']){
  const snapshot=()=>JSON.stringify({h:rows('zenith_delivery_challan',`challan_id='${challanId}'`),i:rows('zenith_delivery_challan_item',`challan_id='${challanId}'`)}),before=snapshot();
  await post('EditDeliveryChallan','addItem',{challanId,productId:'SALES_QA_PROD_A',quantity:'1',estimatedValue:'100'},shell);
  await post('EditDeliveryChallan','deleteItem',{challanId,challanItemSeqId:'01'},shell);
  await post('EditDeliveryChallan','updateChallan',{challanId,statusId:'DcDraft'},shell);
  check('Post-merge '+shell+' returned challan and goods remain unchanged',snapshot()===before,{challanId});
  await p.goto(`${base}/${shell}/zenith/sales/EditDeliveryChallan?challanId=${challanId}`,{waitUntil:'networkidle'});
  check('Post-merge '+shell+' returned goods controls hidden',await p.getByText('Add Goods',{exact:true}).count()===0&&await p.locator('a[href*="deleteItem"]').count()===0,{challanId});
 }
 for(let i=0;i<3;i++){
  const c=await invoke('commission',{orderId:'SALES_QA_ORDER',partyId:'SALES_QA_PM_CUSTOMER'}),row=rows('commission_transaction',`commission_txn_id='${c.commissionTxnId}'`)[0];
  check('Post-merge equal-date commission choice is stable',row?.commission_id==='SALES_QA_PM_TIE_A'&&Number(c.commissionAmount)===50,{row,c});
 }
 const large=await invoke('invoice',{organizationPartyId:'SALES_QA_A',customerPartyId:'SALES_QA_CUST_A',items:JSON.stringify(Array.from({length:105},(_,i)=>({productId:'SALES_QA_PROD_A',quantity:1,unitAmount:i+1,itemDescription:'POSTMERGE-LINE-'+(i+1)})))});
 const lines=rows('invoice_item',`invoice_id='${large.invoiceId}'`);
 check('Post-merge 105 lines preserve tax attribution past string-sort boundary',lines.length===105&&lines.every(x=>Number(x.taxable_amount)===Number(x.amount)&&Math.abs(Number(x.cgst_amount)-Number(x.amount)*.09)<.000001&&Math.abs(Number(x.sgst_amount)-Number(x.amount)*.09)<.000001),{id:large.invoiceId,lines:lines.length});
 check('Post-merge large header independently sums line GST',Number(inv(large.invoiceId).total_cgst)===500.85&&Number(inv(large.invoiceId).total_sgst)===500.85&&Number(inv(large.invoiceId).invoice_total)===6566.70,inv(large.invoiceId));
 check('Post-merge forecast fixtures cover both issued statuses',count('invoice',"invoice_id LIKE 'SALES_QA_SOP_HISTORY_%' AND status_id='InvoiceFinalized'")>0&&count('invoice',"invoice_id LIKE 'SALES_QA_SOP_HISTORY_%' AND status_id='InvoicePmtRecvd'")>0,{});
 check('Post-merge historical gross and tax-off snapshots remain unchanged',JSON.stringify(rows('invoice',"invoice_id LIKE 'SALES_QA_PM_LEGACY_%'"))===legacyBefore,{});
 fs.writeFileSync(path.join(out,'postmerge-checks.json'),JSON.stringify(report.checks.filter(x=>x.name.startsWith('Post-merge')),null,2));
};
