const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const base = process.env.CGQA_BASE_URL || 'http://127.0.0.1:18080';
const u = new URL(base);
if (!['127.0.0.1','localhost'].includes(u.hostname) || u.port !== '18080') throw new Error('This QA is restricted to the isolated loopback Moqui server on port 18080');
const outDir = process.env.CGQA_OUTPUT_DIR ? path.resolve(process.env.CGQA_OUTPUT_DIR) : path.join(__dirname, 'evidence');
fs.mkdirSync(outDir, {recursive:true});
const report = { startedAt:new Date().toISOString(), base, checks:[], viewports:[], requests:[], pageErrors:[], fixtureIds:['CGQA_EMPTY_A','CGQA_POPULATED_A','CGQA_FOREIGN_B','CITEST_A_CUST','CITEST_B_CUST'] };
const terms = 'QA custom terms / 23 days';
const description = 'Disposable local UI QA description.';
let currentPage, browser;
function check(name, ok, detail) {
  report.checks.push({name, pass:!!ok, ...(detail===undefined?{}:{detail})});
  if (!ok) throw new Error(name + (detail===undefined?'':': '+JSON.stringify(detail)));
}
function queryState() {
  if (process.env.CGQA_POSTGRES_CONTAINER) {
    const cid=process.env.CGQA_POSTGRES_CONTAINER;
    const label=spawnSync('docker',['inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}',cid],{encoding:'utf8',timeout:10000});
    if(label.status!==0 || label.stdout.trim()!=='zenith-pr20-qa') throw new Error('Disposable PostgreSQL project label required');
    const sql=fs.readFileSync(path.join(__dirname,'postgres-state.sql'),'utf8');
    const r=spawnSync('docker',['exec',cid,'psql','-U','moqui','-d','moqui','-v','ON_ERROR_STOP=1','-tAc',sql],{encoding:'utf8',timeout:30000});
    if(r.status!==0) throw new Error('Read-only PostgreSQL fixture probe failed');
    return JSON.parse(r.stdout.trim());
  }
  if (!process.env.CGQA_DB_URL) throw new Error('CGQA_DB_URL is required for database truth before any UI writes');
  if (!process.env.CGQA_H2_JAR && !process.env.CGQA_RUNTIME_DIR) throw new Error('Set CGQA_RUNTIME_DIR or CGQA_H2_JAR for the isolated runtime');
  const h2 = process.env.CGQA_H2_JAR || path.join(process.env.CGQA_RUNTIME_DIR,'WEB-INF','lib','h2-2.4.240.jar');
  if (!/^jdbc:h2:tcp:\/\/(127\.0\.0\.1|localhost):19092\//.test(process.env.CGQA_DB_URL)) throw new Error('Only the isolated loopback H2 TCP port 19092 is allowed');
  const java = process.env.CGQA_JAVA || 'java';
  const dbUrl = process.env.CGQA_DB_URL + (process.env.CGQA_DB_URL.toUpperCase().includes('IFEXISTS=')?'':';IFEXISTS=TRUE');
  const result = spawnSync(java,['-cp',h2,path.join(__dirname,'GroupDbProbe.java'),dbUrl,process.env.CGQA_DB_USER || 'sa',process.env.CGQA_DB_PASSWORD || ''],{encoding:'utf8',timeout:30000,windowsHide:true});
  if (result.status!==0) throw new Error('Read-only fixture DB probe failed: '+(result.stderr||result.error?.message||'').slice(0,1200));
  return JSON.parse(result.stdout.trim());
}
const activeMembers = (s,id) => s.members.filter(m=>m.group===id && !m.thruDate);
const group = (s,id='CGQA_EMPTY_A') => s.groups.find(g=>g&&g.id===id);
async function waitState(predicate) {
  let s;
  for (let i=0;i<8;i++) {s=queryState(); if(predicate(s)) return s; await new Promise(r=>setTimeout(r,400));}
  return s;
}
async function openGroup(page,shell,id='CGQA_EMPTY_A') {
  await page.goto(`${base}/${shell}/zenith/Contacts/EditCustomerGroup?customerGroupId=${id}`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.zecg-page').waitFor({state:'visible',timeout:60000});
  await page.locator('.zecg-form [name="groupName"]').waitFor({state:'visible'});
  await page.waitForTimeout(700);
}
async function toggleActive(page,shell,key) {
  const t = page.locator(shell==='apps'?'.zecg-page .cg-toggle':'.zecg-page .zecg-active-toggle');
  await t.waitFor({state:'visible'});
  if (key) {await t.focus(); await t.press(key);} else await t.click();
  await page.waitForTimeout(150);
  return t;
}
async function submit(page) {
  const request = page.waitForRequest(r=>r.method()==='POST' && r.url().includes('/EditCustomerGroup/updateGroup'),{timeout:15000});
  await page.locator('.zecg-form button[type="submit"], .zecg-form input[type="submit"]').click();
  const req=await request;
  const contentType = req.headers()['content-type'] || '';
  let body = new URLSearchParams();
  if(contentType.includes('multipart/form-data')) {
    const boundary = contentType.match(/boundary=([^;]+)/)?.[1].replace(/^"|"$/g,'');
    for(const part of (req.postDataBuffer()?.toString('utf8')||'').split('--'+boundary)) {
      const name=part.match(/name="([^"]+)"/)?.[1]; const split=part.indexOf('\r\n\r\n');
      if(name && split>=0) body.set(name,part.slice(split+4).replace(/\r\n$/,''));
    }
  } else body = new URLSearchParams(req.postData()||'');
  report.requests.push({action:'updateGroup',fields:{customerGroupId:body.get('customerGroupId'),isActive:body.get('isActive'),paymentTerms:body.get('paymentTerms')}});
  await page.waitForTimeout(1200);
  return body;
}
async function geometry(page,width,shell,id) {
  const g = await page.evaluate(()=>{
    const root=document.querySelector('.zecg-page');
    const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    const names=['.zecg-details','.zecg-summary','.zecg-members','.zecg-back','.zecg-title'];
    const boxes=Object.fromEntries(names.map(s=>[s,r(root.querySelector(s))]));
    const overflows=[...root.querySelectorAll('input:not([type="hidden"]),textarea,select,.q-field,.zecg-card,.zecg-back a')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').filter(e=>e.getBoundingClientRect().right>root.getBoundingClientRect().right+2 || e.getBoundingClientRect().left<root.getBoundingClientRect().left-2).map(e=>({tag:e.tagName,name:e.name||'',class:e.className}));
    const title=getComputedStyle(root.querySelector('.zecg-title'));
    const submit=root.querySelector('button[type="submit"], input[type="submit"]'), add=root.querySelector('.zecg-add-trigger');
    const sw=root.querySelector('.q-toggle__inner--truthy');
    const styles={submitBg:submit?getComputedStyle(submit).backgroundColor:null,addBg:add?getComputedStyle(add).backgroundColor:null,addColor:add?getComputedStyle(add).color:null,activeOnColor:sw?getComputedStyle(sw).color:null,
      inputBorders:[...root.querySelectorAll('.q-field input.q-field__native,.q-field input.q-field__input')].filter(e=>e.getBoundingClientRect().width).map(e=>getComputedStyle(e).borderTopWidth)};
    const more=[...document.querySelectorAll('.zc-morenav')].map(e=>{
      const ancestors=[];let p=e;for(let i=0;i<6&&p;i++,p=p.parentElement)ancestors.push({tag:p.tagName,id:p.id,class:p.className});
      return {text:e.querySelector('summary')?.textContent.trim().replace(/\s+/g,' '),visible:!!e.getBoundingClientRect().width,ancestors};
    });
    return {root:r(root),boxes,overflows,titleFont:title.fontSize,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,styles,more};
  });
  check(`${shell} ${id} ${width}: no page/control overflow`,g.overflows.length===0&&g.scrollWidth<=g.clientWidth+2,g);
  check(`${shell} ${id} ${width}: compact title`,parseFloat(g.titleFont)<=21,g.titleFont);
  check(`${shell} ${id} ${width}: reference header hides More`,g.more.every(m=>!m.visible),g.more);
  check(`${shell} ${id} ${width}: Update Group filled purple`,g.styles.submitBg==='rgb(117, 67, 232)',g.styles);
  check(`${shell} ${id} ${width}: Add Member white/purple`,g.styles.addBg==='rgb(255, 255, 255)'&&g.styles.addColor==='rgb(116, 85, 187)',g.styles);
  if(shell==='qapps') {
    check(`${shell} ${id} ${width}: native inputs have no inner border`,g.styles.inputBorders.every(v=>v==='0px'),g.styles);
    if(g.styles.activeOnColor) check(`${shell} ${id} ${width}: Active on is purple`,g.styles.activeOnColor==='rgb(117, 67, 232)',g.styles);
  }
  if(width===1440) {
    check(`${shell} ${id}: details and summary are columns`,g.boxes['.zecg-summary'].x>g.boxes['.zecg-details'].x+g.boxes['.zecg-details'].width,g.boxes);
    check(`${shell} ${id}: members is beneath summary`,Math.abs(g.boxes['.zecg-members'].x-g.boxes['.zecg-summary'].x)<3&&g.boxes['.zecg-members'].y>=g.boxes['.zecg-summary'].bottom,g.boxes);
    check(`${shell} ${id}: compact summary`,g.boxes['.zecg-summary'].height<190,g.boxes['.zecg-summary']);
  } else if(width<1024) {
    check(`${shell} ${id} ${width}: cards stack`,g.boxes['.zecg-summary'].y>=g.boxes['.zecg-details'].bottom,g.boxes);
  }
  const screenshot=`${shell}-${id}-${width}.png`;
  await page.screenshot({path:path.join(outDir,screenshot),fullPage:true});
  report.viewports.push({shell,id,width,screenshot,geometry:g});
  fs.writeFileSync(path.join(outDir,'dom-shapes.json'),JSON.stringify(report.viewports.map(v=>({shell:v.shell,id:v.id,width:v.width,more:v.geometry.more,styles:v.geometry.styles})),null,2));
}
async function styleScope(page,shell) {
  await page.goto(`${base}/${shell}/zenith/Contacts/CustomerGroups`,{waitUntil:'domcontentloaded',timeout:90000});
  if(shell==='qapps') {await page.locator('.cust-nc-solo').filter({hasText:'Add Group'}).click();}
  await page.locator('form[name="CreateGroupForm"]').waitFor({state:'attached',timeout:60000});
  const delta=await page.evaluate(()=>{
    const form=document.querySelector('form[name="CreateGroupForm"]');
    const els=[form,...form.querySelectorAll('input,select,textarea,label,.q-field,.q-field__label')];
    const props=['display','padding','margin','color','fontSize','lineHeight','border','borderRadius','height','width'];
    const snap=()=>els.map(e=>Object.fromEntries(props.map(p=>[p,getComputedStyle(e)[p]])));
    const sheets=[...document.querySelectorAll('link[rel="stylesheet"]')].filter(e=>e.href.includes('edit-customer-group.css'));
    const before=snap(); sheets.forEach(e=>e.disabled=true); const after=snap(); sheets.forEach(e=>e.disabled=false);
    return {sheetCount:sheets.length,changes:before.flatMap((s,i)=>JSON.stringify(s)===JSON.stringify(after[i])?[]:[{index:i,before:s,after:after[i]}])};
  });
  check(`${shell}: Create Group form unchanged by scoped stylesheet`,delta.sheetCount>0&&delta.changes.length===0,delta);
}

(async()=>{
 try {
  const initial=queryState(); report.initialDatabaseState=initial;
  check('Captured groups belong only to synthetic QA tenants',group(initial)?.org==='CITEST_ORG_A'&&group(initial,'CGQA_POPULATED_A')?.org==='CITEST_ORG_A'&&group(initial,'CGQA_FOREIGN_B')?.org==='CITEST_ORG_B',initial.groups);
  check('Captured customers belong only to synthetic QA tenants',initial.parties.find(p=>p.id==='CITEST_A_CUST')?.owner==='CITEST_ORG_A'&&initial.parties.find(p=>p.id==='CITEST_B_CUST')?.owner==='CITEST_ORG_B',initial.parties);
  check('Fresh empty and populated fixtures',activeMembers(initial,'CGQA_EMPTY_A').length===0&&activeMembers(initial,'CGQA_POPULATED_A').length===1,initial.members);
  browser=await chromium.launch({executablePath:process.env.CGQA_CHROME||undefined,headless:true,args:['--disable-extensions','--no-first-run']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(); currentPage=page;
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(`${base}/Login`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('input[name="organizationId"]').fill('CITEST_ORG_A');
  await page.locator('input[name="username"]').first().fill(process.env.CGQA_USERNAME||'john.doe');
  await page.locator('input[name="password"]').fill(process.env.CGQA_PASSWORD||'moqui');
  await page.locator('form').filter({has:page.locator('input[name="password"]')}).locator('button[type="submit"],input[type="submit"]').click();
  await page.waitForTimeout(1500);
  check('Local login succeeds',!new URL(page.url()).pathname.startsWith('/Login'),new URL(page.url()).pathname);
  await openGroup(page,'qapps');
  await geometry(page,1440,'qapps','CGQA_EMPTY_A');
  if(group(initial)?.active==='N') {
   await toggleActive(page,'qapps','Space');await submit(page);
   const reset=await waitState(s=>group(s)?.active==='Y');
   check('Previous QA attempt reset fixture Active via real form',group(reset)?.active==='Y');
  }
  for(const shell of ['apps','qapps']) {
   for(const width of [320,390,800,1440]) {
    await page.setViewportSize({width,height:900});
    await openGroup(page,shell);
    check(`${shell} ${width}: empty members state`,await page.locator('.zecg-page .cg-empty-h').textContent()==='No members added yet.');
    check(`${shell} ${width}: summary shows enum description`,(await page.locator('.zecg-summary').textContent()).includes('Wholesale'));
    await geometry(page,width,shell,'CGQA_EMPTY_A');
   }
   await openGroup(page,shell,'CGQA_POPULATED_A');
   check(`${shell}: populated member row`,(await page.locator('.zecg-members').textContent()).includes('Alpha UI QA Customer'));
   await geometry(page,1440,shell,'CGQA_POPULATED_A');
   await openGroup(page,shell);
   await page.locator('.zecg-form [name="paymentTerms"]').fill(terms);
   await page.locator('.zecg-form [name="description"]').fill(description);
   const sw=await toggleActive(page,shell,'Space');
   check(`${shell}: Active switch keyboard is focusable`,await sw.evaluate(e=>e===document.activeElement||e.contains(document.activeElement)));
   let body=await submit(page);
   check(`${shell}: switch off serializes N`,body.get('isActive')==='N',report.requests.at(-1));
   let state=await waitState(s=>group(s)?.active==='N'&&group(s)?.terms===terms);
   check(`${shell}: off and arbitrary terms persist in DB`,group(state)?.active==='N'&&group(state)?.terms===terms&&group(state)?.description===description,group(state));
   await openGroup(page,shell);
   check(`${shell}: arbitrary saved Payment Terms reload`,await page.locator('.zecg-form [name="paymentTerms"]').inputValue()===terms);
   await toggleActive(page,shell,'Enter'); body=await submit(page);
   check(`${shell}: switch on serializes Y`,body.get('isActive')==='Y',report.requests.at(-1));
   state=await waitState(s=>group(s)?.active==='Y'); check(`${shell}: on persists in DB`,group(state)?.active==='Y',group(state));
   await openGroup(page,shell);
   await page.locator('.zecg-add-trigger').click();
   const dialog=page.locator(shell==='apps'?'#AddMember':'[role="dialog"]').filter({has:page.locator('form[name="AddMemberForm"]')});
   await dialog.waitFor({state:'visible'});
   if(shell==='apps') {
    const sel=dialog.locator('select[name="partyId"]');
    check(`${shell}: member choices exclude foreign tenant`,!(await sel.textContent()).includes('Bravo'));
    const widget=dialog.locator('.select2-container');
    if(await widget.isVisible()) {await widget.click(); await page.locator('.select2-results__option').filter({hasText:'Alpha UI QA Customer'}).click();}
    else await sel.selectOption('CITEST_A_CUST');
   } else {
    await dialog.locator('.q-select').click();
    check(`${shell}: member choices exclude foreign tenant`,!(await page.locator('.q-menu').textContent()).includes('Bravo'));
    await page.getByRole('option',{name:'Alpha UI QA Customer',exact:true}).click();
   }
   await dialog.locator('button[type="submit"],input[type="submit"]').click();
   state=await waitState(s=>activeMembers(s,'CGQA_EMPTY_A').length===1);
   check(`${shell}: Add Member persists only own customer`,activeMembers(state,'CGQA_EMPTY_A').length===1&&activeMembers(state,'CGQA_EMPTY_A')[0].party==='CITEST_A_CUST',activeMembers(state,'CGQA_EMPTY_A'));
   await openGroup(page,shell);
   check(`${shell}: member count and row update`,(await page.locator('.zecg-members').textContent()).includes('Members (1)')&&(await page.locator('.zecg-members').textContent()).includes('Alpha UI QA Customer'));
   await page.screenshot({path:path.join(outDir,`${shell}-member-added.png`),fullPage:true});
   page.once('dialog',d=>d.accept());
   await page.locator('.zecg-members').getByText('Remove',{exact:true}).last().click();
   if(shell==='qapps') {const confirm=page.getByRole('dialog');if(await confirm.count()){await confirm.getByRole('button',{name:/OK|Yes|Confirm/i}).click();}}
   state=await waitState(s=>activeMembers(s,'CGQA_EMPTY_A').length===0);
   check(`${shell}: Remove expires captured membership in DB`,activeMembers(state,'CGQA_EMPTY_A').length===0&&state.members.some(m=>m.group==='CGQA_EMPTY_A'&&m.party==='CITEST_A_CUST'&&m.thruDate),state.members.filter(m=>m.group==='CGQA_EMPTY_A'));
   await openGroup(page,shell); check(`${shell}: removed member returns to empty state`,await page.locator('.cg-empty-h').isVisible());
   await page.locator('.zecg-back a').click(); await page.waitForTimeout(700);
   check(`${shell}: Back targets same-shell Customer Groups`,new URL(page.url()).pathname===`/${shell}/zenith/Contacts/CustomerGroups`,new URL(page.url()).pathname);
   await styleScope(page,shell);
  }
  await openGroup(page,'qapps');
  await page.locator('.zecg-form [name="groupName"]').fill('Import');
  await page.locator('.zecg-form [name="paymentTerms"]').fill('');
  await page.locator('.zecg-form [name="description"]').fill('');
  await submit(page);
  const restored=await waitState(s=>group(s)?.active==='Y'&&group(s)?.name==='Import'&&!group(s)?.terms&&!group(s)?.description);
  check('Reference fixture restored through real form and DB',group(restored)?.active==='Y'&&group(restored)?.name==='Import'&&!group(restored)?.terms&&!group(restored)?.description,group(restored));
  for(const shell of ['apps','qapps']) {
   for(const width of [320,390,800,1440]) {
    await page.setViewportSize({width,height:900});await openGroup(page,shell);
    await geometry(page,width,shell,'CGQA_EMPTY_A');
   }
  }
  await page.setViewportSize({width:1492,height:720});
  await openGroup(page,'qapps');
  await page.screenshot({path:path.join(outDir,'qapps-reference-size-1492x720.png'),fullPage:false});
  const final=queryState(); report.finalDatabaseState=final;
  check('Foreign QA group unchanged',JSON.stringify(group(final,'CGQA_FOREIGN_B'))===JSON.stringify(group(initial,'CGQA_FOREIGN_B')));
  check('Existing populated fixture unchanged',JSON.stringify(activeMembers(final,'CGQA_POPULATED_A'))===JSON.stringify(activeMembers(initial,'CGQA_POPULATED_A')));
  report.completed=true;
 } catch(e) {
  report.completed=false;report.failure=e.message;
  if(currentPage && await currentPage.locator('.zecg-page').count()) {await currentPage.screenshot({path:path.join(outDir,'failure.png'),fullPage:true}).catch(()=>{});}
 } finally {
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(outDir,'checks.json'),JSON.stringify(report,null,2));
  if(browser) await browser.close();
  console.log(JSON.stringify({completed:report.completed,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length,failure:report.failure||null,evidence:path.join(outDir,'checks.json')},null,2));
  if(!report.completed) process.exitCode=1;
 }
})();
