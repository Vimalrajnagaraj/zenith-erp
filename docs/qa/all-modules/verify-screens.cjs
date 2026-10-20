// Read-only registered-screen sweep, with valid captured IDs where this fixture owns a record.
const fs=require('node:fs'),path=require('node:path'),openAudit=require('./client.cjs');
(async()=>{
 const x=await openAudit(),{a,admin,q,check,out,base}=x;
 const inventory=JSON.parse(fs.readFileSync(process.env.AUDIT_QA_ROUTES,'utf8')),visits=[],deferred=[];
 const one=(sql,key)=>{try{return q(sql)[0]?.[key];}catch{return null;}};
 const ids={productId:'AUDIT_QA_PRODUCT_A',facilityId:'AUDIT_QA_FAC_A',
  leadId:one("SELECT lead_id FROM lead WHERE organization_party_id='AUDIT_QA_A' ORDER BY lead_id",'lead_id'),
  segmentId:one("SELECT segment_id FROM customer_segment WHERE organization_party_id='AUDIT_QA_A' ORDER BY segment_id",'segment_id'),
  stockTransferId:one("SELECT stock_transfer_id FROM stock_transfer WHERE organization_party_id='AUDIT_QA_A' ORDER BY stock_transfer_id",'stock_transfer_id'),
  stockAdjustmentId:one("SELECT stock_adjustment_id FROM stock_adjustment WHERE organization_party_id='AUDIT_QA_A' ORDER BY stock_adjustment_id",'stock_adjustment_id'),
  subscriptionId:one("SELECT subscription_id FROM zenith_subscription WHERE organization_party_id='AUDIT_QA_A' ORDER BY subscription_id",'subscription_id')};
 const pages={};
 try{
  for(const actor of [a,admin]){const p=await actor.ctx.newPage();pages[actor===a?'tenant':'platform']=p;p.setDefaultTimeout(15000);}
  for(const screen of inventory.screens){
   const module=screen.route.split('/')[2];
   if(screen.required.some(key=>!ids[key])){deferred.push({route:screen.route,reason:'Record is created and exercised by its dedicated module suite',required:screen.required});continue;}
   for(const shell of ['apps','qapps']){
    const p=pages[module==='saas-admin'?'platform':'tenant'];const params=new URLSearchParams(Object.fromEntries(screen.required.map(k=>[k,ids[k]])));
    if(screen.route.endsWith('PrintGatePass')){const id=one("SELECT gate_pass_id FROM gate_pass WHERE organization_party_id='AUDIT_QA_A' ORDER BY gate_pass_id",'gate_pass_id');if(id)params.set('gatePassId',id);}
    const url=base+'/'+shell+screen.route+(params.size?'?'+params:'');
    const visit={route:screen.route,shell,module,viewports:[],pageErrors:[]};
    const onError=e=>visit.pageErrors.push(e.message);p.on('pageerror',onError);
    try{
     const started=Date.now(),r=await p.goto(url,{waitUntil:'networkidle',timeout:60000});visit.loadMs=Date.now()-started;visit.status=r?.status();visit.actualPath=new URL(p.url()).pathname;
     const text=await p.locator('body').innerText();
     check(shell+' '+screen.route+' renders without an exception',r?.status()===200&&!/Template Error|Error rendering screen|Exception running actions|Internal Server Error|Could not find subscreen|<#assign/.test(text),{status:visit.status,path:visit.actualPath});
     if(!visit.actualPath.startsWith('/'+shell+'/zenith/'+module)&&module!=='Dashboard')visit.redirected=true;
     for(const width of [1366,390]){
      await p.setViewportSize({width,height:900});await p.waitForTimeout(200);
      const dimensions=await p.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));visit.viewports.push(dimensions);
      check(shell+' '+screen.route+' fits viewport '+width,dimensions.scroll<=dimensions.width+2,dimensions);
      if(dimensions.scroll>dimensions.width+2){
       visit.overflow=await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'&&!e.closest('.table-responsive,.q-table__middle')}).slice(0,12).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})));
       await p.screenshot({path:path.join(out,module+'-'+path.basename(screen.route)+'-'+shell+'-'+width+'.png'),fullPage:true});
      }
     }
     check(shell+' '+screen.route+' has no browser exception',visit.pageErrors.length===0,{errors:visit.pageErrors});
    }catch(error){visit.error=error.message;check(shell+' '+screen.route+' visit completes',false,{error:error.message});}
    finally{p.off('pageerror',onError);visits.push(visit);fs.writeFileSync(path.join(out,'screen-visits.json'),JSON.stringify({productionAccess:false,visits,deferred},null,2));}
   }
  }
 }finally{await x.finish('screens.json');}
})().catch(error=>{console.error(error);process.exitCode=1;});
