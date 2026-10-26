// Synthetic fixture only. A terminal's editable GST state must beat an obsolete Geo ID.
module.exports=async({a,base,check,q,invoke,post,out})=>{
 const terminalId='POS_QA_A_LEGACY_GEO';
 await post('PosTerminals','createTerminal',{terminalId,terminalName:'Disposable legacy-region counter',facilityId:'POS_QA_A_FAC',organizationPartyId:'POS_QA_A',stateCode:'33',regionGeoId:'LEGACY_GEO_TN',isActive:'Y'});
 const session=await invoke('open',{terminalId,openingCash:'0'});
 let cart;
 const bill=()=>q(`SELECT origin_region_geo_id,destination_region_geo_id,total_tax_amount FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0];
 try{
  cart=await invoke('cart',{sessionId:session.sessionId});
  check('editable terminal GST state takes priority over an obsolete Geo ID',bill().origin_region_geo_id==='33'&&bill().destination_region_geo_id==='33',bill());
  const catalog=await invoke('catalog',{terminalId});
  check('offline catalog uses the same configured GST state',Number(catalog.products.find(x=>x.productId==='POS_QA_A_P18')?.taxRate)===18);
  await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1',taxOn:'N'});
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  check('legacy-region counter enables walk-in GST without a buyer GSTIN',Number(bill().total_tax_amount)===18,bill());
  const lines=q(`SELECT tax_name,tax_amount FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${cart.transactionId}' ORDER BY tax_name`);
  check('corrected walk-in GST is exactly CGST 9 plus SGST 9',lines.length===2&&lines.map(x=>x.tax_name).join(',')==='CGST,SGST'&&lines.every(x=>Number(x.tax_amount)===9),lines);
  const page=await a.c.newPage();
  try{
   for(const shell of ['apps','qapps']){
    await page.goto(`${base}/${shell}/zenith/pos/Terminal?sessionId=${session.sessionId}&transactionId=${cart.transactionId}&taxOn=Y`,{waitUntil:'domcontentloaded'});
    await page.locator('.nb-tax__lbl').waitFor({state:'visible'});
    check(shell+' entry renders corrected GST in the billing terminal',await page.locator('.nb-tax__lbl').innerText()==='Tax: On'&&await page.locator('#posModeSwitchErr').count()===0);
    if(out)await page.screenshot({path:require('path').join(out,shell+'-gst-state.png'),fullPage:true});
   }
  }finally{await page.close()}
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'N'});
  check('switching GST off clears tax again',Number(bill().total_tax_amount)===0,bill());
  await post('PosQaAcceptance','legacyCartStates',{transactionId:cart.transactionId,legacyRegion:'Y'});
  check('legacy cart fixture contains its obsolete inherited regions',bill().origin_region_geo_id==='LEGACY_GEO_TN'&&bill().destination_region_geo_id==='LEGACY_GEO_TN',bill());
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  check('GST repairs only the obsolete inherited local destination',bill().origin_region_geo_id==='33'&&bill().destination_region_geo_id==='33'&&Number(bill().total_tax_amount)===18,bill());
  await invoke('void',{transactionId:cart.transactionId});
  cart=await invoke('cart',{sessionId:session.sessionId});
  await post('Terminal','setCustomer',{transactionId:cart.transactionId,sessionId:session.sessionId,customerPartyId:'POS_QA_A_CUST_INTER'});
  check('explicit interstate customer destination remains distinct',bill().destination_region_geo_id==='27',bill());
  await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1',taxOn:'N'});
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  check('interstate GST preserves the customer destination',bill().origin_region_geo_id==='33'&&bill().destination_region_geo_id==='27'&&Number(bill().total_tax_amount)===18,bill());
  const interstate=q(`SELECT tax_name,tax_amount FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${cart.transactionId}'`);
  check('interstate GST remains one IGST line',interstate.length===1&&interstate[0].tax_name==='IGST'&&Number(interstate[0].tax_amount)===18,interstate);
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'N'});
  await post('PosQaAcceptance','legacyCartStates',{transactionId:cart.transactionId,legacyRegion:'Y',interstate:'Y'});
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  check('repairing a legacy origin never replaces an explicit interstate destination',bill().origin_region_geo_id==='33'&&bill().destination_region_geo_id==='27'&&Number(bill().total_tax_amount)===18,bill());
  await invoke('void',{transactionId:cart.transactionId});
  cart=await invoke('cart',{sessionId:session.sessionId,destinationRegionGeoId:'INVALID_DEST'});
  await invoke('add',{transactionId:cart.transactionId,productId:'POS_QA_A_P18',quantity:'1',taxOn:'N'});
  const invalidBefore=JSON.stringify(bill());
  await post('Terminal','toggleTax',{transactionId:cart.transactionId,sessionId:session.sessionId,taxOn:'Y'});
  check('explicit invalid destination is rejected without replacing or taxing it',JSON.stringify(bill())===invalidBefore,bill());
  check('rejected GST switch creates no tax details',Number(q(`SELECT count(*) AS n FROM tax_line_detail WHERE reference_type='PosTransactionItem' AND reference_id='${cart.transactionId}'`)[0].n)===0);
 }finally{
  if(cart&&q(`SELECT status_id FROM pos_transaction WHERE transaction_id='${cart.transactionId}'`)[0]?.status_id==='PtCreated')await invoke('void',{transactionId:cart.transactionId});
  await invoke('close',{sessionId:session.sessionId,closingCash:'0'});
 }
};
