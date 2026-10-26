module.exports=async({a,base,check,q,invoke,post})=>{
 const terminalId='POS_QA_A_STATE_ONLY';
 await post('PosTerminals','createTerminal',{terminalId,terminalName:'Disposable state-only tax counter',facilityId:'POS_QA_A_FAC',organizationPartyId:'POS_QA_A',stateCode:'33',isActive:'Y'});
 const session=await invoke('open',{terminalId,openingCash:'0'});
 let cart=await invoke('cart',{sessionId:session.sessionId});
 const page=await a.c.newPage();
 try{
  await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1',taxOn:'N'});
  await page.goto(`${base}/apps/zenith/pos/Terminal?sessionId=${session.sessionId}&transactionId=${cart.transactionId}&taxOn=N`,{waitUntil:'networkidle'});
  const first=await page.locator('#nb-clock').innerText();
  let ticked=true;try{await page.waitForFunction(value=>document.getElementById('nb-clock')?.textContent!==value,first,{timeout:3500})}catch{ticked=false}
  check('POS clock advances without a refresh',ticked,{first,current:await page.locator('#nb-clock').innerText()});
  const before=q(`SELECT origin_region_geo_id,destination_region_geo_id,customer_tax_reg_number FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0];
  check('state-only counter creates a walk-in cart with its configured supply state',before.origin_region_geo_id==='33'&&before.destination_region_geo_id==='33'&&!before.customer_tax_reg_number,before);
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  let bill=q(`SELECT total_tax_amount FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0];
  check('walk-in GST calculates without a customer GSTIN',Number(bill.total_tax_amount)===18,bill);
  const taxes=q(`SELECT tax_name,tax_amount FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${cart.transactionId}' ORDER BY tax_name`);
  check('walk-in local GST splits into CGST and SGST',taxes.length===2&&taxes.every(t=>Number(t.tax_amount)===9)&&taxes.map(t=>t.tax_name).join(',')==='CGST,SGST',taxes);
  await invoke('pay',{transactionId:cart.transactionId,paymentMethod:'Card',amount:'118'});
  await invoke('complete',{transactionId:cart.transactionId});
  check('walk-in GST bill completes and receipt retains its tax',Number((await invoke('receipt',{transactionId:cart.transactionId})).receipt.summary.tax)===18&&q(`SELECT status_id FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0].status_id==='PtCompleted');
  cart=await invoke('cart',{sessionId:session.sessionId});
  await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1',taxOn:'Y'});
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'N'});
  check('tax off removes tax without requiring a customer',Number(q(`SELECT total_tax_amount FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0].total_tax_amount)===0);
  await post('Terminal','setCustomer',{transactionId:cart.transactionId,customerPartyId:'POS_QA_A_CUST_SAME',taxOn:'N'});
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  bill=q(`SELECT customer_party_id,customer_tax_reg_number,total_tax_amount FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0];
  check('named unregistered customer also receives GST without an invented buyer GSTIN',bill.customer_party_id==='POS_QA_A_CUST_SAME'&&!bill.customer_tax_reg_number&&Number(bill.total_tax_amount)===18,bill);
  await invoke('pay',{transactionId:cart.transactionId,paymentMethod:'UPI',amount:'118'});
  await invoke('complete',{transactionId:cart.transactionId});
  check('unregistered named GST bill completes and receipt retains tax',Number((await invoke('receipt',{transactionId:cart.transactionId})).receipt.summary.tax)===18&&q(`SELECT status_id FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0].status_id==='PtCompleted');
 }finally{
  await page.close();
  if(q(`SELECT status_id FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0]?.status_id==='PtCreated')await invoke('void',{transactionId:cart.transactionId});
  await invoke('close',{sessionId:session.sessionId,closingCash:'0'});
 }
};
