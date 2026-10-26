// Billing-only regression. Requires the guarded disposable POS runtime and synthetic fixtures.
module.exports=async({a,foreign,base,check,q,invoke,post,out})=>{
 const terminalId='POS_QA_A_DISCOUNT_TAX';
 await post('PosTerminals','createTerminal',{terminalId,terminalName:'Disposable discount GST counter',facilityId:'POS_QA_A_FAC',organizationPartyId:'POS_QA_A',stateCode:'33',isActive:'Y'});
 const session=await invoke('open',{terminalId,openingCash:'0'});
 const cart=()=>invoke('cart',{sessionId:session.sessionId,reuseOpenCart:'false'});
 const bill=id=>q(`SELECT * FROM pos_transaction WHERE transaction_id='${id}'`)[0];
 const lines=id=>q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}' ORDER BY item_seq_id`);
 const taxes=id=>q(`SELECT * FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${id}' ORDER BY reference_seq_id,tax_name`);
 const taxSum=id=>taxes(id).reduce((sum,row)=>sum+Number(row.tax_amount),0);
 const near=(a,b)=>Math.abs(Number(a)-b)<0.0001;
 const add=(id,productId='POS_QA_A_P18',extra={})=>invoke('add',{transactionId:id,productId,quantity:'1',taxOn:'Y',...extra});
 const discount=async(id,extra={},actor=a,shell='apps')=>{
  const r=await post('Terminal','ajaxCart',{action:'applyDiscount',sessionId:session.sessionId,transactionId:id,billDiscType:'pct',billDiscValue:'10',taxOn:'Y',...extra},actor,true,shell);
  return{status:r.status(),body:r.status()===403?{success:false}:await r.json()};
 };
 let current;const page=await a.c.newPage();
 try{
  current=await cart();await add(current.transactionId);await add(current.transactionId,'POS_QA_A_P5');
  await page.goto(`${base}/apps/zenith/pos/Terminal?sessionId=${session.sessionId}&transactionId=${current.transactionId}&taxOn=Y`,{waitUntil:'networkidle'});
  await page.locator('#pos-discount').click();await page.locator('#pd-bill').fill('10');
  const applied=page.waitForResponse(r=>r.url().includes('/ajaxCart')&&new URLSearchParams(r.request().postData()||'').get('action')==='applyDiscount');
  await page.locator('#pd-apply').click();const reply=await (await applied).json();
  check('discount UI accepts a mixed-GST ten-percent bill discount',reply.success,reply);
  check('discounted GST detail sum agrees with the bill and both line totals',near(bill(current.transactionId).total_tax_amount,25.2)&&near(taxSum(current.transactionId),25.2)&&near(lines(current.transactionId).reduce((sum,l)=>sum+Number(l.total_tax_amount),0),25.2),{billTax:bill(current.transactionId).total_tax_amount,detailTax:taxSum(current.transactionId),details:taxes(current.transactionId)});
  check('discount preserves quantity and stored unit rates',lines(current.transactionId).every(l=>Number(l.quantity)===1)&&lines(current.transactionId).map(l=>Number(l.unit_price)).join(',')==='100,200');
  check('local GST keeps the correct discounted taxable bases and CGST/SGST split',taxes(current.transactionId).length===4&&taxes(current.transactionId).every(t=>near(t.taxable_amount,t.reference_seq_id==='00001'?90:180))&&taxes(current.transactionId).map(t=>Number(t.tax_amount)).join(',')==='8.1,8.1,4.5,4.5');
  if(out)await page.screenshot({path:require('node:path').join(out,'discount-gst-corrected.png'),fullPage:true});
  let retry=await discount(current.transactionId);check('reapplying discount replaces tax details without duplicates',retry.body.success&&taxes(current.transactionId).length===4&&near(taxSum(current.transactionId),25.2));
  retry=await discount(current.transactionId,{},a,'qapps');check('Quasar discount endpoint uses the same authoritative tax calculation',retry.body.success&&taxes(current.transactionId).length===4&&near(taxSum(current.transactionId),25.2));
  await discount(current.transactionId,{billDiscValue:'100'});check('fully discounted draft retains no phantom GST amount',near(bill(current.transactionId).payable_amount,0)&&near(bill(current.transactionId).total_tax_amount,0)&&near(taxSum(current.transactionId),0));
  await discount(current.transactionId,{billDiscValue:'0'});check('clearing discount restores original tax exactly once',near(taxSum(current.transactionId),28)&&near(bill(current.transactionId).total_tax_amount,28)&&taxes(current.transactionId).length===4);
  await discount(current.transactionId);await invoke('pay',{transactionId:current.transactionId,paymentMethod:'Card',amount:'295'});await invoke('complete',{transactionId:current.transactionId});
  const receipt=await invoke('receipt',{transactionId:current.transactionId});check('discounted receipt retains corrected GST after checkout',near(receipt.receipt.summary.tax,25.2));
  const synced=await invoke('sync',{transactionId:current.transactionId});
  const invoice=q(`SELECT total_tax_amount FROM invoice WHERE invoice_id='${synced.invoiceId}'`)[0];
  const invoiceTax=q(`SELECT sum(tax_amount) AS n FROM tax_line_detail WHERE reference_type='InvoiceItem' AND reference_id='${synced.invoiceId}'`)[0];
  check('linked invoice and invoice tax details agree with discounted POS bill',near(invoice.total_tax_amount,25.2)&&near(invoiceTax.n,25.2),{invoice,invoiceTax});
  const issuedBefore=JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)]);
  const issued=await discount(current.transactionId);check('issued bill cannot be discounted through the draft endpoint',!issued.body.success&&JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)])===issuedBefore);
  current=await cart();await post('Terminal','setCustomer',{transactionId:current.transactionId,sessionId:session.sessionId,customerPartyId:'POS_QA_A_CUST_INTER'});await add(current.transactionId);
  await discount(current.transactionId);check('interstate discount stores IGST on discounted taxable amount',taxes(current.transactionId).length===1&&taxes(current.transactionId)[0].tax_name==='IGST'&&near(taxSum(current.transactionId),16.2)&&near(taxes(current.transactionId)[0].taxable_amount,90));await invoke('void',{transactionId:current.transactionId});
  current=await cart();await add(current.transactionId,undefined,{unitPrice:'75.50',quantity:'2'});const line=lines(current.transactionId)[0];
  await discount(current.transactionId,{billDiscValue:'0',lineDiscounts:JSON.stringify({[line.item_seq_id]:{t:'amt',v:'10'}})});
  check('fixed-amount line discount preserves decimal manual price and exact GST',near(lines(current.transactionId)[0].unit_price,75.5)&&near(bill(current.transactionId).subtotal,141)&&near(taxSum(current.transactionId),25.38));
  await discount(current.transactionId,{taxOn:'N'});check('tax-off discount clears persisted GST details',near(bill(current.transactionId).total_tax_amount,0)&&taxes(current.transactionId).length===0);await invoke('void',{transactionId:current.transactionId});
  await post('SalesMode','createMode',{modeName:'Disposable inclusive discount',modeCode:'QADTX',priceSource:'PpsFixedProduct',isTaxInclusive:'Y',requireCustomer:'N'});
  const mode=q("SELECT sales_mode_id FROM pos_sales_mode WHERE organization_party_id='POS_QA_A' AND mode_code='QADTX'")[0].sales_mode_id;
  await invoke('price',{productId:'POS_QA_A_P18',salesModeId:mode,price:'118'});
  current=await cart();await add(current.transactionId,undefined,{salesModeId:mode});await discount(current.transactionId);
  check('inclusive mode discount extracts GST from the discounted gross price',near(bill(current.transactionId).subtotal,90)&&near(bill(current.transactionId).total_tax_amount,16.2)&&near(bill(current.transactionId).grand_total,106.2)&&near(taxSum(current.transactionId),16.2)&&lines(current.transactionId)[0].sales_mode_id===mode,{bill:bill(current.transactionId),taxes:taxes(current.transactionId)});await invoke('void',{transactionId:current.transactionId});
  current=await invoke('cart',{sessionId:session.sessionId,reuseOpenCart:'false',destinationRegionGeoId:'INVALID_DEST'});await add(current.transactionId,undefined,{taxOn:'N'});
  const off=await discount(current.transactionId,{taxOn:'N'});check('tax-off discount requires no valid GST destination',off.body.success&&near(bill(current.transactionId).payable_amount,90)&&taxes(current.transactionId).length===0);
  const invalidBefore=JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)]);
  const invalid=await discount(current.transactionId,{taxOn:'Y',billDiscValue:'20'});
  check('failed GST recalculation rolls back the whole discount',!invalid.body.success&&JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)])===invalidBefore);
  if(foreign){const before=JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)]);const denied=await discount(current.transactionId,{},foreign);check('foreign operator cannot discount this bill',!denied.body.success&&JSON.stringify([bill(current.transactionId),lines(current.transactionId),taxes(current.transactionId)])===before);}
  const noToken=await post('Terminal','ajaxCart',{action:'applyDiscount',sessionId:session.sessionId,transactionId:current.transactionId,billDiscValue:'10'},a,false);check('discount requires CSRF token',[401,403].includes(noToken.status()));
 }finally{
  await page.close();if(current&&bill(current.transactionId)?.status_id==='PtCreated')await invoke('void',{transactionId:current.transactionId});await invoke('close',{sessionId:session.sessionId,closingCash:'0'});
 }
};
