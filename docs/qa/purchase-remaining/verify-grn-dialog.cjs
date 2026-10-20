// Real GRN submit controls, disposable PurchaseRemaining fixture only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{chromium}=require('playwright');
const base='http://127.0.0.1:18085',root=process.env.PURCHASE_QA_RUNTIME,java=process.env.PURCHASE_QA_JAVA,out=process.env.PURCHASE_QA_OUT;
assert(root&&java&&out,'Configure disposable Purchase runtime');fs.mkdirSync(out,{recursive:true});const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});
cp.execFileSync(path.join(path.dirname(java),'javac.exe'),['-d',classes,path.join(__dirname,'PurchaseRemainingDbProbe.java')],{windowsHide:true});
function q(sql){return JSON.parse(cp.execFileSync(java,['-cp',path.join(root,'WEB-INF/lib/h2-2.4.240.jar')+path.delimiter+classes,'PurchaseRemainingDbProbe'],{input:sql,encoding:'utf8',windowsHide:true}));}
const results=[];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const admin=await browser.newContext();await admin.request.get(base+'/apps/zenith/Purchase/GoodsReceipt',{headers:{Authorization:'Basic '+Buffer.from('john.doe:moqui').toString('base64')}});
  if(!q("SELECT party_id FROM party WHERE party_id='PP_QA_A'").length){const ap=await admin.newPage();await ap.goto(base+'/apps/zenith/Purchase/GoodsReceipt',{waitUntil:'domcontentloaded'});const token=await ap.locator('[name=moquiSessionToken]').first().inputValue();const init=await admin.request.post(base+'/apps/zenith/pricing/PurchaseRemainingQaAcceptance/initialize',{form:{moquiSessionToken:token}});assert((await init.json()).initialized);}
  await admin.close();
  for(const shell of ['apps','qapps']){
   const ctx=await browser.newContext({viewport:{width:1366,height:900}});await ctx.request.get(base+'/apps/zenith/Purchase/GoodsReceipt',{headers:{Authorization:'Basic '+Buffer.from('purchase.pricing.qa:moqui').toString('base64')}});const page=await ctx.newPage();
   try{
    await page.goto(`${base}/${shell}/zenith/Purchase/GoodsReceipt`,{waitUntil:'networkidle',timeout:90000});
    if(shell==='apps')await page.locator('#CreateGrnDialog-button').click();else await page.getByRole('button',{name:'+ New GRN',exact:true}).click();
    const dialog=page.locator('#CreateGrnDialog');await dialog.locator('[name=receiptDate]').fill('2026-10-20');await dialog.locator('[name=freightAmount]').fill('50');await dialog.locator('[name=insuranceAmount]').fill('0');await dialog.locator('[name=customsDutyAmount]').fill('0');
    const before=q('SELECT grn_id FROM goods_receipt_note').map(r=>r.grn_id);
    const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/createGrn'));
    await dialog.locator('[type=submit]').click();const response=await pending;
    const created=q('SELECT grn_id,purchase_order_id,vendor_party_id,receipt_date,freight_amount FROM goods_receipt_note').filter(r=>!before.includes(r.grn_id));
    const parameters=new URLSearchParams(response.request().postData()||'');
    const posted=Object.fromEntries(['purchaseOrderId','receiptDate','freightAmount','insuranceAmount','customsDutyAmount'].map(key=>[key,parameters.get(key)]));
    const evidence={shell,status:response.status(),posted,created};
    if(response.status()>=400)evidence.error=(await response.text()).slice(0,900);
    results.push(evidence);assert.equal(response.status()<400,true,shell+' actual submit must not fail');assert.equal(created.length,1,shell+' actual submit must persist exactly one GRN');assert.equal(created[0].purchase_order_id,'PP_QA_PO_A');assert.equal(Number(created[0].freight_amount),50);
    await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(out,shell+'-grn-created.png'),fullPage:true});
   }finally{await ctx.close();}
  }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'grn-dialog.json'),JSON.stringify(results,null,2));}
 console.log('PASS real GRN submission and independent persistence on both surfaces');
})().catch(e=>{console.error(e);process.exitCode=1;});
