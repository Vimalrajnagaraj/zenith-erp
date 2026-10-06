// Disposable local/CI acceptance only. Fixture accounts reuse fresh demo login material in DB.
const fs=require('fs'),path=require('path'),cp=require('child_process'),zlib=require('zlib');
const base=(process.env.CONTACTS_QA_BASE_URL||'').replace(/\/$/,'');
const url=new URL(base);
if(!['localhost','127.0.0.1'].includes(url.hostname)||!['18082','8080'].includes(url.port)||url.protocol!=='http:')throw Error('Only isolated loopback QA ports 18082/8080 are allowed');
const mode=process.env.CONTACTS_QA_DB_MODE||'native',out=process.env.CONTACTS_QA_OUTPUT_DIR;
const password=process.env.CONTACTS_QA_PASSWORD;
if(!out||!password)throw Error('Output directory and fresh demo QA password environment are required');
fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),source:'actual Moqui runtime',checks:[],reproduction:[],viewports:[],productionAccess:false};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
function query(sql,bootstrap=false){
 if(mode==='postgres'){
  const container=process.env.CONTACTS_QA_DB_CONTAINER;if(!container)throw Error('CI database container is required');
  const cmd=bootstrap?sql:'SELECT COALESCE(json_agg(row_to_json(q)),\'[]\'::json)::text FROM ('+sql+') q;';
  const output=cp.execFileSync('docker',['exec','-i',container,'psql','-U','moqui','-d','moqui','-A','-t','-v','ON_ERROR_STOP=1'],{input:cmd,encoding:'utf8',timeout:30000});
  return bootstrap?[]:JSON.parse(output.trim());
 }
 const java=process.env.CONTACTS_QA_JAVA,jar=process.env.CONTACTS_QA_H2_JAR;
 if(!java||!jar||!process.env.CONTACTS_QA_DB_URL)throw Error('Native Java, H2 JAR and existing database URL environment are required');
 const output=cp.execFileSync(java,['--class-path',jar,path.join(__dirname,'ContactSecurityDbProbe.java'),...(bootstrap?['bootstrap']:[])],{input:sql,encoding:'utf8',timeout:30000,windowsHide:true});return JSON.parse(output.trim());
}
const fixtures=query("SELECT party_id,owner_party_id FROM party WHERE party_id IN ('CITEST_P14_A_01','CITEST_P14_B_01','CITEST_P14_GLOBAL') ORDER BY party_id");
check('Disposable tenant/global fixtures exist before any action',fixtures.length===3&&fixtures.find(x=>x.party_id==='CITEST_P14_A_01').owner_party_id==='CITEST_ORG_A'&&fixtures.find(x=>x.party_id==='CITEST_P14_B_01').owner_party_id==='CITEST_ORG_B'&&fixtures.find(x=>x.party_id==='CITEST_P14_GLOBAL').owner_party_id==='_NA_',fixtures);
const fixtureAccounts=query("SELECT user_id FROM user_account WHERE user_id IN ('CITEST_P14_USER_A','CITEST_P14_USER_NULL','CITEST_P14_USER_EMPTY','CITEST_P14_USER_NA') ORDER BY user_id");
check('All four captured test accounts exist',fixtureAccounts.length===4);
check('Tenant test accounts have no platform ADMIN bypass',query("SELECT user_id FROM user_group_member WHERE user_group_id='ADMIN' AND user_id IN ('CITEST_P14_USER_A','CITEST_P14_USER_NULL','CITEST_P14_USER_EMPTY','CITEST_P14_USER_NA')").length===0);
query("UPDATE user_account SET current_password=(SELECT current_password FROM user_account WHERE user_id='EX_JOHN_DOE'),password_salt=(SELECT password_salt FROM user_account WHERE user_id='EX_JOHN_DOE'),password_hash_type=(SELECT password_hash_type FROM user_account WHERE user_id='EX_JOHN_DOE'),password_base64=(SELECT password_base64 FROM user_account WHERE user_id='EX_JOHN_DOE'),disabled='N',require_password_change='N',successive_failed_logins=0 WHERE user_id IN ('CITEST_P14_USER_A','CITEST_P14_USER_NULL','CITEST_P14_USER_EMPTY','CITEST_P14_USER_NA')",true);
function state(){return {groups:query("SELECT customer_group_id,organization_party_id,group_name,is_active,payment_terms FROM customer_group WHERE customer_group_id IN ('CITEST_P14_GROUP_A','CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA') ORDER BY customer_group_id"),members:query("SELECT customer_group_id,party_id,from_date,thru_date FROM customer_group_member WHERE customer_group_id IN ('CITEST_P14_GROUP_A','CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA') ORDER BY customer_group_id,party_id,from_date")};}
async function request(shell,screen,params={},user='contacts.qa.a'){
 // Quasar loads the real screen as a qvt fragment; its initial HTML is only the SPA shell.
 const screenPath=shell==='qapps'&&!screen.includes('/')?screen+'.qvt':screen;
 const response=await fetch(`${base}/${shell}/zenith/Contacts/${screenPath}?${new URLSearchParams(params)}`,{headers:{Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')},redirect:'follow'});
 const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,url:new URL(response.url).pathname,text:bytes.toString('utf8'),bytes};
}
async function setNaPreference(){
 const user='contacts.qa.na';
 const response=await fetch(`${base}/apps/setPrefGoLast?${new URLSearchParams({preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:'_NA_'})}`,{headers:{Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')},redirect:'manual'});
 check('Disposable no-org marker set through authenticated preference transition',response.status<400,response.status);
 const rows=query("SELECT preference_value FROM user_preference WHERE user_id='CITEST_P14_USER_NA' AND preference_key='ACTIVE_ORGANIZATION'");
 check('Read-only DB proves no-org marker before request',rows.length===1&&rows[0].preference_value==='_NA_');
}
function csvRows(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.replace(/^\uFEFF/,'').length;i++){let t=text.replace(/^\uFEFF/,''),c=t[i];if(c==='"'){if(quoted&&t[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}return rows;}
function worksheet(bytes){
 let offset=0;while(offset+30<bytes.length){if(bytes.readUInt32LE(offset)!==0x04034b50)break;const method=bytes.readUInt16LE(offset+8),flags=bytes.readUInt16LE(offset+6),length=bytes.readUInt32LE(offset+18),nameLen=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+nameLen).toString(),start=offset+30+nameLen+extra;if(flags&8)break;if(name==='xl/worksheets/sheet1.xml'){let raw=bytes.subarray(start,start+length);return method===8?zlib.inflateRawSync(raw).toString('utf8'):raw.toString('utf8');}offset=start+length;}
 // JDK ZIP often uses data descriptors: locate entries through the central directory instead.
 for(let i=0;i+46<bytes.length;i++){if(bytes.readUInt32LE(i)!==0x02014b50)continue;let len=bytes.readUInt16LE(i+28),name=bytes.subarray(i+46,i+46+len).toString();if(name!=='xl/worksheets/sheet1.xml')continue;let local=bytes.readUInt32LE(i+42),start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),size=bytes.readUInt32LE(i+20),raw=bytes.subarray(start,start+size);return bytes.readUInt16LE(i+10)===8?zlib.inflateRawSync(raw).toString('utf8'):raw.toString('utf8');}
 throw Error('Real XLSX worksheet is missing');
}
async function exportRows(shell,screen,params,user){let format=params.format||'csv',r=await request(shell,screen+'/export',params,user);check(`${shell} ${screen} ${format}: HTTP200`,r.status===200,r.status);let rows=format==='csv'?csvRows(r.text):[...worksheet(r.bytes).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v=>v[1]));check(`${shell} ${screen} ${format}: headers retained`,rows.length>0&&rows[0].length>0);return rows.slice(1);}
async function reproduce(){for(const shell of ['apps','qapps'])for(const screen of ['FindContact','Customers','Vendors','CustomerGroups']){
 await setNaPreference();let r=await request(shell,screen,{pageNoLimit:'true'},'contacts.qa.na');let listLeak=r.text.includes('P14QA Global Unowned');await setNaPreference();let csv=await exportRows(shell,screen,{format:'csv'},'contacts.qa.na');await setNaPreference();let xlsx=await exportRows(shell,screen,{format:'xlsx'},'contacts.qa.na');report.reproduction.push({shell,screen,listStatus:r.status,globalListVisible:listLeak,csvRecords:csv.length,xlsxRecords:xlsx.length,globalCsvVisible:JSON.stringify(csv).includes('P14QA Global Unowned'),globalXlsxVisible:JSON.stringify(xlsx).includes('P14QA Global Unowned')});}
}
async function scopeMatrix(){
 for(const item of report.reproduction)check(`${item.shell} ${item.screen}: direct no-org marker exports headers only`,item.csvRecords===0&&item.xlsxRecords===0&&!item.globalCsvVisible&&!item.globalXlsxVisible,item);
 for(const shell of ['apps','qapps'])for(const screen of ['FindContact','Customers','Vendors','CustomerGroups']){
  let r=await request(shell,screen,{pageNoLimit:'true'});check(`${shell} ${screen}: own tenant visible`,r.status===200&&r.text.includes(screen==='CustomerGroups'?'P14QA Owned Alpha':'P14QA Alpha'));check(`${shell} ${screen}: foreign/global rows absent`,!r.text.includes('P14QA Foreign Bravo')&&!r.text.includes('P14QA Global Unowned'));
  const field=screen==='CustomerGroups'?'organizationPartyId':'ownerPartyId';
  for(const forged of [{[field]:'CITEST_ORG_B'},{[field]:'%',[field+'_op']:'like'},{[field]:'CITEST_ORG_A',[field+'_not']:'Y'},{[field]:'',[field+'_op']:'empty'}]){
   let page=await request(shell,screen,{...forged,pageNoLimit:'true'});check(`${shell} ${screen}: forged ${JSON.stringify(forged)} does not replace scope`,page.status===200&&page.text.includes(screen==='CustomerGroups'?'P14QA Owned Alpha':'P14QA Alpha')&&!page.text.includes('P14QA Foreign Bravo')&&!page.text.includes('P14QA Global Unowned'));
   for(const format of ['csv','xlsx']){let rows=await exportRows(shell,screen,{...forged,format});check(`${shell} ${screen} ${format}: forged scope stays own`,rows.length>0&&!JSON.stringify(rows).includes('P14QA Foreign Bravo')&&!JSON.stringify(rows).includes('P14QA Global Unowned'));}
  }
  for(const user of ['contacts.qa.null','contacts.qa.empty','contacts.qa.na']){
   let page=await request(shell,screen,{pageNoLimit:'true'},user);check(`${shell} ${screen} ${user}: no-org list has no synthetic rows`,page.status===200&&!page.text.includes('P14QA Global Unowned')&&!page.text.includes('P14QA Alpha')&&!page.text.includes('P14QA Foreign Bravo'));
   for(const format of ['csv','xlsx']){let rows=await exportRows(shell,screen,{format},user);check(`${shell} ${screen} ${user} ${format}: no-org headers only`,rows.length===0,rows.length);}
  }
  for(const format of ['csv','xlsx']){let rows=await exportRows(shell,screen,{format,pageSize:'5',pageIndex:'1'});check(`${shell} ${screen} ${format}: pagination does not truncate filtered export`,screen==='CustomerGroups'?rows.length===1:rows.filter(r=>JSON.stringify(r).includes('P14QA Alpha')).length===25,rows.length);}
  for(const format of ['csv','xlsx']){
   const noMatch=screen==='CustomerGroups'?{quickSearch:'P14QA_NoMatchingFixture'}:{lastName:'P14QA_NoMatchingFixture'};
   check(`${shell} ${screen} ${format}: no-match headers only`,(await exportRows(shell,screen,{...noMatch,format})).length===0);
   if(screen==='FindContact'||screen==='Customers'){let rows=await exportRows(shell,screen,{format,statusFilter:'inactive'});check(`${shell} ${screen} ${format}: inactive filter matches DB fixture`,rows.length===1&&JSON.stringify(rows).includes('P14QA Alpha Disabled'));}
   if(screen==='Vendors'){let rows=await exportRows(shell,screen,{format,showDisabled:'Y'});check(`${shell} ${screen} ${format}: show-disabled includes captured inactive row`,rows.filter(r=>JSON.stringify(r).includes('P14QA Alpha')).length===26&&JSON.stringify(rows).includes('P14QA Alpha Disabled'));}
   if(screen==='FindContact'){let phone=await exportRows(shell,screen,{format,quickSearch:'9000000042'});check(`${shell} ${screen} ${format}: phone-shaped search finds fixture`,phone.length===1&&JSON.stringify(phone).includes('P14QA Alpha 01'));let id=await exportRows(shell,screen,{format,quickSearch:'CITEST_P14_A_42'});check(`${shell} ${screen} ${format}: alphanumeric query does not match unrelated phone digits`,id.length===0);}
  }
 }
}
function provenance(){
 const crypto=require('crypto'),source=process.env.CONTACTS_QA_SOURCE_DIR||path.resolve(__dirname,'../../..');
 const paths=['component/zenith-erp-contacts/screen/zenith/contacts/Contacts/FindContact.xml','component/zenith-erp-contacts/screen/zenith/contacts/Contacts/Customers.xml','component/zenith-erp-contacts/screen/zenith/contacts/Contacts/Vendors.xml','component/zenith-erp-contacts/screen/zenith/contacts/Contacts/CustomerGroups.xml','component/zenith-erp-contacts/screen/zenith/contacts/Contacts/EditCustomerGroup.xml','component/zenith-erp-contacts/service/zenith/contacts/ContactServices.xml'];
 report.provenance=paths.map(relative=>{
  const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(source,relative))).digest('hex');
  let runtimeBytes;
  if(mode==='postgres'){
   const container=process.env.CONTACTS_QA_APP_CONTAINER;if(!container)throw Error('CI application container required for runtime/source parity');
   runtimeBytes=cp.execFileSync('docker',['exec',container,'cat','/opt/moqui/runtime/'+relative],{timeout:30000,maxBuffer:2*1024*1024});
  }else{
   if(!process.env.CONTACTS_QA_RUNTIME_DIR)throw Error('Native runtime root required for runtime/source parity');
   runtimeBytes=fs.readFileSync(path.join(process.env.CONTACTS_QA_RUNTIME_DIR,'runtime',relative));
  }
  const runtimeSha256=crypto.createHash('sha256').update(runtimeBytes).digest('hex');check('Runtime/source SHA256 match: '+relative,sourceSha256===runtimeSha256);return {path:relative,sourceSha256,runtimeSha256};
 });
}
async function browserMatrix(){
 const {chromium}=require('playwright');let browser;
 const before=state(),foreignBefore=JSON.stringify({groups:before.groups.filter(g=>g.customer_group_id!=='CITEST_P14_GROUP_A'),members:before.members.filter(m=>m.customer_group_id!=='CITEST_P14_GROUP_A')});
 const errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CONTACTS_QA_CHROME||undefined,headless:true,args:['--disable-extensions','--no-first-run']});
  const contexts={};
  async function userContext(user){
   if(contexts[user])return contexts[user];
   const context=await browser.newContext({viewport:{width:1440,height:900}});
   // Authenticate once; persistent Basic headers rotate Moqui's session during parallel SPA requests.
   const login=await context.request.get(base+'/apps/zenith/Contacts/CustomerGroups',{headers:{Authorization:'Basic '+Buffer.from(user+':'+password).toString('base64')},timeout:90000});
   check(user+': one-time session authentication succeeds',login.status()===200,login.status());
   const hasSessionCookie=(await context.cookies()).some(cookie=>cookie.name==='JSESSIONID'&&!!cookie.value);
   check(user+': authenticated session cookie exists',hasSessionCookie);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   // A normal rendered page supplies the session CSRF token without disabling security.
   await page.goto(base+'/apps/zenith/Contacts/CustomerGroups',{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.cust-title').first().waitFor({timeout:60000});
   const token=await page.evaluate(()=>document.querySelector('#confMoquiSessionToken')?.value||document.querySelector('[name=moquiSessionToken]')?.value||window.moqui?.webrootVue?.moquiSessionToken);
   check(user+': actual rendered session token exists',!!token);
   return contexts[user]={context,page,token};
  }
  async function operation(shell,user,operation,id,extra={}){
   const {context,token}=await userContext(user);
   if(user==='contacts.qa.na')await setNaPreference();
   const response=await context.request.post(`${base}/${shell}/zenith/Contacts/ContactsQaAcceptance/verify`,{form:{operation,customerGroupId:id,moquiSessionToken:token,...extra}});
   check(`${shell} ${user} ${operation} ${id}: actual authorized HTTP service response`,response.status()===200,response.status());
   const result=await response.json();check(`${shell} ${user} ${operation}: disposable helper restricted`,result.fixtureCheck===true);return result;
  }
  const original=before.groups.find(g=>g.customer_group_id==='CITEST_P14_GROUP_A');
  for(const shell of ['apps','qapps']){
   let r=await operation(shell,'contacts.qa.a','guard','CITEST_P14_GROUP_A');check(`${shell}: own group guard allows`,r.allowed===true&&!r.denied);
   r=await operation(shell,'contacts.qa.a','members','CITEST_P14_GROUP_A');check(`${shell}: own member read succeeds`,!r.denied&&r.memberIds.includes('CITEST_P14_A_01'));
   const capturedMemberKeys={[ 'CITEST_P14_GROUP_A' ]:r.memberKeys};
   for(const id of ['CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA']){
    const metadata=await operation(shell,'john.doe','members',id);
    check(`${shell} ${id}: authorized fixture metadata supplies exact membership instant`,!metadata.denied&&metadata.memberKeys.length===1,metadata.memberKeys);
    capturedMemberKeys[id]=metadata.memberKeys;
   }
   const name='P14QA Verified '+shell;
   r=await operation(shell,'contacts.qa.a','update','CITEST_P14_GROUP_A',{groupName:name});check(`${shell}: own group update succeeds`,!r.denied&&state().groups.find(g=>g.customer_group_id==='CITEST_P14_GROUP_A').group_name===name);
   r=await operation(shell,'contacts.qa.a','assign','CITEST_P14_GROUP_A',{partyId:'CITEST_P14_A_02'});let own=state().members.filter(m=>m.customer_group_id==='CITEST_P14_GROUP_A'&&m.party_id==='CITEST_P14_A_02'&&!m.thru_date);check(`${shell}: own member added in DB`,!r.denied&&own.length===1);
   const readAdded=await operation(shell,'contacts.qa.a','members','CITEST_P14_GROUP_A');
   const addedKeys=readAdded.memberKeys.filter(m=>m.partyId==='CITEST_P14_A_02');
   check(`${shell}: guarded member service returns one exact added key`,!readAdded.denied&&addedKeys.length===1,addedKeys);
   const beforeRemove=state().members.filter(m=>m.customer_group_id==='CITEST_P14_GROUP_A'&&m.party_id==='CITEST_P14_A_02');
   r=await operation(shell,'contacts.qa.a','remove','CITEST_P14_GROUP_A',{partyId:'CITEST_P14_A_02',fromDateInstant:addedKeys[0].fromDateInstant});
   const afterRemove=state().members.filter(m=>m.customer_group_id==='CITEST_P14_GROUP_A'&&m.party_id==='CITEST_P14_A_02');
   check(`${shell}: own member expiration persists in DB`,!r.denied&&afterRemove.filter(m=>!m.thru_date).length===0,{denied:r.denied,messages:r.messages||null,capturedDbKey:own[0],capturedServiceKey:addedKeys[0],before:beforeRemove,after:afterRemove});
   await operation(shell,'contacts.qa.a','update','CITEST_P14_GROUP_A',{groupName:original.group_name});
   for(const user of ['contacts.qa.a','contacts.qa.null','contacts.qa.empty','contacts.qa.na']){
    const ids=user==='contacts.qa.a'?['CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA','CITEST_P14_GROUP_MISSING']:['CITEST_P14_GROUP_A','CITEST_P14_GROUP_NA'];
    for(const id of ids)for(const op of ['guard','members','update','assign','remove']){
     const member=(capturedMemberKeys[id]||capturedMemberKeys.CITEST_P14_GROUP_A)[0];
     const result=await operation(shell,user,op,id,{groupName:'P14QA Must Never Persist',partyId:member.partyId,fromDateInstant:member.fromDateInstant});
     check(`${shell} ${user} ${op} ${id}: foreign/no-org/missing access denied`,result.denied===true&&(op!=='members'||result.memberIds.length===0),result);
    }
    for(const id of ids){const page=await request(shell,'EditCustomerGroup',{customerGroupId:id},user);check(`${shell} ${user} ${id}: editor redirects without foreign data`,!page.text.includes('P14QA Foreign Bravo')&&!page.text.includes('P14QA Global Unowned')&&!page.text.includes('name="GroupForm"'));}
   }
   for(const op of ['assign','remove']){
    const member=capturedMemberKeys.CITEST_P14_GROUP_B[0];
    const r=await operation(shell,'contacts.qa.a',op,'CITEST_P14_GROUP_A',{partyId:'CITEST_P14_B_01',fromDateInstant:member.fromDateInstant});check(`${shell}: own group rejects foreign member ${op}`,r.denied===true);
   }
   const admin=await operation(shell,'john.doe','guard','CITEST_P14_GROUP_B');check(`${shell}: intentional ADMIN group bypass retained`,admin.allowed===true&&!admin.denied);
   const {page}=await userContext('contacts.qa.a');
   for(const width of [320,390,800,1440])for(const screen of ['FindContact','Customers','Vendors','CustomerGroups']){
    await page.setViewportSize({width,height:900});await page.goto(`${base}/${shell}/zenith/Contacts/${screen}`,{waitUntil:'domcontentloaded',timeout:90000});
    // Navigation can briefly replace the document before its new body exists; keep polling then.
    await page.waitForFunction(expected=>document.body?.innerText?.includes(expected),screen==='CustomerGroups'?'P14QA Owned Alpha':'P14QA Alpha',{timeout:60000});await page.waitForTimeout(500);
    const shape=await page.evaluate(()=>({title:(document.querySelector('.cust-title,.box-header,.panel-heading')?.textContent||'').trim(),own:document.body.innerText.includes('P14QA Alpha'),foreign:document.body.innerText.includes('P14QA Foreign Bravo')||document.body.innerText.includes('P14QA Global Unowned'),tables:[...document.querySelectorAll('table')].filter(t=>t.getBoundingClientRect().width>0).length,bodyWidth:document.body.clientWidth,scrollWidth:document.body.scrollWidth}));
    check(`${shell} ${screen} ${width}: real responsive screen renders scoped data`,!shape.foreign&&(screen==='CustomerGroups'||shape.own),shape);
    const screenshot=(screen==='FindContact'||screen==='CustomerGroups')?`${shell}-${screen}-${width}.png`:null;if(screenshot)await page.screenshot({path:path.join(out,screenshot),fullPage:true});report.viewports.push({shell,screen,width,screenshot,...shape});
   }
  }
  const after=state();check('Foreign/global groups and memberships unchanged in DB',JSON.stringify({groups:after.groups.filter(g=>g.customer_group_id!=='CITEST_P14_GROUP_A'),members:after.members.filter(m=>m.customer_group_id!=='CITEST_P14_GROUP_A')})===foreignBefore);
  check('Own original group name restored in DB',after.groups.find(g=>g.customer_group_id==='CITEST_P14_GROUP_A').group_name===original.group_name);
  check('Own original membership remains active',after.members.some(m=>m.customer_group_id==='CITEST_P14_GROUP_A'&&m.party_id==='CITEST_P14_A_01'&&!m.thru_date));
  report.databaseFinalState=after;report.pageErrors=errors;check('Both real browser shells have no JavaScript page errors',errors.length===0,errors);
 }finally{if(browser)await browser.close();}
}
(async()=>{try{await reproduce();if(process.argv.includes('--reproduce'))return;provenance();if(!process.argv.includes('--browser-only'))await scopeMatrix();if(!process.argv.includes('--scope-only'))await browserMatrix();}catch(error){report.error=error.message;process.exitCode=1;}finally{report.completedAt=new Date().toISOString();report.passed=report.checks.filter(c=>c.pass).length;report.failed=report.checks.filter(c=>!c.pass).length;fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,reproduction:report.reproduction,error:report.error},null,2));}})();
