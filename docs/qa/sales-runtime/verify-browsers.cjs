// Read-only spot checks against the disposable runtime after the full acceptance pass.
const fs=require('fs'),path=require('path');
const {chromium,firefox,webkit}=require('playwright');
const base=process.env.SALES_QA_BASE||'http://127.0.0.1:18083';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Disposable loopback URL required');
const out=process.env.SALES_QA_OUT; if(!out)throw Error('Evidence directory required');
fs.mkdirSync(out,{recursive:true});
const screens=['SalesDashboard','FindQuotation','FindOrder','FindInvoice','FindCreditNote','FindDeliveryChallan','CreateQuotation','CreateOrder','CreateInvoice','CreateCreditNote','CreateDeliveryChallan','WarrantyPolicies','Commissions','SalesForecast','EditInvoice?invoiceId=SALES_QA_CN','EditQuotation?orderId=SALES_QA_ORDER','EditOrder?orderId=SALES_QA_ORDER','EditCreditNote?invoiceId=SALES_QA_CN','EditDeliveryChallan?challanId=SALES_QA_DC_A'];
const report={productionAccess:false,checks:[],failures:[],engines:[]};
(async()=>{
 for(const [name,engine,options] of [['Chrome',chromium,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}],['Edge',chromium,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}],['Firefox',firefox,{}],['WebKit',webkit,{}]]){
  if(process.env.SALES_QA_ENGINES&&!process.env.SALES_QA_ENGINES.split(',').includes(name))continue;
  const browser=await engine.launch({headless:true,...options});
  try{
   const ctx=await browser.newContext(),login=await ctx.request.get(base+'/apps/zenith/sales/FindInvoice',{headers:{Authorization:'Basic '+Buffer.from('sales.qa:moqui').toString('base64')}});
   if(login.status()!==200)throw Error(name+' login failed');
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   for(const shell of ['apps','qapps'])for(const width of [1366,360])for(const screen of screens){
    await p.setViewportSize({width,height:1000});
    const r=await p.goto(`${base}/${shell}/zenith/sales/${screen}`,{waitUntil:'networkidle',timeout:60000});
    const text=await p.locator('body').innerText();
    const toggle=p.locator('.q-header .q-toolbar>button:first-child');
    if(shell==='qapps'&&width<900&&await toggle.count()&&await p.locator('body').evaluate(e=>e.classList.contains('zq-side-open')))await toggle.click();
    const geometry=await p.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,scopes:document.querySelectorAll('.z-sales-page').length,overflow:[...document.querySelectorAll('.z-sales-page input,.z-sales-page select,.z-sales-page button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+2||r.left<-2)&&!e.closest('.z-sales-table,.table-responsive,.q-table__middle,.q-table__container,.table-scroll-wrapper,.modal')}).map(e=>e.name||e.id)}));
    const passed=r.status()===200&&!/Error rendering|ScreenRenderException|HTTP Status 500|No entity found|Ambiguous method/.test(text)&&geometry.document<=width+2&&geometry.scopes>0&&geometry.overflow.length===0;
    report.checks.push({browser:name,shell,screen,width,status:r.status(),passed,geometry});
    if(!passed)report.failures.push({browser:name,shell,screen,width,geometry});
    if(['FindInvoice','CreateOrder'].includes(screen))await p.screenshot({path:path.join(out,`${name}-${shell}-${screen}-${width}.png`),fullPage:true});
   }
   if(errors.length)report.failures.push({browser:name,errors});
   report.engines.push({browser:name,version:browser.version(),pageErrors:errors});
   await ctx.close();console.log(name+' Sales layouts complete');
  }finally{await browser.close();fs.writeFileSync(path.join(out,'browsers.json'),JSON.stringify(report,null,2));}
 }
 if(report.failures.length)throw Error(report.failures.length+' browser checks failed');
 console.log(JSON.stringify({checks:report.checks.length,failures:0,engines:report.engines}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
