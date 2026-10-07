// Disposable synthetic RFQ workflow; never use on production.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),{chromium}=require('playwright');
const base='http://127.0.0.1:18085',runtime=process.env.RFQ_QA_RUNTIME,java=process.env.RFQ_QA_JAVA,out=path.resolve(process.env.RFQ_QA_OUT||'rfq-proof');
if(!runtime||!java)throw Error('Configure the disposable runtime and JDK');fs.mkdirSync(out,{recursive:true});const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});
cp.execFileSync(path.join(path.dirname(java),'javac.exe'),['-d',classes,path.join(__dirname,'RfqDbProbe.java')],{windowsHide:true});
function q(sql){return JSON.parse(cp.execFileSync(java,['-cp',path.join(runtime,'WEB-INF/lib/h2-2.4.240.jar')+path.delimiter+classes,'RfqDbProbe'],{input:sql,encoding:'utf8',windowsHide:true}));}
const hash=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const report={productionAccess:false,checks:[],failures:[],generated:[]};function check(name,ok,evidence={}){report.checks.push({name,passed:!!ok,evidence});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let admin,ctx,token,adminToken;
try{
 admin=await browser.newContext();const readyDeadline=Date.now()+120000;for(;;){try{const ready=await admin.request.get(base+'/apps/zenith/Purchase/RfqList',{timeout:120000,headers:{Authorization:'Basic '+Buffer.from('john.doe:moqui').toString('base64')}});if(ready.status()>=500)throw Error('Runtime not ready');break;}catch(e){if(Date.now()>=readyDeadline)throw e;await new Promise(r=>setTimeout(r,1000));}}
 const ap=await admin.newPage();await ap.goto(base+'/apps/zenith/Purchase/RfqList');adminToken=await ap.locator('[name=moquiSessionToken]').first().inputValue();
 let res=await admin.request.post(base+'/apps/zenith/pricing/RfqQaAcceptance/initialize',{form:{moquiSessionToken:adminToken}});check('Fresh fixtures initialized',res.status()===200&&(await res.json()).initialized===true);
 const invoicesBefore=hash(q('SELECT * FROM invoice ORDER BY invoice_id'));const foreignBefore=hash(q("SELECT * FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_B'"));
 ctx=await browser.newContext({viewport:{width:1366,height:900}});await ctx.request.get(base+'/apps/zenith/Purchase/RfqList',{headers:{Authorization:'Basic '+Buffer.from('purchase.pricing.qa:moqui').toString('base64')}});
 const p=await ctx.newPage();await p.goto(base+'/apps/zenith/Purchase/RfqList');token=await p.locator('[name=moquiSessionToken]').first().inputValue();
 check('Own organization retained',q("SELECT preference_value FROM user_preference WHERE user_id='PP_QA_USER' AND preference_key='ACTIVE_ORGANIZATION'")[0].preference_value==='PP_QA_A');
 async function post(screen,transition,data={},shell='apps',csrf=true){await ctx.request.get(`${base}/apps/zenith/Purchase/RfqList`);const module=screen==='RfqQaAcceptance'?'pricing':'Purchase';const r=await ctx.request.post(`${base}/${shell}/zenith/${module}/${screen}/${transition}`,{form:{...(csrf?{moquiSessionToken:token}:{}),...data},maxRedirects:0});check('Transition '+transition+' returns without server error',r.status()<500,{status:r.status(),shell});return r;}
 const a={rfqId:'PP_QA_RFQ_A'};
 await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_B',totalAmount:'1'});
 await post('EditRfq','deleteVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_B'});
 check('Foreign response unchanged after forged update and delete',foreignBefore===hash(q("SELECT * FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_B'")));
 await post('EditRfq','updateRfq',{...a,statusId:'RfqSent',description:'Verified RFQ',organizationPartyId:'PP_QA_B',rfqNumber:'FORGED'});
 let row=q("SELECT organization_party_id,rfq_number,status_id,description FROM purchase_rfq WHERE rfq_id='PP_QA_RFQ_A'")[0];
 check('Header editable fields saved; owner and number immutable',row.organization_party_id==='PP_QA_A'&&row.rfq_number==='Disposable RFQ A'&&row.status_id==='RfqSent'&&row.description==='Verified RFQ',row);
 await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_A',totalAmount:'120',deliveryDays:'2',vendorPartyId:'PP_QA_VENDOR_B',isSelected:'Y'});
 row=q("SELECT total_amount,vendor_party_id,rfq_id,remarks,is_selected FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_A'")[0];
 check('Own response edits succeed without vendor or parent reassignment',Number(row.total_amount)===120&&row.vendor_party_id==='PP_QA_VENDOR_A'&&row.rfq_id==='PP_QA_RFQ_A'&&row.remarks==='Keep original note'&&row.is_selected==='Y',row);
 await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_A',totalAmount:'-1',deliveryDays:'-1'});
 check('Negative quote rejected without changing valid amount',Number(q("SELECT total_amount FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_A'")[0].total_amount)===120);
 await post('EditRfq','createRfqItem',{...a,description:'New QA item',quantity:'2',productTaxCode:'',productId:'PP_QA_PRODUCT_A'});
 const added=q("SELECT rfq_item_seq_id FROM purchase_rfq_item WHERE rfq_id='PP_QA_RFQ_A' AND description='New QA item'");check('Valid own item inserted',added.length===1);report.generated.push({rfqId:a.rfqId,rfqItemSeqId:added[0].rfq_item_seq_id});
 for(const quantity of ['0','-1','not-a-number'])await post('EditRfq','createRfqItem',{...a,description:'Rejected QA item',quantity});
 check('Invalid quantities leave no item rows',q("SELECT count(*) n FROM purchase_rfq_item WHERE rfq_id='PP_QA_RFQ_A' AND description='Rejected QA item'")[0].n==='0');
 await post('EditRfq','createRfqItem',{...a,description:'Foreign product',quantity:'1',productId:'PP_QA_PRODUCT_B'});
 check('Foreign product cannot enter own RFQ',q("SELECT count(*) n FROM purchase_rfq_item WHERE rfq_id='PP_QA_RFQ_A' AND product_id='PP_QA_PRODUCT_B'")[0].n==='0');
 await post('EditRfq','updateRfqItem',{...a,rfqItemSeqId:added[0].rfq_item_seq_id,description:'Updated QA item',quantity:'3',productId:'PP_QA_PRODUCT_A'});
 check('Own item update persisted',q("SELECT count(*) n FROM purchase_rfq_item WHERE rfq_id='PP_QA_RFQ_A' AND description='Updated QA item' AND quantity=3")[0].n==='1');
 await post('EditRfq','deleteRfqItem',{...a,rfqItemSeqId:added[0].rfq_item_seq_id});
 check('Own item deletion persisted',q(`SELECT count(*) n FROM purchase_rfq_item WHERE rfq_id='PP_QA_RFQ_A' AND rfq_item_seq_id='${added[0].rfq_item_seq_id}'`)[0].n==='0');
 await post('EditRfq','createVendorResponse',{...a,vendorPartyId:'PP_QA_VENDOR_B',totalAmount:'100'});
 check('Foreign vendor response rejected',q("SELECT count(*) n FROM rfq_vendor_response WHERE rfq_id='PP_QA_RFQ_A' AND vendor_party_id='PP_QA_VENDOR_B'")[0].n==='0');
 await post('EditRfq','createVendorResponse',{...a,vendorPartyId:'PP_QA_VENDOR_A',totalAmount:'90',deliveryDays:'0',paymentTerms:'Editable QA terms'});
 const response=q("SELECT rfq_response_id FROM rfq_vendor_response WHERE rfq_id='PP_QA_RFQ_A' AND total_amount=90");check('Valid own vendor response inserted',response.length===1);report.generated.push({rfqResponseId:response[0].rfq_response_id});
 await post('EditRfq','deleteVendorResponse',{...a,rfqResponseId:response[0].rfq_response_id});check('Own response deletion persisted',q(`SELECT count(*) n FROM rfq_vendor_response WHERE rfq_response_id='${response[0].rfq_response_id}'`)[0].n==='0');
 const ownBefore=hash(q("SELECT * FROM purchase_rfq WHERE rfq_id='PP_QA_RFQ_A'"));await post('EditRfq','updateRfq',{...a,description:'CSRF rejected'},'apps',false);check('Missing CSRF token leaves header unchanged',hash(q("SELECT * FROM purchase_rfq WHERE rfq_id='PP_QA_RFQ_A'"))===ownBefore);
 await post('RfqList','createRfq',{organizationPartyId:'PP_QA_B',description:'Forged create'});check('Forged organization create rejected',q("SELECT count(*) n FROM purchase_rfq WHERE description='Forged create'")[0].n==='0');
 await post('RfqList','createRfq',{organizationPartyId:'PP_QA_A',description:'Valid QA create'});const created=q("SELECT rfq_id,organization_party_id FROM purchase_rfq WHERE description='Valid QA create'");check('Own RFQ creation uses current org',created.length===1&&created[0].organization_party_id==='PP_QA_A');report.generated.push(created[0]);
 const exportUrls={};
 for(const shell of ['apps','qapps']){
   for(const [screen,heading] of [['RfqList','Requests for Quotation (RFQ)'],['EditRfq?rfqId=PP_QA_RFQ_A','RFQ Disposable RFQ A']]){
     const r=await p.goto(`${base}/${shell}/zenith/Purchase/${screen}`,{waitUntil:'networkidle'});await p.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:30000});check(shell+' '+screen+' actual content rendered',r.status()===200&&!/Error running actions|Error rendering screen|Internal Server Error/.test(await p.locator('body').innerText()));
     if(screen==='RfqList'){
       const url=new URL(await p.locator('a[href*="renderMode=csv"]').first().getAttribute('href'),base);check(shell+' export stays on disposable host',url.origin===base);exportUrls[shell]=url.toString();url.searchParams.set('organizationPartyId','PP_QA_B');const list=await ctx.request.get(url.toString());const csv=await list.text();check(shell+' actual export cannot select foreign RFQ',list.status()===200&&csv.includes('Disposable RFQ A')&&!csv.includes('Disposable RFQ B'));
       if(shell==='qapps')await p.getByRole('button',{name:'+ New RFQ',exact:true}).click();
       check(shell+' organization picker includes active org',await p.locator('[name=organizationPartyId] option[value=PP_QA_A]').count()===1);
       if(shell==='qapps')await p.locator('[role=dialog] button').filter({hasText:/^close$/}).click();
     }
     for(const width of [1920,1366,768,390,360]){
       await p.setViewportSize({width,height:900});await p.waitForFunction(()=>[...document.querySelectorAll('#z-sidebar,#zq-sidebar')].every(e=>e.getAnimations().every(a=>a.playState!=='running')));
       const size=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));check(shell+' '+screen+' fits '+width,size.scroll<=size.client+2,size);
       if(shell==='qapps'){
         await p.waitForFunction(()=>{const h=document.querySelector('.q-header');return h&&Math.abs(h.offsetHeight-parseFloat(getComputedStyle(document.body).getPropertyValue('--zq-rfq-header-height')))<2});
         const layout=await p.evaluate(()=>{const nodes=[...document.querySelectorAll('.q-header .q-toolbar>button,#zq-ownerview,#zq-search,#zq-toolbtns')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect());let overlaps=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(Math.min(nodes[i].right,nodes[j].right)-Math.max(nodes[i].left,nodes[j].left)>1&&Math.min(nodes[i].bottom,nodes[j].bottom)-Math.max(nodes[i].top,nodes[j].top)>1)overlaps++;return{overlaps,headingTop:document.querySelector('.zrfq-page h3').getBoundingClientRect().top,navBottom:document.querySelector('#zq-subnav').getBoundingClientRect().bottom}});
         check(shell+' '+screen+' header controls do not overlap at '+width,layout.overlaps===0,layout);check(shell+' '+screen+' heading clears navigation at '+width,layout.headingTop>=layout.navBottom-2,layout);
         const contrast=await p.evaluate(()=>({development:document.body.classList.contains('dev'),color:getComputedStyle(document.querySelector('#zq-toolbtns .material-icons')).color}));check(shell+' '+screen+' development header icons remain readable at '+width,!contrast.development||contrast.color==='rgb(245, 243, 255)',contrast);
       }
     }
     await p.screenshot({path:path.join(out,`${shell}-${screen.split('?')[0]}-360.png`),fullPage:true});
   }
   await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_B',totalAmount:'2'},shell);
   await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_A',totalAmount:shell==='apps'?'121':'122',deliveryDays:'2',isSelected:'Y'},shell);
   check(shell+' positive response write persisted',Number(q("SELECT total_amount FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_A'")[0].total_amount)===(shell==='apps'?121:122));
 }
 check('Foreign response unchanged in both shells',foreignBefore===hash(q("SELECT * FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_B'")));
 await post('RfqQaAcceptance','scope',{org:'NONE'});
 for(const shell of ['apps','qapps']){const url=new URL(exportUrls[shell]);url.searchParams.set('organizationPartyId','PP_QA_A');const r=await ctx.request.get(url.toString());const csv=await r.text();check(shell+' no-org actual export is empty despite forged query',r.status()===200&&!csv.includes('Disposable RFQ A')&&!csv.includes('Disposable RFQ B')&&!csv.includes('Valid QA create'));}
 await post('EditRfq','updateVendorResponse',{...a,rfqResponseId:'PP_QA_RESPONSE_A',totalAmount:'1'});check('No-org write denied',Number(q("SELECT total_amount FROM rfq_vendor_response WHERE rfq_response_id='PP_QA_RESPONSE_A'")[0].total_amount)===122);
 check('All invoices unchanged by RFQ workflow',hash(q('SELECT * FROM invoice ORDER BY invoice_id'))===invoicesBefore);
 await ctx.close();ctx=null;
 res=await admin.request.post(base+'/apps/zenith/pricing/RfqQaAcceptance/cleanup',{form:{moquiSessionToken:adminToken}});check('Exact-record cleanup succeeded',res.status()===200&&(await res.json()).removed>0);
 for(const [table,where] of [['purchase_rfq',"organization_party_id IN ('PP_QA_A','PP_QA_B')"],['purchase_rfq_item',"rfq_id IN ('PP_QA_RFQ_A','PP_QA_RFQ_B')"],['rfq_vendor_response',"rfq_id IN ('PP_QA_RFQ_A','PP_QA_RFQ_B')"],['party',"party_id LIKE 'PP_QA_%'"],['user_account',"user_id='PP_QA_USER'"],['party_relationship',"party_relationship_id LIKE 'PP_QA_%'"],['product',"product_id LIKE 'PP_QA_%'"]])check('Zero fixture residue '+table,q(`SELECT count(*) n FROM ${table} WHERE ${where}`)[0].n==='0');

 for(const [table,where] of [['user_group_member',"user_id='PP_QA_USER'"],['user_preference',"user_id='PP_QA_USER'"],['party_role',"party_id LIKE 'PP_QA_%'"],['person',"party_id LIKE 'PP_QA_%'"],['organization',"party_id LIKE 'PP_QA_%'"],['company_settings',"organization_party_id LIKE 'PP_QA_%'"]])check('Zero auxiliary fixture residue '+table,q(`SELECT count(*) n FROM ${table} WHERE ${where}`)[0].n==='0');
 check('All invoices unchanged after cleanup',hash(q('SELECT * FROM invoice ORDER BY invoice_id'))===invoicesBefore);
}catch(e){report.failures.push(e.message);process.exitCode=1;}finally{if(ctx)await ctx.close();if(admin)await admin.close();await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,out}));}})();
