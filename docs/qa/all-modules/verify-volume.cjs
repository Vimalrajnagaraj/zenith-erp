const fs=require('node:fs'),path=require('node:path'),openAudit=require('./client.cjs');
(async()=>{
 const x=await openAudit(),{admin,a,q,base,check,out}=x,measurements=[];
 try{
  const before=JSON.stringify(q('SELECT invoice_id,invoice_total,status_id FROM invoice ORDER BY invoice_id'));
  const response=await admin.ctx.request.post(base+'/apps/zenith/Crm/AllModulesQa/loadVolume',{form:{moquiSessionToken:admin.token},timeout:180000});
  const data=await response.json();check('Disposable volume load completes',response.status()===200&&data.loaded,{businessRecords:data.businessRecords});
  for(const [table,field,prefix,total] of [['product','product_id','AUDIT_VOL_P',1500],['party','party_id','AUDIT_VOL_C',200],['lead','lead_id','AUDIT_VOL_L',300]])check('Independent SQL confirms volume '+table,Number(q(`SELECT count(*) n FROM ${table} WHERE ${field} LIKE '${prefix}%'`)[0].n)===total);
  const page=await a.ctx.newPage();
  for(const shell of ['apps','qapps']){
   for(const route of ['Inventory/FindProduct','Contacts/FindContact','Crm/Leads','Crm/Dashboard?period=all','Inventory/InventoryDashboard','Dashboard']){
    const target=base+'/'+shell+'/zenith/'+route;
    // One warm-up excludes first-use Moqui compilation; retain measured times without asserting production speed.
    await a.ctx.request.get(target);
    const samples=[];
    for(let i=0;i<3;i++){const start=Date.now();const r=await a.ctx.request.get(target);await r.body();samples.push(Date.now()-start);check(shell+' volume '+route+' read '+i,r.status()===200);}
    measurements.push({shell,route,samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[1]});
   }
   await page.goto(base+'/'+shell+'/zenith/Crm/Dashboard?period=all',{waitUntil:'networkidle'});
   const expected=Number(q("SELECT count(*) n FROM lead WHERE organization_party_id='AUDIT_QA_A'")[0].n);
   check(shell+' CRM chart/KPI counts match owned database rows after volume load',Number((await page.locator('.zcrm-metric h4').first().innerText()).replaceAll(',',''))===expected,{expected});
   await page.goto(base+'/'+shell+'/zenith/Inventory/FindProduct?catalogSearch=1499',{waitUntil:'networkidle'});
   check(shell+' catalogue server search reaches late owned volume product',(await page.locator('#productCatalog').innerText()).includes('Disposable volume product 1499'));
   await page.goto(base+'/'+shell+'/zenith/Inventory/FindProduct?catalogSearch=1495&organizationPartyId=AUDIT_QA_B',{waitUntil:'networkidle'});
   check(shell+' forged volume search cannot disclose a foreign product',!(await page.locator('#productCatalog').innerText()).includes('Disposable volume product 1495'));
   await page.goto(base+'/'+shell+'/zenith/Crm/Leads?firstName=Disposable%20volume%20lead%20299&firstName_op=equals',{waitUntil:'networkidle'});
   check(shell+' lead server filter reaches a late owned volume lead',(await page.locator('.zcrm-page').innerText()).includes('Disposable volume lead 299'));
   for(const width of [1366,390]){await page.setViewportSize({width,height:900});check(shell+' volume lead directory fits '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}
   await page.screenshot({path:path.join(out,shell+'-volume-leads.png'),fullPage:true});
  }
  check('Volume data and reads leave financial invoices unchanged',JSON.stringify(q('SELECT invoice_id,invoice_total,status_id FROM invoice ORDER BY invoice_id'))===before);
 }catch(error){check('Volume verification completes',false,{error:error.stack});}
 finally{fs.writeFileSync(path.join(out,'timings.json'),JSON.stringify({environment:'local public Moqui framework, in-memory H2, warm requests; not a production benchmark',measurements},null,2));await x.finish('volume.json');}
})().catch(e=>{console.error(e);process.exitCode=1;});
