const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const base=process.env.UI_REFERENCE_BASE||'http://127.0.0.1:18085',u=new URL(base);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='18085')throw Error('Disposable loopback only');
const suite='shops',out=path.resolve(process.env.UI_REFERENCE_OUT||'work/'+suite+'-reference-results');fs.mkdirSync(out,{recursive:true});const checks=[];
function check(n,ok){checks.push({name:n,passed:!!ok});if(!ok)throw Error(n)}
const org=suite==='shops'?'SHOPQA':'MYSUBQAA',user=process.env.UI_REFERENCE_USERNAME,pw=process.env.UI_REFERENCE_PASSWORD;
if(!user||!pw||!process.env.UI_REFERENCE_ADMIN_PASSWORD)throw Error('Fixture credentials required');
const helper=suite==='shops'?'/apps/zenith/Stores/ShopsQaAcceptance':'/apps/zenith/my-subscription/MySubscriptionQa';
(async()=>{let b;try{
 for(let n=0;n<120;n++){try{if((await fetch(base+'/Login')).status===200)break}catch{}await new Promise(r=>setTimeout(r,1000));}
 b=await chromium.launch({headless:true,executablePath:process.env.UI_REFERENCE_CHROME});
 const admin=await b.newContext();await admin.request.post(base+'/Login/login',{form:{username:'john.doe',password:process.env.UI_REFERENCE_ADMIN_PASSWORD},maxRedirects:0});
 const raw=await(await admin.request.get(base+helper)).text();let token=raw.match(/name="moquiSessionToken"[^>]*value="([^"]+)"/)?.[1];if(suite==='mysub')token=(await(await admin.request.get(base+helper+'/token')).json()).token;
 if(!process.env.UI_REFERENCE_SKIP_INIT){const init=await(await admin.request.post(base+helper+'/initialize',{form:{moquiSessionToken:token}})).json();check('Fresh synthetic fixture initialization',init.initialized)}
 const c=await b.newContext({viewport:{width:1440,height:1000}});const login=await c.request.post(base+'/Login/login',{form:{username:user,password:pw,organizationId:org},maxRedirects:0});check('Native organization login',login.status()===302);
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const shell of ['apps','qapps']){
  const route=suite==='shops'?'Stores/FindStore':'my-subscription';await p.goto(base+'/'+shell+'/zenith/'+route,{waitUntil:'networkidle'});await p.locator(suite==='shops'?'.shops-reference-list':'.mysub-wrap').waitFor();await p.evaluate(()=>document.fonts.ready);
  check(shell+' registered scoped stylesheet',await p.locator('link[href*="'+(suite==='shops'?'shops-reference':'my-subscription-reference')+'.css?v=1"]').count()>0);
  await p.screenshot({path:path.join(out,shell+'-desktop.png'),fullPage:true});
   check(shell+' no duplicate replacement toolbar',await p.locator('.zc-shops-page .zlc-search:visible,.zc-shops-page .zlc-ph').count()===0);
   const find=p.getByRole('button',{name:/Find Options/});check(shell+' native filter visible',await find.isVisible());await find.click();
   await p.screenshot({path:path.join(out,shell+'-filters.png'),fullPage:true});
   fs.writeFileSync(path.join(out,shell+'-filter-dom.html'),await p.content());
   const dialog=p.locator(shell==='apps'?'.modal:visible':'.q-dialog');await dialog.locator('input[name="storeName"]').fill('NO_MATCH_UI_QA');await dialog.locator('[type=submit]').click();await p.waitForLoadState('networkidle');await p.waitForFunction(()=>!document.querySelector('.shops-reference-list')?.innerText.includes('Synthetic Shop A1'));
   check(shell+' native search applies on server',await p.locator('.shops-reference-list').innerText().then(t=>!t.includes('Synthetic Shop A1')));
   const emptyLink=p.getByRole('link',{name:'CSV',exact:true});const emptyCsv=await(await c.request.get(await emptyLink.getAttribute('href'))).text();check(shell+' empty filtered CSV keeps headers',emptyCsv.includes('Store')&&!emptyCsv.includes('Synthetic Shop A1'));
   await p.goto(base+'/'+shell+'/zenith/Stores/FindStore',{waitUntil:'networkidle'});
   const csv=await(await c.request.get(await p.getByRole('link',{name:'CSV',exact:true}).getAttribute('href'))).text();check(shell+' native CSV uses tenant-scoped rows',csv.includes('Synthetic Shop A1')&&!csv.includes('Synthetic Shop B'));
   const order=p.locator('.shops-reference-list a[href*="orderByField="]').first();await order.click();await p.waitForURL(/orderByField=/);await p.waitForLoadState('networkidle');check(shell+' native sort works',p.url().includes('orderByField='));
   await p.locator('.zlc-pp').selectOption('25');await p.waitForURL(/pageSize=25/);await p.waitForLoadState('networkidle');check(shell+' existing page-size control retained',await p.locator('.zlc-pp').inputValue()==='25');await p.getByRole('button',{name:/Columns/}).click();await p.screenshot({path:path.join(out,shell+'-columns.png'),fullPage:true});if(shell==='apps')await p.locator('.modal:visible button.close').click();else await p.keyboard.press('Escape');
   await p.getByRole('button',{name:/New Store/}).click();check(shell+' new store focuses name',await p.locator('#ns-name').evaluate(e=>e===document.activeElement));check(shell+' new store required validation',await p.locator('#ns-modal').evaluate(e=>!e.checkValidity()));await p.keyboard.press('Escape');check(shell+' new store Escape closes',await p.locator('#ns-overlay').isHidden());
   await p.goto(base+'/'+shell+'/zenith/Stores/EditStore?storeId=SHOP_QA_A_S1',{waitUntil:'networkidle'});await p.locator('#tab-details').waitFor();
   for(const tab of ['counters','hours','targets','holidays','details']){await p.locator('#tab-'+tab).click();check(shell+' working '+tab+' tab',await p.locator('#panel-'+tab).isVisible());}
   await p.locator('#tab-hours').click();const t=p.locator('.st-tgl').first();const state=await t.getAttribute('aria-checked');await t.click();check(shell+' hours toggle changes',await t.getAttribute('aria-checked')!==state);await t.click();check(shell+' hours toggle restored',await t.getAttribute('aria-checked')===state);
   await p.screenshot({path:path.join(out,shell+'-hours.png'),fullPage:true});
  for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});await p.goto(base+'/'+shell+'/zenith/'+route,{waitUntil:'networkidle'});await p.locator(suite==='shops'?'.shops-reference-list':'.mysub-wrap').waitFor();if(shell==='qapps'&&suite==='shops')check(shell+' '+width+' module tabs below toolbar',await p.evaluate(()=>document.querySelector('#zq-subnav').getBoundingClientRect().top>=document.querySelector('.q-header').getBoundingClientRect().bottom-1));check(shell+' '+width+' page contained',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.screenshot({path:path.join(out,shell+'-'+width+'.png'),fullPage:true});if(width===390&&suite==='shops'){await p.getByRole('button',{name:/New Store/}).click();check(shell+' mobile new store fits',await p.locator('#ns-modal').evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0));await p.getByRole('button',{name:'Cancel',exact:true}).click();}}
 }
 check('No browser JavaScript exceptions',errors.length===0);
}finally{if(b)await b.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({suite,productionWrites:false,checks},null,2));console.log(JSON.stringify({suite,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed)}));}})().catch(e=>{console.error(e.stack);process.exitCode=1});
