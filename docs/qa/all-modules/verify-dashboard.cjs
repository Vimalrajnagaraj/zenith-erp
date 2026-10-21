const openAudit=require('./client.cjs');
(async()=>{
 const x=await openAudit(),{b,q,check,base}=x;const page=await b.ctx.newPage();
 const pref=key=>q(`SELECT preference_value FROM user_preference WHERE user_id='AUDIT_QA_USER_B' AND preference_key='${key}'`)[0]?.preference_value||'';
 try{
  for(const shell of ['apps','qapps']){
   await b.post('Dashboard/resetDashLayout',{});
   const route=base+'/'+shell+'/zenith/Dashboard';
   await page.goto(route+'?showSettings=1',{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Move down kpis',exact:true}).waitFor();
   const before=await page.locator('.dash-widget').evaluateAll(nodes=>nodes.map(n=>n.dataset.wkey));
   await page.getByRole('button',{name:'Move down kpis',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#homeLayoutStatus')?.textContent==='Layout saved.');
   const order=await page.locator('.dash-widget').evaluateAll(nodes=>nodes.map(n=>n.dataset.wkey));
   check(shell+' Dashboard move button changes and persists section order',JSON.stringify(order)!==JSON.stringify(before)&&pref('HOME_DASH_ORDER')===order.join(','));
   await page.getByRole('button',{name:'Resize kpis',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[data-wkey=kpis]')?.dataset.size==='half'&&document.querySelector('#homeLayoutStatus')?.textContent==='Layout saved.');
   check(shell+' Dashboard resize persists half width',pref('HOME_DASH_SIZE').includes('kpis:half'));
   await page.reload({waitUntil:'networkidle'});
   check(shell+' Dashboard layout survives reload',await page.locator('[data-wkey=kpis]').getAttribute('data-size')==='half'&&JSON.stringify(await page.locator('.dash-widget').evaluateAll(nodes=>nodes.map(n=>n.dataset.wkey)))===JSON.stringify(order));
   const form=page.locator('#DashLayoutForm');
   await form.getByRole('checkbox').first().uncheck();
   await form.getByRole('button',{name:/Save Layout/}).click();
   await page.waitForFunction(()=>!document.querySelector('[data-wkey=insights]'));
   check(shell+' Dashboard Save Layout hides selected section and persists',pref('HOME_DASH_HIDDEN').split(',').includes('insights'));
   await page.goto(route+'?showSettings=1',{waitUntil:'networkidle'});
   await page.getByText('Reset to Default',{exact:true}).click();
   await page.waitForFunction(()=>!!document.querySelector('[data-wkey=insights]'));
   check(shell+' Dashboard reset restores sections and clears personal order and sizes',!pref('HOME_DASH_HIDDEN')&&!pref('HOME_DASH_ORDER')&&!pref('HOME_DASH_SIZE'));
   await page.goto(route+'?dashDate=2026-10-20&dashDateTo=2026-10-01',{waitUntil:'networkidle'});
   const config=await page.locator('#homeDashboard').evaluate(e=>JSON.parse(e.dataset.config));
   check(shell+' Dashboard normalizes reversed date range and renders bounded chart',config.weekly.cats.length===20&&config.weekly.sub==='2026-10-01 to 2026-10-20'&&await page.locator('#homeActivityChart svg').count()===1);
  }
 }catch(error){check('Dashboard native controls complete',false,{error:error.stack});}
 finally{await b.post('Dashboard/resetDashLayout',{});await page.close();await x.finish('dashboard.json');}
})().catch(e=>{console.error(e);process.exitCode=1;});
