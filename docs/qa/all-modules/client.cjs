// Test-only client for the fixed loopback memory JVM; SQL is SELECT-only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright');
module.exports=async function openAudit(){
 const base='http://127.0.0.1:18083',root=process.env.AUDIT_QA_RUNTIME,java=process.env.AUDIT_QA_JAVA,out=process.env.AUDIT_QA_OUT;
 assert(root&&java&&out);fs.mkdirSync(out,{recursive:true});const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});
 cp.execFileSync(path.join(path.dirname(java),'javac.exe'),['-d',classes,path.join(__dirname,'../sales-runtime/SalesDbProbe.java')],{windowsHide:true});
 const q=sql=>{assert.match(sql,/^SELECT /i);return JSON.parse(cp.execFileSync(java,['-cp',classes+path.delimiter+path.join(root,'WEB-INF/lib/h2-2.4.240.jar'),'SalesDbProbe'],{input:sql,encoding:'utf8',windowsHide:true,env:{...process.env,SALES_QA_DB_URL:'jdbc:h2:tcp://127.0.0.1:19095/mem:sales-qa-sop;IFEXISTS=TRUE'}}));};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),contexts=[],checks=[];
 const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
 const check=(name,passed,evidence={})=>{checks.push({name,passed:!!passed,evidence});console.log((passed?'PASS ':'FAIL ')+name);};
 const helper='Crm/AllModulesQa';
 async function actor(username){
  const ctx=await browser.newContext({viewport:{width:1366,height:900}});contexts.push(ctx);
  const r=await ctx.request.get(base+'/apps/zenith/'+helper,{headers:{Authorization:'Basic '+Buffer.from(username+':moqui').toString('base64')}});
  const token=(await r.text()).match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)?.[1];assert(token,'Authenticated helper token');
  const post=(route,form,csrf=true)=>ctx.request.post(base+'/apps/zenith/'+route,{form:{...(csrf?{moquiSessionToken:token}:{}),...form},maxRedirects:0});
  const invoke=async(op,input={})=>{const response=await post(helper+'/invoke',{op,input:JSON.stringify(input)});let data;try{data=await response.json();}catch{data={errors:['Non-JSON response']};}return {...data,httpStatus:response.status(),errors:[...(data.errors||[]),...(data.validation||[])]};};
  const scope=org=>post(helper+'/scope',{organizationPartyId:org});
  return {ctx,token,post,invoke,scope};
 }
 const admin=await actor('john.doe');
 if(!Number(q("SELECT count(*) n FROM party WHERE party_id='AUDIT_QA_A'")[0].n)){
  const r=await admin.post(helper+'/initialize',{});assert((await r.json()).initialized,'Fresh fixture required');
 }
 const a=await actor('audit.qa'),b=await actor('audit.b.qa');
 async function finish(filename='verification.json'){
  for(const ctx of contexts)await ctx.close();await browser.close();
  const result={productionAccess:false,checks,failures:checks.filter(c=>!c.passed)};
  fs.writeFileSync(path.join(out,filename),JSON.stringify(result,null,2));
  console.log(JSON.stringify({checks:checks.length,failures:result.failures.length}));if(result.failures.length)process.exitCode=1;
 }
 return {base,root,out,q,quote,check,browser,actor,a,b,admin,finish};
};
