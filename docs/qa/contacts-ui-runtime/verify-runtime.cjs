const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const base = process.env.CONTACTS_QA_BASE_URL || 'http://127.0.0.1:8080';
const u = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !['8080', '18081'].includes(u.port)) throw new Error('Only isolated loopback8080/18081 is allowed');
if (!process.env.CONTACTS_QA_USERNAME || !process.env.CONTACTS_QA_PASSWORD) throw new Error('Disposable login credentials must be provided through the environment');
const out = path.resolve(process.env.CONTACTS_QA_OUTPUT_DIR || path.join(__dirname, 'evidence'));
fs.mkdirSync(out, { recursive: true });
const ids = ['A','B'].flatMap(tag => Array.from({length:tag==='A'?24:2}, (_,i) => `PR13QA_${tag}_${String(i+1).padStart(2,'0')}`));
const report = { startedAt:new Date().toISOString(), checks:[], viewports:[], pageErrors:[], fixtureIds:ids, frames:[] };
const requireMobileHeader = process.env.CONTACTS_QA_REQUIRE_MOBILE_HEADER === '1';
const headerBaseline = process.env.CONTACTS_QA_HEADER_BASELINE_FILE ? JSON.parse(fs.readFileSync(process.env.CONTACTS_QA_HEADER_BASELINE_FILE,'utf8')) : null;
function containerId(name) {
  const value=process.env[name];
  if(!value||!/^[a-zA-Z0-9_.-]+$/.test(value))throw new Error('A valid disposable '+name+' is required');
  return value;
}
function check(name, pass, detail) {
  report.checks.push({name, pass:!!pass, ...(detail===undefined?{}:{detail})});
  if (!pass) throw new Error(name+': '+JSON.stringify(detail));
}
function truth(exportScope=false) {
  const mode = process.env.CONTACTS_QA_DB_MODE || 'native';
  let r;
  if (mode==='postgres') {
    if (u.port!=='8080') throw new Error('PostgreSQL profile requires isolated staging HTTP8080');
    const container = containerId('CONTACTS_QA_DB_CONTAINER');
    const where = exportScope ? "p.owner_party_id='CITEST_ORG_A' AND (p.disabled IS NULL OR p.disabled<>'Y')" : `p.party_id IN (${ids.map(id=>"'"+id+"'").join(',')})`;
    const sql = `BEGIN READ ONLY; SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) FROM (SELECT p.party_id AS id,p.owner_party_id AS owner,p.disabled,n.first_name,n.last_name FROM party p LEFT JOIN person n ON n.party_id=p.party_id WHERE ${where} ORDER BY p.party_id) x; ROLLBACK;`;
    r = spawnSync('docker',['exec','-i',container,'psql','-U','moqui','-d','moqui','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:30000,windowsHide:true});
  } else if (mode==='native') {
    const runtime = process.env.CONTACTS_QA_RUNTIME_DIR;
    const h2 = process.env.CONTACTS_QA_H2_JAR || (runtime && path.join(runtime,'WEB-INF/lib/h2-2.4.240.jar'));
    if (!h2 || !process.env.CONTACTS_QA_DB_URL) throw new Error('Native runtime/H2 and isolated DB environment are required');
    r = spawnSync(process.env.CONTACTS_QA_JAVA || 'java',['-cp',h2,path.join(__dirname,'ContactsDbProbe.java'),...(exportScope?['export']:[])],{encoding:'utf8',timeout:30000,windowsHide:true});
  } else throw new Error('Unknown database mode');
  if (r.status!==0) throw new Error('Read-only disposable fixture probe failed');
  return JSON.parse(r.stdout.trim());
}
function parseCsv(text) {
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(value);value='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(value||row.length){row.push(value);rows.push(row);}return rows;
}
let browser, currentPage;
async function open(page,shell,query='') {
  await page.goto(`${base}/${shell}/zenith/Contacts/FindContact${query}`,{timeout:90000,waitUntil:'domcontentloaded'});
  await page.locator('.zac-page').waitFor({state:'visible',timeout:60000});
  await page.waitForTimeout(700);
}
async function geometry(page,shell,width) {
  const g=await page.evaluate(()=>{
    const root=document.querySelector('.zac-page'),list=root.querySelector('.zac-list'),controls=root.querySelector('.zac-controls');
    const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    const rr=r(root);
    const oversized=[...root.querySelectorAll('.sup-searchrow,.sup-filterbar2,.panel-toolbar,.q-card__actions')].filter(e=>e.getBoundingClientRect().width).map(e=>({class:e.className,rect:r(e)})).filter(x=>x.rect.right>rr.right+2||x.rect.x<rr.x-2);
    const header=document.querySelector('.q-header')||document.getElementById('top');
    let headerGeometry=null;
    if(header){
      const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
      const regions=['#z-ownerview','#z-search','#zq-ownerview','#zq-search','#zq-toolbtns'].map(s=>document.querySelector(s)).filter(e=>e&&visible(e)).map(e=>({id:e.id,rect:r(e)}));
      const overlaps=[];
      for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
        const a=regions[i].rect,b=regions[j].rect;
        if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)overlaps.push([regions[i].id,regions[j].id]);
      }
      const controls=[...header.querySelectorAll('button,a,input,[role="button"]')].filter(visible).map(e=>{
        const b=r(e),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {tag:e.tagName,id:e.id||'',rect:b,withinViewport:b.x>=-2&&b.right<=innerWidth+2,
          hit:!!hit&&(hit===e||e.contains(hit))};
      });
      headerGeometry={root:r(header),overflow:header.scrollWidth-header.clientWidth,regions,overlaps,controls,viewportWidth:innerWidth};
    }
    return {root:rr,list:r(list),controls:r(controls),listOverflow:getComputedStyle(list).overflowX,oversized,header:headerGeometry,
      rootOverflow:root.scrollWidth-root.clientWidth,documentOverflow:document.documentElement.scrollWidth-innerWidth,
      visibleMenus:[...document.querySelectorAll('.zc-morenav')].filter(e=>e.getBoundingClientRect().width).length,
      title:root.querySelector('h5')?.textContent.trim(),checkboxes:root.querySelectorAll('.zac-select').length,
      excelLinks:[...root.querySelectorAll('a')].filter(e=>e.textContent.includes('Excel')).length};
  });
  check(`${shell} ${width}: page controls contained`,g.rootOverflow<=2&&g.oversized.length===0,g);
  check(`${shell} ${width}: no document overflow`,g.documentOverflow<=2,g.documentOverflow);
  check(`${shell} ${width}: table scrolling contained`,g.list.width<=g.root.width+2&&g.listOverflow==='auto',g);
  check(`${shell} ${width}: one module menu`,g.visibleMenus===1,g.visibleMenus);
  check(`${shell} ${width}: compact title and Excel hidden`,g.title==='All Contacts'&&g.excelLinks===0,{title:g.title,excelLinks:g.excelLinks});
  if(width<=390){
    const prior=headerBaseline?.viewports?.find(v=>v.shell===shell&&v.width===width)?.geometry?.header;
    if(prior){report.headerComparison=report.headerComparison||[];report.headerComparison.push({shell,width,before:prior,after:g.header});}
    if(requireMobileHeader){
      check(`${shell} ${width}: mobile header bounds`,!!g.header&&g.header.overflow<=2&&g.header.root.x>=-2&&g.header.root.right<=width+2,g.header);
      check(`${shell} ${width}: mobile header regions do not overlap`,g.header.overlaps.length===0,g.header.overlaps);
      check(`${shell} ${width}: visible header controls fit and can be hit`,g.header.controls.length>0&&g.header.controls.every(c=>c.withinViewport&&c.hit),g.header.controls);
    }
  }
  report.viewports.push({shell,width,geometry:g});
  if(width===1366||width===390){const filename=`${shell}-${width}.png`;await page.screenshot({path:path.join(out,filename),fullPage:false});report.frames.push({shell,width,height:width===390?844:900,screenshot:filename});}
}
async function pageSize(page,shell,size) {
  if(shell==='apps') await page.locator('.zac-pagesize').selectOption(String(size));
  else {
    await page.locator('.zac-page .q-btn-dropdown').filter({hasText:/^\s*\d+\s*arrow_drop_down\s*$/}).first().click();
    await page.locator('.q-menu a[href]').filter({hasText:new RegExp('^'+size+'$')}).click();
  }
  await page.waitForURL(url=>url.searchParams.get('pageSize')===String(size)&&url.searchParams.get('pageIndex')==='0',{timeout:30000});
  await page.locator('.zac-page').waitFor();await page.waitForTimeout(700);
}
async function scopedStyles(page,shell) {
  await page.goto(`${base}/${shell}/zenith/Contacts/Customers`,{timeout:90000,waitUntil:'domcontentloaded'});
  await page.locator('.cust-nc-trigger').waitFor();await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{
    const selectors=['.cust-nc-trigger','.sup-search-input','.sup-filterbar2','#CustomerListForm_table'];
    const els=selectors.map(s=>document.querySelector(s)).filter(Boolean);
    const props=['display','fontSize','lineHeight','padding','margin','border','backgroundColor','color','width','height'];
    const snap=()=>els.map(e=>Object.fromEntries(props.map(p=>[p,getComputedStyle(e)[p]])));
    const before=snap();let removed=0;
    for(const sheet of [...document.styleSheets]){
      let rules;try{rules=sheet.cssRules;}catch{continue;}
      for(let i=rules.length-1;i>=0;i--){if(rules[i].cssText.includes('.zac-page')){sheet.deleteRule(i);removed++;}}
    }
    return {removed,controls:els.length,unchanged:JSON.stringify(before)===JSON.stringify(snap()),pageWrapper:!!document.querySelector('.zac-page')};
  });
  check(`${shell}: All Contacts rules leave Customers controls unchanged`,result.removed>0&&result.controls>=2&&result.unchanged&&!result.pageWrapper,result);
}
(async()=>{
  try {
    const before=truth();
    // Foundation fixtures also contribute contacts (the billing fixture owns its own org).
    // Compare exports with independent DB ownership/active-state truth, not a fixed row count.
    const expectedExportIds=truth(true).map(c=>c.id).sort();
    check('fixture: 26 captured contacts exist',before.length===26,before.length);
    check('fixture: captured owners and disabled state',before.every(c=>ids.includes(c.id)&&c.owner===('CITEST_ORG_'+c.id.split('_')[1]))&&before.filter(c=>c.disabled==='Y').map(c=>c.id).join()==='PR13QA_A_24');
    if(process.env.CONTACTS_QA_CHROME&&!fs.existsSync(process.env.CONTACTS_QA_CHROME))throw new Error('Configured disposable browser executable is missing');
    browser=await chromium.launch({executablePath:process.env.CONTACTS_QA_CHROME||undefined,headless:true,args:process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']:[]});
    report.browserVersion=browser.version();report.databaseMode=process.env.CONTACTS_QA_DB_MODE||'native';report.mobileHeaderRequired=requireMobileHeader;
    const page=await browser.newPage({acceptDownloads:true});currentPage=page;
    page.on('pageerror',e=>report.pageErrors.push(e.message));
    const writes=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/Contacts/'))writes.push(new URL(r.url()).pathname);});
    await page.goto(base+'/Login');
    await page.locator('#login_form_organizationId').fill('CITEST_ORG_A');
    await page.locator('#login_form_username').fill(process.env.CONTACTS_QA_USERNAME);
    await page.locator('#login_form input[name="password"]').fill(process.env.CONTACTS_QA_PASSWORD);
    await page.locator('#login_form button[type="submit"]').click();
    for(const shell of ['apps','qapps']) {
      for(const width of [1920,1366,1024,768,390,360,320]) {
        await page.setViewportSize({width,height:width<500?844:900});await open(page,shell);await geometry(page,shell,width);
      }
      await page.setViewportSize({width:1366,height:900});await open(page,shell);
      check(`${shell}: default 20 visible contacts`,await page.locator('.zac-select').count()===20);
      check(`${shell}: redundant default Disabled summary absent`,!(await page.locator('.zac-page').innerText()).includes('Show Disabled: No'));
      check(`${shell}: foreign fixtures excluded`,!(await page.locator('.zac-page').innerText()).includes('PR13 Foreign'));
      const priorWrites=writes.length;
      await page.locator('.zac-select-all').check();
      check(`${shell}: select all visible rows`,await page.locator('.zac-select:checked').count()===20);
      await page.locator('.zac-select').first().uncheck();
      check(`${shell}: select-all indeterminate`,await page.locator('.zac-select-all').evaluate(e=>e.indeterminate)&&await page.locator('.zac-select:checked').count()===19);
      check(`${shell}: selection sends no write`,writes.length===priorWrites);
      const last=page.locator('.sup-act-kebab').last();await last.locator('summary').click();
      const visible=await last.locator('.sup-act-menu').evaluate(e=>{const r=e.getBoundingClientRect();const a=e.querySelector('a');const ar=a.getBoundingClientRect();const hit=document.elementFromPoint(ar.x+ar.width/2,ar.y+ar.height/2);return {width:r.width,height:r.height,hit:!!hit&&(hit===a||a.contains(hit))};});
      check(`${shell}: last row action menu visible/hittable`,visible.width>0&&visible.height>0&&visible.hit,visible);
      const menuRoutes=await last.locator('.sup-act-menu a').evaluateAll(es=>es.map(e=>({path:new URL(e.href).pathname,id:new URL(e.href).searchParams.get('partyId')})));
      check(`${shell}: profile/edit routes keep exact selected contact`,menuRoutes.length===2&&menuRoutes.every(r=>r.id&&r.id.startsWith('PR13QA_A_'))&&menuRoutes.some(r=>r.path.endsWith('/ContactProfile'))&&menuRoutes.some(r=>r.path.endsWith('/EditContact')),menuRoutes);
      await page.locator('.cust-nc-trigger').focus();await page.locator('.cust-nc-trigger').press('Enter');
      check(`${shell}: New Contact opens by Enter`,await page.locator('.cust-newcust').evaluate(e=>e.classList.contains('open')));
      await page.locator('.cust-nc-trigger').press('Escape');
      check(`${shell}: New Contact closes by Escape`,await page.locator('.cust-newcust').evaluate(e=>!e.classList.contains('open'))&&await page.locator('.cust-nc-trigger').getAttribute('aria-expanded')==='false');
      check(`${shell}: Escape returns focus to menu trigger`,await page.locator('.cust-nc-trigger').evaluate(e=>document.activeElement===e));
      await open(page,shell,'?pageIndex=1&pageSize=20&quickSearch=PR13');
      check(`${shell}: last page has remaining 3 rows`,await page.locator('.zac-select').count()===3);
      await pageSize(page,shell,10);
      check(`${shell}: page-size reset preserves search`,new URL(page.url()).searchParams.get('quickSearch')==='PR13'&&await page.locator('.zac-select').count()===10,page.url().replace(base,''));
      await open(page,shell,'?pageIndex=2&pageSize=10&quickSearch=PR13');await pageSize(page,shell,50);
      check(`${shell}: larger page size from last page shows 23 active fixtures`,await page.locator('.zac-select').count()===23);
      const escapedLabel=await page.locator('.zac-select[value="PR13QA_A_02"]').getAttribute('aria-label');
      check(`${shell}: escaped name becomes accessible literal text`,escapedLabel.includes("O'Neil & Sons")&&!escapedLabel.includes('&amp;'),escapedLabel);
      check(`${shell}: long name retained in title and truncated locally`,await page.locator('.zac-select[value="PR13QA_A_04"]').evaluate(e=>{const row=e.closest('.tr,tr');const name=row.querySelector('.zac-name');return name.title.length>150&&getComputedStyle(name).textOverflow==='ellipsis'&&getComputedStyle(name).overflowX==='hidden';}));
      await open(page,shell,'?showDisabled=Y&quickSearch=PR13&pageSize=50');
      check(`${shell}: Show Disabled includes captured inactive fixture`,await page.locator('.zac-select').count()===24&&(await page.locator('.zac-page').innerText()).includes('Inactive'));
      await open(page,shell,'?quickSearch=PR13NO_MATCH');check(`${shell}: no-match empty list`,await page.locator('.zac-select').count()===0);
      await open(page,shell,'?pageSize=50');
      const csvPromise=page.waitForEvent('download',{timeout:30000});await page.locator('.cust-export').click();const download=await csvPromise;
      check(`${shell}: CSV browser download completed`,await download.failure()===null,download.suggestedFilename());
      const file=await download.path();const rows=parseCsv(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
      const exportedIds=rows.slice(1).map(r=>r[0]).sort();
      check(`${shell}: CSV headers/owned active rows`,rows[0].length===9&&JSON.stringify(exportedIds)===JSON.stringify(expectedExportIds),{columns:rows[0].length,dataRows:exportedIds.length,exportedIds,expectedExportIds});
      fs.unlinkSync(file);
      await page.setViewportSize({width:390,height:844});await open(page,shell);
      for(const kind of ['Add Person','Add Company']) {
        await page.locator('.cust-nc-solo').filter({hasText:kind}).click();
        const dialog=page.locator(shell==='apps'?'.modal.in':'.q-dialog .q-dialog__inner > div').filter({has:page.locator('form')}).last();
        await dialog.waitFor({state:'visible'});
        const d=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,scrollable:e.scrollHeight>e.clientHeight};});
        check(`${shell}: ${kind} mobile dialog fits width`,d.x>=-2&&d.right<=392,d);
        await page.keyboard.press('Escape');await page.waitForTimeout(400);
        if(await dialog.isVisible()){const close=dialog.locator('button').filter({hasText:/Close|Cancel|close|×/}).first();if(await close.count())await close.click();else await open(page,shell);}
      }
      await scopedStyles(page,shell);
    }
    check('selection/filter/UI pass did not change captured DB records',JSON.stringify(truth())===JSON.stringify(before));
    check('no browser page errors',report.pageErrors.length===0,report.pageErrors);
    if(process.env.CONTACTS_QA_SOURCE_DIR&&(process.env.CONTACTS_QA_RUNTIME_DIR||process.env.CONTACTS_QA_APP_CONTAINER)) {
      const files=['component/zenith-erp-contacts/screen/zenith/contacts/Contacts/FindContact.xml','component/zenith-erp-contacts/screen/zenith/contacts/Contacts.xml','component/zenith-erp-contacts/screen/zenith/contacts/includes/ContactsModuleLinks.html.ftl','component/zenith-erp-app/screen/zenithstatic/css/zenith-theme-v4.css','component/zenith-erp-app/screen/zenithstatic/js/cpe-tabs.js','component/zenith-erp-app/screen/zenithstatic/js/qapps-nav.js','component/zenith-erp-app/screen/zenith/ZenithApp.xml'];
      let containerHashes=null;
      if(process.env.CONTACTS_QA_APP_CONTAINER){
        if(u.port!=='8080')throw new Error('Container source parity requires isolated staging HTTP8080');
        const app=containerId('CONTACTS_QA_APP_CONTAINER');
        const result=spawnSync('docker',['exec',app,'sha256sum',...files.map(file=>'/opt/moqui/runtime/'+file)],{encoding:'utf8',timeout:30000,windowsHide:true});
        if(result.status!==0)throw new Error('Disposable app-container source parity probe failed');
        containerHashes=result.stdout.trim().split(/\r?\n/).map(line=>line.split(/\s+/)[0]);
        if(containerHashes.length!==files.length||containerHashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))throw new Error('Invalid disposable app-container hash response');
      }
      report.parity=files.map((file,i)=>{const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');const sourceSha256=sha(path.join(process.env.CONTACTS_QA_SOURCE_DIR,file)),runtimeSha256=containerHashes?containerHashes[i]:sha(path.join(process.env.CONTACTS_QA_RUNTIME_DIR,'runtime',file));check('Source/runtime SHA parity: '+file,sourceSha256===runtimeSha256);return {path:file,sourceSha256,runtimeSha256,match:sourceSha256===runtimeSha256};});
    }
    report.completed=true;
  } catch(e) {
    report.completed=false;report.failure=e.message;
    if(currentPage)await currentPage.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  } finally {
    report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));
    if(browser)await browser.close();console.log(JSON.stringify({completed:report.completed,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length,failure:report.failure||null}));if(!report.completed)process.exitCode=1;
  }
})();
