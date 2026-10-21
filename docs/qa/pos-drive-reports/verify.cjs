// Read the reported behaviors on a guarded, disposable POS runtime, with independent SQL.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{chromium}=require('playwright');
const base='http://127.0.0.1:18084',out=process.env.POS_DRIVE_OUT,java=process.env.POS_QA_JAVA,runtime=process.env.POS_QA_NATIVE_ROOT;
if(!out||!java||!runtime)throw Error('Native fixture paths required');fs.mkdirSync(out,{recursive:true});
const classes=path.join(out,'classes');fs.mkdirSync(classes,{recursive:true});cp.execFileSync(path.join(path.dirname(java),'javac.exe'),['-d',classes,path.join(__dirname,'../pos-runtime/PosDbProbe.java')],{windowsHide:true});
const q=sql=>{if(!/^SELECT /i.test(sql))throw Error('SELECT only');return JSON.parse(cp.execFileSync(java,['-cp',classes+path.delimiter+path.join(runtime,'WEB-INF/lib/h2-2.4.240.jar'),'PosDbProbe'],{input:sql,encoding:'utf8',windowsHide:true,env:{...process.env,POS_QA_DB_URL:'jdbc:h2:tcp://127.0.0.1:19096/mem:pos-qa;IFEXISTS=TRUE'}}));};
const checks=[],observations=[];function check(name,passed,evidence={}){checks.push({name,passed:!!passed,evidence});console.log((passed?'PASS ':'FAIL ')+name);}
(async()=>{let browser;try{
 for(let i=0;i<120;i++){try{if((await fetch(base+'/Login')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 async function actor(name){const c=await browser.newContext({viewport:{width:1366,height:900}});const r=await c.request.get(base+(name==='pos.cashier.qa'?'/apps/zenith/pos/Terminal':'/apps/zenith/Contacts/Customers'),{headers:{Authorization:'Basic '+Buffer.from(name+':moqui').toString('base64')}});const token=(await r.text()).match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)?.[1];if(!token)throw Error('Missing fixture token for '+name);const post=(screen,transition,data={})=>c.request.post(base+'/apps/zenith/pos/'+screen+'/'+transition,{form:{moquiSessionToken:token,...data},maxRedirects:0});const invoke=async(op,data={})=>(await post('PosQaAcceptance','invoke',{op,...data})).json();return{c,token,post,invoke};}
 const admin=await actor('john.doe');if(!q("SELECT * FROM party WHERE party_id='POS_QA_A'").length){const r=await admin.post('PosQaAcceptance','initialize');if(!(await r.json()).initialized)throw Error('Fresh fixture initialization failed');}
 const a=await actor('pos.qa');
 await a.post('SalesMode','createMode',{modeName:'Disposable Drive mode',modeCode:'QADRIVE',priceSource:'PpsFixedProduct',isTaxInclusive:'N',requireCustomer:'N'});
 const foreign=await actor('pos.b.qa');
 await foreign.post('SalesMode','createMode',{modeName:'Foreign disposable Drive mode',modeCode:'QADRIVEB',priceSource:'PpsFixedProduct',isTaxInclusive:'N',requireCustomer:'N'});
 const foreignMode=q("SELECT sales_mode_id FROM pos_sales_mode WHERE mode_code='QADRIVEB'")[0].sales_mode_id;
 await a.post('ProductPricing','saveModeSelection',{modeIds:'RETAIL'});
 const pref=()=>q("SELECT preference_value FROM user_preference WHERE user_id='POS_QA_MANAGER' AND preference_key='POS_PRODUCT_PRICE_MODES_POS_QA_A'")[0]?.preference_value;
 for(const bad of ['',foreignMode,'DOES_NOT_EXIST']){const r=await a.post('ProductPricing','saveModeSelection',{modeIds:bad});const body=await r.json();check('Invalid or foreign mode preference is rejected: '+(bad||'empty'),body.success===false&&pref()==='RETAIL',{status:r.status(),body});}
 const noToken=await a.c.request.post(base+'/apps/zenith/pos/ProductPricing/saveModeSelection',{form:{modeIds:'WHOLESALE'},maxRedirects:0});
 check('Preference write requires CSRF and leaves saved modes intact',noToken.status()===401&&pref()==='RETAIL');
 const getWrite=await a.c.request.get(base+'/apps/zenith/pos/ProductPricing/saveModeSelection?modeIds=WHOLESALE',{maxRedirects:0});
 check('GET cannot mutate the mode preference',!(getWrite.headers()['content-type']||'').includes('application/json')&&pref()==='RETAIL',{status:getWrite.status()});
 const page=await a.c.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const shell of ['apps','qapps']){
  try{
   const url=base+'/'+shell+'/zenith/pos/ProductPricing?modeIds=RETAIL&searchTerm=POS_QA_A_P18';await page.goto(url,{waitUntil:'networkidle'});const root=page.locator('#posProductPricing');await root.waitFor();await page.waitForFunction(()=>window.ZPosProductPricing===true);
   const search=root.locator('[name=searchTerm]');await search.fill('Readable query 123');await search.blur();
   const style=await search.evaluate(e=>{const c=getComputedStyle(e);return{color:c.color,fill:c.webkitTextFillColor,background:c.backgroundColor,opacity:c.opacity}});
   function contrast(fg,bg){function rgb(c){return(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});}function l(c){const r=rgb(c);return .2126*r[0]+.7152*r[1]+.0722*r[2];}const a=l(fg),b=l(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
   check(shell+' POS-05-13 unselected typed search text has readable contrast',contrast(style.fill||style.color,style.background)>=4.5&&Number(style.opacity)===1,{style});await page.screenshot({path:path.join(out,shell+'-search.png'),fullPage:true});
   await page.evaluate(()=>document.body.classList.add('body--dark'));
   const darkStyle=await search.evaluate(e=>{const c=getComputedStyle(e);return{color:c.color,fill:c.webkitTextFillColor,background:c.backgroundColor,opacity:c.opacity}});
   check(shell+' POS-05-13 typed search text remains readable in the supported dark theme class',contrast(darkStyle.fill||darkStyle.color,darkStyle.background)>=4.5&&Number(darkStyle.opacity)===1,{style:darkStyle});
   await page.screenshot({path:path.join(out,shell+'-search-dark.png'),fullPage:true});await page.evaluate(()=>document.body.classList.remove('body--dark'));
   await search.fill('POS_QA_A_P18');const retail=root.locator('tr[data-pid="POS_QA_A_P18"] input[data-mode-id=RETAIL]');await retail.fill('123.45');await page.evaluate(()=>window.posDriveDocumentMarker='keep');
   await root.locator('.pp-mode-picker summary').click();await root.locator('.pp-mode-choice[value=WHOLESALE]').check();await page.waitForLoadState('networkidle');await page.waitForTimeout(400);await root.waitFor();
   check(shell+' POS-05-03 mode change avoids a document reload',await page.evaluate(()=>window.posDriveDocumentMarker==='keep'));
   check(shell+' POS-05-03 mode change retains the unsaved Retail value',await retail.inputValue()==='123.45');
   await page.goto(url,{waitUntil:'networkidle'});await root.waitFor();await root.locator('.pp-mode-picker summary').click();await root.locator('.pp-mode-choice[value=RETAIL]').click();
   check(shell+' POS-05-04 final selected mode stays checked',await root.locator('.pp-mode-choice[value=RETAIL]').isChecked());
   check(shell+' POS-05-04 final-mode removal explains the rule',await root.locator('[role=status],[role=alert]').allTextContents().then(v=>v.some(t=>/at least one.*mode/i.test(t))));
   await require('./pricing-modes.cjs')({page,root,shell,url,a,q,check});
  }catch(e){check(shell+' pricing report verification completes',false,{error:e.stack});await page.screenshot({path:path.join(out,shell+'-error.png'),fullPage:true});}
 }
 if(process.env.POS_DRIVE_PRICING_ONLY==='true')return;
 const session=await a.invoke('open',{terminalId:'POS_QA_A_TERM1',openingCash:'0'});const cart=await a.invoke('cart',{sessionId:session.result.sessionId});const id=cart.result.transactionId;
 const zero=await a.invoke('add',{transactionId:id,productId:'POS_QA_DRIVE_ZERO_STOCK',quantity:'1'});
 check('POS-05-10 configured stock enforcement blocks a zero-stock tracked item',zero.errors.some(e=>/Only 0 .*available/.test(e))&&q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}'`).length===0,{errors:zero.errors});
 const add=await a.invoke('add',{transactionId:id,productId:'POS_QA_A_P18',quantity:'1'});check('Valid positive-price item can still be added',!add.errors.length);
 await page.goto(base+'/apps/zenith/pos/Terminal?sessionId='+session.result.sessionId+'&transactionId='+id+'&taxOn=Y',{waitUntil:'networkidle'});
 const rate=page.locator('.pos-cart input.aj-p').first();await rate.fill('75.50');const sent=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('ajaxCart'));await rate.press('Enter');const response=await sent;await page.waitForTimeout(400);
 const line=q(`SELECT * FROM pos_transaction_item WHERE transaction_id='${id}'`)[0];check('POS-04-07 owner can enter and persist a bill-line rate',Number(line.unit_price)===75.5,{response:response.status(),price:line.unit_price});
 check('POS-04-07 actual rate update produces an override audit entry',q(`SELECT * FROM pos_item_price_override WHERE transaction_id='${id}'`).some(r=>Number(r.new_price)===75.5));
 const cashier=await actor('pos.cashier.qa');const allowed=await cashier.post('Terminal','ajaxCart',{action:'updatePrice',transactionId:id,itemSeqId:line.item_seq_id,newPrice:'75.50',sessionId:session.result.sessionId});const allowedBody=await allowed.json();
 check('POS-04-07 configured cashier POS write grant remains valid',allowedBody.success===true&&Number(q(`SELECT unit_price FROM pos_transaction_item WHERE transaction_id='${id}'`)[0].unit_price)===75.5);
 await require('./rate-overrides.cjs')({a,cashier,foreign,page,session,id,line,q,check});
 await require('./role-overrides.cjs')({admin,a,actor,q,check,base});
 observations.push({report:'POS-05-10',note:'Shop A enforcement is enabled in the fixture. Production report provides no enforcement flag/facility policy. Legacy opt-out behavior is intentional and is not changed.'},{report:'POS-04-09',note:'Current model/test suite deliberately supports free products. Zero-price policy decision is pending; no production rule changed.'});
 check('Browser has no JavaScript exceptions',errors.length===0,{errors});
 }catch(e){check('Drive report verifier completes',false,{error:e.stack});}
 finally{if(browser)await browser.close();const data={productionAccess:false,checks,observations,failures:checks.filter(c=>!c.passed)};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(data,null,2));console.log(JSON.stringify({checks:checks.length,failures:data.failures.length}));if(data.failures.length)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1});
