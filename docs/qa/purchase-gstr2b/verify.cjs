// Real Moqui screens/services and independent read-only SQL on disposable loopback only.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),{chromium}=require('playwright');
const base='http://127.0.0.1:18085',runtime=process.env.GSTR_QA_RUNTIME,java=process.env.GSTR_QA_JAVA;
const out=path.resolve(process.env.GSTR_QA_OUT||'gstr2b-proof'),baseline=process.env.GSTR_QA_BASELINE==='true';
if(!runtime||!java)throw Error('Configure the disposable runtime and JDK');
fs.mkdirSync(out,{recursive:true});const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});
cp.execFileSync(path.join(path.dirname(java),'javac.exe'),['-d',classes,path.join(__dirname,'Gstr2bDbProbe.java')],{windowsHide:true});
const q=sql=>JSON.parse(cp.execFileSync(java,['-cp',path.join(runtime,'WEB-INF/lib/h2-2.4.240.jar')+path.delimiter+classes,'Gstr2bDbProbe'],{input:sql,encoding:'utf8',windowsHide:true}));
const hash=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const report={baseline,productionAccess:false,checks:[],failures:[]};
function csvRows(text){const lines=text.slice(text.indexOf('Supplier GSTIN,')).trim().split(/\r?\n/);const header=lines.shift().split(',');return lines.map(line=>{const cells=line.split(',');return Object.fromEntries(header.map((key,i)=>[key,cells[i]]));});}
function check(name,ok,evidence={}){report.checks.push({name,passed:!!ok,evidence});console.log((ok?'PASS ':baseline?'BUG ':'FAIL ')+name);if(!ok){report.failures.push(name);if(!baseline)throw Error(name);}}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let admin,ctx;
try{
 admin=await browser.newContext();const landing=base+'/apps/zenith/Purchase/Gstr2bRecon';const deadline=Date.now()+150000;
 for(;;){try{const r=await admin.request.get(landing,{timeout:120000,headers:{Authorization:'Basic '+Buffer.from('john.doe:moqui').toString('base64')}});if(r.status()>=500)throw Error('Runtime not ready');break;}catch(e){if(Date.now()>deadline)throw e;await new Promise(r=>setTimeout(r,1000));}}
 const ap=await admin.newPage();await ap.goto(landing);const at=await ap.locator('[name=moquiSessionToken]').first().inputValue();
 let r=await admin.request.post(base+'/apps/zenith/pricing/Gstr2bQaAcceptance/initialize',{form:{moquiSessionToken:at}});check('Fresh fixtures initialized',r.status()===200&&(await r.json()).initialized);
 check('Independent SQL proves positive posted fixtures and legacy default',q("SELECT count(*) n FROM invoice WHERE invoice_id LIKE 'PP_QA_%' AND status_id='InvoiceFinalized'")[0].n==='6'&&q("SELECT itc_eligible FROM invoice WHERE invoice_id='PP_QA_LEGACY'")[0].itc_eligible==='Y');
 const invoiceBefore=hash(q('SELECT * FROM invoice ORDER BY invoice_id')),linesBefore=hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id')),portalBefore=hash(q('SELECT * FROM gstr2b_record ORDER BY gstr2b_record_id'));
 const outside=hash(q("SELECT * FROM invoice WHERE invoice_id NOT LIKE 'PP_QA_%' ORDER BY invoice_id"));
 ctx=await browser.newContext({viewport:{width:1366,height:900}});await ctx.request.get(landing,{headers:{Authorization:'Basic '+Buffer.from('purchase.pricing.qa:moqui').toString('base64')}});
 const p=await ctx.newPage();await p.goto(landing);const token=await p.locator('[name=moquiSessionToken]').first().inputValue();
 const post=(transition,data={})=>ctx.request.post(base+'/apps/zenith/pricing/Gstr2bQaAcceptance/'+transition,{form:{moquiSessionToken:token,...data},maxRedirects:0});
 const invoke=async(op,data)=>(await post('invoke',{op,...data})).json();
 const g=await invoke('gstr3b',{organizationPartyId:'PP_QA_A',returnPeriod:'012026'});
 check('ITC excludes explicit No and supplier-composition snapshots, preserving eligible and legacy bills',!g.errors.length&&Number(g.result.table4.cgst)===18&&Number(g.result.table4.sgst)===18,g);
 check('Outward tax remains charged tax even when its ITC flag is No',!g.errors.length&&Number(g.result.table31.cgst)===90&&Number(g.result.table31.sgst)===90,g);
 check('Net payable uses eligible credit only',Number(g.result.netTaxPayable.cgst)===72&&Number(g.result.netTaxPayable.sgst)===72,g);
 const reg=await invoke('gstr2',{organizationPartyId:'PP_QA_A',returnPeriod:'012026'});
 check('Purchase register keeps ineligible bills and their charged tax',!reg.errors.length&&reg.result.totalInvoices===4&&Number(reg.result.totalCgst)===63&&reg.result.reportData.some(x=>x.invoiceId==='PP_QA_DENIED'),reg);
 if(!baseline){
  for(const bad of [{organizationPartyId:'PP_QA_B',returnPeriod:'012026'},{organizationPartyId:'PP_QA_MISSING',returnPeriod:'012026'},{organizationPartyId:'PP_QA_A',returnPeriod:'132026'},{organizationPartyId:'PP_QA_A',returnPeriod:'0126'}]){const v=await invoke('gstr3b',bad);check('Invalid report request rejected '+JSON.stringify(bad),v.errors.length>0,v);}
  const empty=await invoke('gstr3b',{organizationPartyId:'PP_QA_A',returnPeriod:'022026'});check('Empty period reports zero charged tax and credit',!empty.errors.length&&Object.values(empty.result.table4).every(v=>Number(v)===0)&&Object.values(empty.result.table31).every(v=>Number(v)===0));
 }
 for(const shell of baseline?['apps']:['apps','qapps']){
  const url=`${base}/${shell}/zenith/Purchase/Gstr2bRecon`;
  let res=await p.goto(url,{waitUntil:'networkidle'});await p.getByRole('heading',{name:'GSTR-2B Reconciliation',exact:true}).waitFor();
  check(shell+' actual reconciliation screen renders',res.status()===200&&!/Error running actions|Error rendering screen/.test(await p.locator('body').innerText()));
  const csvUrl=url+'/exportCsv';const csv=await ctx.request.get(csvUrl);const text=await csv.text();fs.writeFileSync(path.join(out,shell+'-synthetic.csv'),text);
  check(shell+' export retains own records and excludes foreign portal records',csv.status()===200&&text.includes('PP_QA_PORTAL_MATCHED')&&!text.includes('PP_QA_PORTAL_FOREIGN'));
  check(shell+' a foreign matched invoice pointer cannot leak book metadata',!text.includes('PP_QA_FOREIGN'));
  const rows=csvRows(text),amount=row=>row['Matched ITC']||row.ITC;
  check(shell+' matched credit includes cess',amount(rows.find(x=>x['Portal Inv#']==='PP_QA_PORTAL_MATCHED'))==='20.00');
  check(shell+' explicitly ineligible book has zero matched credit',amount(rows.find(x=>x['Portal Inv#']==='PP_QA_PORTAL_DENIED'))==='0.00');
  if(!baseline){
   check(shell+' mismatch count and tolerance match importer contract',await p.locator('.zg2b-page .z-statcell').nth(1).locator('.z-statnum').innerText()==='1'&&(await p.locator('.zg2b-page').innerText()).includes('₹0.01'));
   for(const forged of ['?organizationPartyId=PP_QA_B','?organizationPartyId=PP_QA_B&organizationPartyId_op=not-equals']){const v=await ctx.request.get(csvUrl+forged);check(shell+' forged export owner cannot bypass scope '+forged,v.status()===200&&(await v.text()).includes('PP_QA_PORTAL_MATCHED')&&!(await v.text()).includes('PP_QA_PORTAL_FOREIGN'));}
   const filtered=await ctx.request.get(csvUrl+'?matchStatus=Mismatch');const ft=await filtered.text();check(shell+' actual CSV retains search filters',ft.includes('PP_QA_PORTAL_MISMATCH')&&!ft.includes('PP_QA_PORTAL_MATCHED'));
   const noCsrf=await ctx.request.post(url+'/runReconciliation',{form:{organizationPartyId:'PP_QA_A',returnPeriod:'012026'},maxRedirects:0});check(shell+' import denies missing CSRF',noCsrf.status()===401&&(await noCsrf.text()).includes('Session token required'),{status:noCsrf.status()});
   const invalid=await ctx.request.post(url+'/runReconciliation',{form:{moquiSessionToken:token,organizationPartyId:'PP_QA_B',returnPeriod:'012026'},maxRedirects:0});check(shell+' foreign import has no server exception and persists no records',invalid.status()<500&&portalBefore===hash(q('SELECT * FROM gstr2b_record ORDER BY gstr2b_record_id')));
   for(const width of [1366,768,390,360]){
    await p.setViewportSize({width,height:900});await p.waitForFunction(()=>[...document.querySelectorAll('#z-sidebar,#zq-sidebar')].every(e=>e.getAnimations().every(a=>a.playState!=='running')));
    const size=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));check(shell+' screen fits '+width,size.scroll<=size.client+2,size);
    const icons=await p.locator('.zg2b-page .zg2b-icon').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height,display:getComputedStyle(e).display}}));check(shell+' all five KPI/action icons remain visible and square '+width,icons.length===5&&icons.every(i=>i.display!=='none'&&i.width===48&&i.height===48),icons);
    if(shell==='qapps'){
     await p.waitForFunction(()=>{const h=document.querySelector('.q-header');return h&&Math.abs(h.offsetHeight-parseFloat(getComputedStyle(document.body).getPropertyValue('--zq-g2b-header-height')))<2});
     const layout=await p.evaluate(()=>{const nodes=[...document.querySelectorAll('.q-header .q-toolbar>button,#zq-ownerview,#zq-search,#zq-toolbtns')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect());let overlaps=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(Math.min(nodes[i].right,nodes[j].right)-Math.max(nodes[i].left,nodes[j].left)>1&&Math.min(nodes[i].bottom,nodes[j].bottom)-Math.max(nodes[i].top,nodes[j].top)>1)overlaps++;return{overlaps,headingTop:document.querySelector('.zg2b-page h3').getBoundingClientRect().top,navBottom:document.querySelector('#zq-subnav').getBoundingClientRect().bottom}});
     check(shell+' header controls do not overlap '+width,layout.overlaps===0,layout);check(shell+' content clears navigation '+width,layout.headingTop>=layout.navBottom-2,layout);
    }
   }
   await p.screenshot({path:path.join(out,shell+'-360.png'),fullPage:true});
   const native=await ctx.request.get(base+'/apps/zenith/Purchase/Gstr2bRecon?renderMode=csv&lastStandalone=true&organizationPartyId=PP_QA_B');const nt=await native.text();fs.writeFileSync(path.join(out,shell+'-standalone-synthetic.csv'),nt);check(shell+' standalone CSV labels retain actual values and scope',native.status()===200&&nt.includes('Portal Inv#')&&nt.includes('PP_QA_PORTAL_MATCHED')&&!nt.includes('PP_QA_PORTAL_FOREIGN'),{header:nt.split('\n')[0]});
   const nr=csvRows(nt);check(shell+' standalone CSV exports numeric matched credit',Number(nr.find(x=>x['Portal Inv#']==='PP_QA_PORTAL_MATCHED')['Matched ITC'])===20&&Number(nr.find(x=>x['Portal Inv#']==='PP_QA_PORTAL_DENIED')['Matched ITC'])===0);
   await p.getByRole('button',{name:'Reconcile Now',exact:true}).first().click();
   check(shell+' actual dialog includes the current main organization',(await p.locator('[role=dialog],.modal.in').innerText()).includes('Disposable Purchase Pricing A'));
   const bounds=await p.locator(shell==='apps'?'.modal.in .modal-content':'[role=dialog]').evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,viewport:document.documentElement.clientWidth}});check(shell+' dialog fits mobile viewport',bounds.left>=-2&&bounds.right<=bounds.viewport+2,bounds);
   if(shell==='apps'){await p.locator('.modal.in button.close').click();await p.locator('.modal.in').waitFor({state:'hidden'});}else{await p.locator('[role=dialog] button').filter({hasText:'close'}).first().click();await p.locator('[role=dialog]').waitFor({state:'hidden'});}check(shell+' dialog close is clickable above navigation',true);
  }
 }
 await post('scope',{org:'NONE'});
 for(const shell of baseline?['apps']:['apps','qapps']){const res=await ctx.request.get(`${base}/${shell}/zenith/Purchase/Gstr2bRecon/exportCsv?organizationPartyId=PP_QA_A`);const text=await res.text();check(shell+' no-org CSV keeps headers and zero fixture rows',res.status()===200&&text.includes('Supplier GSTIN,Supplier,Portal Inv#')&&!text.includes('PP_QA_PORTAL_'));}
 if(!baseline){const native=await ctx.request.get(base+'/apps/zenith/Purchase/Gstr2bRecon?renderMode=csv&lastStandalone=true&organizationPartyId=PP_QA_A');const text=await native.text();check('No-org standalone export keeps headers and zero fixture rows',native.status()===200&&text.includes('Portal Inv#')&&!text.includes('PP_QA_PORTAL_'));}
 if(!baseline){const noOrg=await invoke('gstr3b',{returnPeriod:'012026'});check('No-org report rejected',noOrg.errors.length>0);}
 check('All invoice headers, lines and portal records unchanged by report/render/export/denials',invoiceBefore===hash(q('SELECT * FROM invoice ORDER BY invoice_id'))&&linesBefore===hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id'))&&portalBefore===hash(q('SELECT * FROM gstr2b_record ORDER BY gstr2b_record_id')));
 await ctx.close();ctx=null;r=await admin.request.post(base+'/apps/zenith/pricing/Gstr2bQaAcceptance/cleanup',{form:{moquiSessionToken:at}});check('Exact resolved fixture cleanup succeeds',r.status()===200&&(await r.json()).removed>0);
 for(const [table,where] of [['gstr2b_record',"gstr2b_record_id LIKE 'PP_QA_%'"],['invoice',"invoice_id LIKE 'PP_QA_%'"],['invoice_item',"invoice_id LIKE 'PP_QA_%'"],['tax_line_detail',"reference_id LIKE 'PP_QA_%'"],['party',"party_id LIKE 'PP_QA_%'"],['user_account',"user_id='PP_QA_USER'"],['party_role',"party_id LIKE 'PP_QA_%'"],['party_relationship',"party_relationship_id LIKE 'PP_QA_%'"],['person',"party_id LIKE 'PP_QA_%'"],['organization',"party_id LIKE 'PP_QA_%'"],['user_preference',"user_id='PP_QA_USER'"],['user_group_member',"user_id='PP_QA_USER'"],['company_settings',"organization_party_id LIKE 'PP_QA_%'"]])check('Independent SQL zero residue '+table,q(`SELECT count(*) n FROM ${table} WHERE ${where}`)[0].n==='0');
 check('Outside invoices unchanged after cleanup',outside===hash(q("SELECT * FROM invoice WHERE invoice_id NOT LIKE 'PP_QA_%' ORDER BY invoice_id")));
}catch(e){report.failures.push(e.stack||e.message);}finally{if(ctx)await ctx.close();if(admin)await admin.close();await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,out}));if(report.failures.length)process.exitCode=1;}
})();
