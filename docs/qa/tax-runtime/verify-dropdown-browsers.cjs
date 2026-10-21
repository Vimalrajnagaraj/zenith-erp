/* Run after acceptance.py initializes its disposable fixtures. No registration is submitted. */
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=(process.env.TAX_QA_BASE||'http://localhost:8087').replace(/\/$/,'');
const target=new URL(base);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||!['8080','8087'].includes(target.port))throw Error('Disposable loopback only');
const out=process.env.TAX_QA_OUT||'/tmp/zenith-tax-dropdowns';fs.mkdirSync(out,{recursive:true});
const results=[];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{
    for(const name of (process.env.TAX_QA_BROWSERS||'chrome,edge,webkit').split(',')) {
        assert(['chrome','edge','webkit'].includes(name),'Unknown browser');
        const browser=await (name==='webkit'?webkit:chromium).launch({headless:true,...(name==='webkit'?{}:{channel:name==='edge'?'msedge':'chrome'})});
        try {
            const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
            const response=await context.request.get(base+'/apps/zenith/tax/FindTaxRegistration',{
                headers:{Authorization:'Basic '+Buffer.from('tax.qa:moqui').toString('base64')}});
            assert(response.status()===200,'Authenticated disposable Tax fixtures required');
            const p=await context.newPage(),errors=[],resizeNotifications=[],writes=[];
            p.on('pageerror',error=>{
                // WebKit also reports this browser delivery notification with the
                // original CSS during viewport changes. Preserve it in evidence;
                // actual script exceptions still fail this regression.
                if(error.message==='ResizeObserver loop completed with undelivered notifications.')resizeNotifications.push(error.message);
                else errors.push(error.message);
            });
            p.on('request',request=>{if(request.method()==='POST'&&/\/(create|update|delete)TaxRegistration/.test(request.url()))writes.push(request.url());});
            const page={setViewport:v=>p.setViewportSize(v),evaluate:(...args)=>p.evaluate(...args),$eval:(...args)=>p.$eval(...args),
                click:selector=>p.locator(selector).click(),hover:selector=>p.locator(selector).hover(),focus:selector=>p.locator(selector).focus(),
                waitForSelector:(selector,options)=>p.locator(selector).waitFor({state:options?.visible?'visible':'attached'}),
                screenshot:options=>p.screenshot(options),keyboard:p.keyboard};
            const folder=path.join(out,name);fs.mkdirSync(folder,{recursive:true});
            const open=async url=>{const r=await p.goto(base+url,{waitUntil:'networkidle'});assert(r.status()===200,'HTTP '+r.status());};
            const record=async(test,fn)=>{
                try {results.push({browser:name,version:browser.version(),test,passed:true,evidence:await fn()});console.log('PASS '+name+' '+test);}
                catch(error){results.push({browser:name,test,passed:false,error:error.message});console.log('FAIL '+name+' '+test+': '+error.message);}
                fs.writeFileSync(path.join(out,'dropdown-browsers.json'),JSON.stringify(results,null,2));
            };
            for(const shell of ['apps','qapps'])await require('./verify-dropdowns.cjs')({page,record,open,assert,out:folder,shell});
            await record('no registration writes or unhandled script exceptions',async()=>{
                assert(!writes.length&&!errors.length,JSON.stringify({writes,errors}));
                return {writes:0,scriptExceptions:0,resizeNotifications};
            });
            await p.waitForLoadState('networkidle');await context.close();
        } finally {await browser.close();}
    }
    console.log(JSON.stringify({checks:results.length,failures:results.filter(r=>!r.passed).length}));
    if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
