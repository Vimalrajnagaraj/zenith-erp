// Synthetic arithmetic only. Never run against a production URL or persistent database.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),{chromium}=require('playwright');
const base=process.env.PRICE_QA_BASE||'http://127.0.0.1:18085';
if(!/^http:\/\/(127\.0\.0\.1|localhost):18085$/.test(base))throw Error('Disposable loopback URL required');
const runtime=process.env.PRICE_QA_RUNTIME,java=process.env.PRICE_QA_JAVA,out=path.resolve(process.env.PRICE_QA_OUT||'pricing-engine-proof');
if(!runtime||!java)throw Error('Set PRICE_QA_RUNTIME and PRICE_QA_JAVA for the fixed in-memory DB probe');
fs.mkdirSync(out,{recursive:true});const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});
cp.execFileSync(path.join(path.dirname(java),process.platform==='win32'?'javac.exe':'javac'),['-d',classes,path.join(__dirname,'PriceEngineDbProbe.java')],{windowsHide:true});
function q(sql){return JSON.parse(cp.execFileSync(java,['-cp',path.join(runtime,'WEB-INF/lib/h2-2.4.240.jar')+path.delimiter+classes,'PriceEngineDbProbe'],{input:sql,encoding:'utf8',windowsHide:true}));}
const hash=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const report={productionAccess:false,checks:[],cases:[],failures:[]};
function check(name,ok,evidence={}){report.checks.push({name,passed:!!ok,evidence});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);}
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.PRICE_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const admin=await browser.newContext();let r=await admin.request.get(base+'/apps/zenith/pricing/FindPriceList',{headers:{Authorization:'Basic '+Buffer.from('john.doe:moqui').toString('base64')}});
 const p=await admin.newPage();await p.goto(base+'/apps/zenith/pricing/FindPriceList');const token=await p.locator('[name=moquiSessionToken]').first().inputValue();
 r=await admin.request.post(base+'/apps/zenith/pricing/PriceEngineQaAcceptance/initialize',{form:{moquiSessionToken:token}});
 check('Fixtures initialized in fresh DB',r.status()===200&&(await r.json()).initialized===true);
 check('Fixture product and owner exist',q("SELECT count(*) n FROM product WHERE product_id='PP_QA_PRODUCT_A' AND owner_party_id='PP_QA_A'")[0].n==='1');
 const issuedBefore=hash(q('SELECT * FROM invoice ORDER BY invoice_id'));
 const pricesBefore=hash(q('SELECT * FROM price_list_item ORDER BY price_list_item_id'));
 const ctx=await browser.newContext();await ctx.request.get(base+'/apps/zenith/pricing/FindPriceList',{headers:{Authorization:'Basic '+Buffer.from('purchase.pricing.qa:moqui').toString('base64')}});
 const page=await ctx.newPage();await page.goto(base+'/apps/zenith/pricing/FindPriceList');const t=await page.locator('[name=moquiSessionToken]').first().inputValue();
 check('Organization membership retained',q("SELECT preference_value FROM user_preference WHERE user_id='PP_QA_USER' AND preference_key='ACTIVE_ORGANIZATION'")[0].preference_value==='PP_QA_A');
 const cases=[['Default fixed list',{},90],['Zero tier overrides discount',{quantity:'12'},0],['Inactive list falls back',{priceListId:'PP_QA_LIST_OFF'},100],['Expired list falls back',{priceListId:'PP_QA_LIST_EXPIRED'},100],['Historical item uses order date',{priceListId:'PP_QA_LIST_HISTORIC',orderDate:'2000-06-01 12:00:00'},4],['Foreign list cannot contribute',{priceListId:'PP_QA_LIST_B'},100],['Zero discount cap',{productId:'PP_QA_PRODUCT_CAP'},100],['Parent fallback applies rule once',{productId:'PP_QA_PRODUCT_PARENT',priceListId:'PP_QA_CHILD'},72],['Foreign currency list excluded',{priceListId:'PP_QA_LIST_A',currencyUomId:'USD'},100]];
 for(const [name,params,want] of cases){const res=await ctx.request.post(base+'/apps/zenith/pricing/PriceEngineQaAcceptance/price',{form:{moquiSessionToken:t,productId:'PP_QA_PRODUCT_A',organizationPartyId:'PP_QA_A',currencyUomId:'INR',...params}});const b=await res.json();report.cases.push({name,result:b.result});check(name,res.status()===200&&!b.errors?.length&&Number(b.result.unitPrice)===want,{actual:b.result.unitPrice,expected:want,source:b.result.priceSource});}
 for(const quantity of ['0','-1']) {const res=await ctx.request.post(base+'/apps/zenith/pricing/PriceEngineQaAcceptance/price',{form:{moquiSessionToken:t,productId:'PP_QA_PRODUCT_A',organizationPartyId:'PP_QA_A',quantity}});check('Reject quantity '+quantity,(await res.json()).errors.length>0);}
 check('All invoice rows unchanged by price resolution',hash(q('SELECT * FROM invoice ORDER BY invoice_id'))===issuedBefore);
 check('All stored prices unchanged by price resolution',hash(q('SELECT * FROM price_list_item ORDER BY price_list_item_id'))===pricesBefore);
 await ctx.close();
 r=await admin.request.post(base+'/apps/zenith/pricing/PriceEngineQaAcceptance/cleanup',{form:{moquiSessionToken:token}});const clean=await r.json();check('Fixture cleanup succeeded',r.status()===200&&clean.removed>0,clean);
 for(const [table,id] of [['party','party_id'],['user_account','user_id'],['party_relationship','party_relationship_id'],['product','product_id'],['price_list','price_list_id'],['price_list_item','price_list_item_id'],['volume_pricing','volume_pricing_id'],['pricing_rule','pricing_rule_id'],['pricing_rule_condition','condition_id']])check('Zero fixture residue '+table,q(`SELECT count(*) n FROM ${table} WHERE ${id} LIKE 'PP_QA_%'`)[0].n==='0');
 check('All invoices remain unchanged after cleanup',hash(q('SELECT * FROM invoice ORDER BY invoice_id'))===issuedBefore);
 await admin.close();
}catch(e){report.failures.push(e.message);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,out}));}
})();
