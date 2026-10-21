// Real header geometry, including an unselected organization; memory fixtures only.
const fs=require('node:fs'),path=require('node:path'),openAudit=require('./client.cjs');
(async()=>{const x=await openAudit(),{admin,a,check,base,out}=x;try{
 const p=await admin.ctx.newPage();
 await admin.scope('_NA_');
 for(const shell of ['apps','qapps'])for(const width of [320,390,800,1366]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/'+shell+'/zenith/Crm/Leads',{waitUntil:'networkidle'});await p.waitForTimeout(400);
  const title=p.getByText('Lead directory',{exact:true}),notice=p.getByText('Select an organization to create or view leads.',{exact:true});
  const r=await title.boundingBox(),n=await notice.boundingBox();
  const overlap=r&&n&&r.x<n.x+n.width&&r.x+r.width>n.x&&r.y<n.y+n.height&&r.y+r.height>n.y;
  check(shell+' '+width+' empty-organization notice does not overlap directory title',r&&n&&!overlap,{title:r,notice:n});
  await p.screenshot({path:path.join(out,shell+'-'+width+'-'+(process.env.AUDIT_QA_MODE||'baseline')+'.png'),fullPage:true});
  if(overlap){fs.writeFileSync(path.join(out,shell+'-'+width+'-heading.html'),await title.evaluate(e=>e.parentElement.outerHTML));await p.screenshot({path:path.join(out,shell+'-'+width+'.png'),fullPage:true});}
 }
 const own=await a.ctx.newPage();for(const shell of ['apps','qapps']){
  await own.setViewportSize({width:390,height:900});await own.goto(base+'/'+shell+'/zenith/Crm/Leads',{waitUntil:'networkidle'});await own.waitForTimeout(400);
  check(shell+' authorized New Lead remains reachable',await own.getByRole('button',{name:/New Lead/}).isVisible());
  await own.screenshot({path:path.join(out,shell+'-authorized-390.png'),fullPage:true});
 }
 }catch(e){check('CRM layout verifier completes',false,{error:e.stack});}finally{await x.finish('crm-layout-'+(process.env.AUDIT_QA_MODE||'baseline')+'.json')}})().catch(e=>{console.error(e);process.exitCode=1});
