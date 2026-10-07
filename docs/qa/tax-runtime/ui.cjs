/* Disposable runtime only. Uses the same Puppeteer dependency as existing staging acceptance. */
const puppeteer=require('puppeteer');
const {mkdirSync,writeFileSync}=require('node:fs');
const base=(process.env.TAX_QA_BASE||'http://localhost:8087').replace(/\/$/,'');
const url=new URL(base);
if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||!['8080','8087'].includes(url.port))throw Error('Disposable loopback only');
const out=process.env.TAX_QA_OUT||'/tmp/zenith-tax-qa/results';mkdirSync(out,{recursive:true});
const results=[];let browser,page;
async function record(name,fn){try{const detail=await fn();results.push({case:name,passed:true,detail});console.log('PASS '+name);}catch(e){results.push({case:name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message);}writeFileSync(out+'/ui.json',JSON.stringify(results,null,2));}
function assert(ok,message){if(!ok)throw Error(message);}
async function open(path){const target=new URL(path,base);assert(target.origin===new URL(base).origin,'Same-origin UI route required');const response=await page.goto(target.href,{waitUntil:'networkidle2',timeout:60000});assert(response.status()===200,'HTTP '+response.status());await page.waitForSelector('.zc-tax-page',{timeout:15000});assert(!/Internal Server Error|Error rendering screen/.test(await page.$eval('body',e=>e.innerText)),'Screen error');}
async function select(id,value){await page.select(id,value);}
async function fill(id,value){await page.$eval(id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);}
async function clickText(selector,text){const es=await page.$$(selector);for(const e of es)if((await e.evaluate(x=>x.textContent)).includes(text)){await e.click();return;}throw Error('Missing '+text);}
async function submit(id){await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:60000}),page.click(id)]);}
(async()=>{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();
 const res=await fetch(base+'/apps/zenith',{headers:{Authorization:'Basic '+Buffer.from('tax.qa:moqui').toString('base64')},redirect:'manual'});const cookie=res.headers.getSetCookie().find(c=>c.startsWith('JSESSIONID='));await res.text();assert(res.status===200&&cookie,'Authenticated disposable session required');await page.setCookie({name:'JSESSIONID',value:cookie.split(';')[0].slice(11),url:base,httpOnly:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 for(const shell of ['apps','qapps']){
  for(const screen of ['TaxDashboard','FindTaxRate','FindTaxAuthority','FindTaxRegistration','FindTaxExemption','Gstr1Returns','TaxEngines']){
   await record(`${shell}/${screen} render + responsive`,async()=>{
    await page.setViewport({width:1366,height:900});await open(`/${shell}/zenith/tax/${screen}`);
    const rows=[];for(const width of [1920,1366,800,390,320]){
     await page.setViewport({width,height:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,content:document.querySelector('.zc-tax-page').getBoundingClientRect().width}));rows.push(size);
     assert(size.document<=size.viewport+1,'Horizontal page overflow: '+JSON.stringify(size));
    }
    assert(!await page.$eval('body',e=>e.innerText.includes('FOREIGN_SENTINEL_DO_NOT_EXPOSE')),'Foreign data leaked');
    return rows;
   });
  }
  await page.setViewport({width:1366,height:900});
  await record(shell+' registration country-region and native create',async()=>{
   await open(`/${shell}/zenith/tax/FindTaxRegistration`);await clickText('button','New Registration');await page.waitForSelector('#nr-party',{visible:true});
   await page.waitForSelector('#nr-country[data-ready="true"]',{timeout:15000});await select('#nr-country','AUS');await page.waitForFunction(()=>!document.querySelector('#nr-region').disabled&&document.querySelector('#nr-region').options.length>1);
   assert(await page.$eval('#nr-region',e=>!Array.from(e.options).some(o=>['27','29'].includes(o.value))),'Old India regions retained after initialized country change');
   await select('#nr-country','IND');await page.waitForFunction(()=>Array.from(document.querySelector('#nr-region').options).some(o=>o.value==='29'));
   await select('#nr-party','TAX_QA_UI_CUST');await select('#nr-auth','TAX_QA_AUTH');await select('#nr-regtype','TrtGstin');await select('#nr-region','29');await fill('#nr-regnumber','29ABCDE1234F2ZV');
   await page.screenshot({path:out+'/'+shell+'-registration-desktop.png',fullPage:false});await page.setViewport({width:390,height:844});await page.screenshot({path:out+'/'+shell+'-registration-mobile.png',fullPage:false});await page.setViewport({width:1366,height:900});
   // Second shell uses a different valid registration type to test both POST routes without duplicate GSTIN.
   if(shell==='qapps'){await select('#nr-regtype','TrtPan');await fill('#nr-regnumber','ABCDE1234F');}
   await submit('#nr-create');await page.waitForFunction(()=>document.body.innerText.includes('Synthetic UI Customer'),{timeout:15000});
   return {nativePost:true,countryRegion:true};
  });
  await record(shell+' registration edit persists safe text',async()=>{
   await open(`/${shell}/zenith/tax/FindTaxRegistration`);if(shell==='qapps')await page.waitForFunction(()=>document.querySelectorAll('a[id*="_registrationId_"]').length>=3,{timeout:15000});
   const href=await page.$$eval('a[href*="EditTaxRegistration"]',(a,shell)=>a.filter(e=>shell==='qapps'?e.id.includes('_registrationId_'):e.closest('tr')?.textContent.includes('29ABCDE1234F2ZV')).map(e=>e.getAttribute('href')).filter(h=>Number.isFinite(Number(new URL(h,location.origin).searchParams.get('registrationId')))).sort((x,y)=>Number(new URL(y,location.origin).searchParams.get('registrationId'))-Number(new URL(x,location.origin).searchParams.get('registrationId')))[0],shell);assert(href,'New contact registration edit link');await open(href);
   await fill('.zc-tax-form [name=description]',"Synthetic UI O'Brien edited");
   const button=await page.$('.zc-tax-form button[type=submit]');assert(button,'Edit button');await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),button.click()]);
   assert(await page.$eval('.zc-tax-form [name=description]',e=>e.value==="Synthetic UI O'Brien edited"),'Description did not persist');assert(!await page.$('.zc-tax-form img[src="x"]'),'XSS markup executed');
  });
  await record(shell+' exemption filter and native create/edit',async()=>{
   await open(`/${shell}/zenith/tax/FindTaxExemption`);await fill('#te-search','NO_MATCH_SYNTHETIC');assert(await page.$eval('#te-count',e=>e.textContent.includes('of 0 matching')),'No-match count');await fill('#te-search','');
   await select('#te-status','Inactive');assert(await page.$eval('#te-count',e=>e.textContent.includes('of 0 matching')),'Inactive filter');await select('#te-status','');
   await clickText('button','Add New Exemption');await page.waitForSelector('#te-party',{visible:true});await select('#te-party','TAX_QA_UI_CUST');await select('#te-auth','TAX_QA_AUTH');await select('#te-type','TexFull');await fill('#te-number','TAX_QA_UI_'+shell);await submit('#te-create');
   assert(await page.$eval('body',(e,n)=>e.innerText.includes(n),'TAX_QA_UI_'+shell),'Exemption not displayed');
   await open(`/${shell}/zenith/tax/FindTaxExemption`);const href=await page.$$eval('a[href*="editTaxExemption"]',(a,n)=>a.filter(e=>e.closest('tr')?.textContent.includes(n)).map(e=>e.getAttribute('href'))[0],'TAX_QA_UI_'+shell);assert(href,'Exemption edit link');await open(href);await fill('.zc-tax-form [name=description]','Synthetic exemption edited');const button=await page.$('.zc-tax-form button[type=submit]');await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),button.click()]);assert(await page.$eval('.zc-tax-form [name=description]',e=>e.value==='Synthetic exemption edited'),'Exemption edit failed');
  });
  await record(shell+' CSRF and foreign edit denied',async()=>{
   await open(`/${shell}/zenith/tax/FindTaxRegistration`);
   const response=await page.evaluate(async()=>{const r=await fetch(location.pathname+'/createTaxRegistration',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'partyId=TAX_QA_UI_CUST&registrationNumber=NO_CSRF'});return {status:r.status,text:await r.text()};});assert(response.status===403||/session token|SessionToken|CSRF|security token/i.test(response.text),'Missing CSRF did not fail clearly');
   await page.goto(base+`/${shell}/zenith/tax/EditTaxRegistration?registrationId=TAX_QA_REG_B`,{waitUntil:'networkidle2'});assert(!await page.$('.zc-tax-form'),'Foreign edit form available');assert(!await page.$eval('body',e=>e.innerText.includes('Foreign Tax Sentinel')),'Foreign identity leaked');
  });
 }

 for(const shell of ['apps','qapps']) {
  for(const [screen,label] of [['Gstr2Report','Tax Summary'],['Gstr3bReport','Table 3.1']]) await record(shell+' '+screen+' results survive redirect',async()=>{
   const response=await page.goto(base+`/${shell}/zenith/Accounting/${screen}/generate${screen==='Gstr2Report'?'Gstr2':'Gstr3b'}?organizationPartyId=TAX_QA_A&returnPeriod=072026`,{waitUntil:'networkidle2',timeout:60000});
   await page.waitForFunction(label=>document.body.innerText.includes(label)&&document.body.innerText.includes('12.00'),{timeout:15000},label);const text=await page.$eval('body',e=>e.innerText);assert(response.status()===200&&!text.includes('Internal Server Error'),'Report render');assert(text.includes(label)&&text.includes('12.00'),'Expected result and CESS absent after redirect');
  });
  await record(shell+' saved GSTR1 detail and scoped download',async()=>{
   await open(`/${shell}/zenith/tax/Gstr1Returns`);await select('#gstr1-period','072026');assert(await page.$eval('#gstr1-fy',e=>e.disabled&&e.value==='2026-2027'),'Derived financial year');await submit('#gstr1-gen');
   const href=await page.$$eval('a[href*="filingId="]',es=>es.find(e=>!e.href.includes('downloadGstr1Json'))?.getAttribute('href'));assert(href,'Saved filing link');await open(href);
   const text=await page.$eval('body',e=>e.innerText);assert(!text.includes('Internal Server Error')&&text.includes('072026'),'Saved filing details');
   const id=new URL(page.url()).searchParams.get('filingId');const data=await page.evaluate(async endpoint=>{const r=await fetch(endpoint);return {status:r.status,payload:await r.json()};},base+`/${shell}/zenith/tax/Gstr1Returns/downloadGstr1Json?filingId=${encodeURIComponent(id)}`);
   assert(data.status===200&&data.payload.fp==='072026'&&data.payload.b2b.length===1,'Draft JSON payload');
  });
 }
 await record('Browser JavaScript errors',async()=>{assert(errors.length===0,errors.join(' | '));return errors;});
 await browser.close();const failed=results.filter(r=>!r.passed);console.log(`${results.length-failed.length}/${results.length} UI cases passed`);if(failed.length)process.exitCode=1;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
