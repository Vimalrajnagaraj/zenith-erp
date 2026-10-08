const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {spawnSync}=require('child_process'); const {chromium}=require('playwright');
const base=process.env.CONTACTS_REFERENCE_BASE_URL;
if(base!=='http://127.0.0.1:18085')throw Error('Named disposable loopback runtime required');
for(const key of ['CONTACTS_REFERENCE_USERNAME','CONTACTS_REFERENCE_PASSWORD','CONTACTS_REFERENCE_JAVA','CONTACTS_REFERENCE_H2_JAR','CONTACTS_REFERENCE_DB_URL','CONTACTS_REFERENCE_OUTPUT'])if(!process.env[key])throw Error('Missing '+key);
const out=path.resolve(process.env.CONTACTS_REFERENCE_OUTPUT); fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),checks:[],layouts:[],pageErrors:[],fixtureIds:['PR13QA_A_01','PR13QA_A_14','CGQA_EMPTY_A','CGQA_POPULATED_A']}; let browser;
function check(name,pass,detail){report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
function query(sql){const r=spawnSync(process.env.CONTACTS_REFERENCE_JAVA,['-cp',process.env.CONTACTS_REFERENCE_H2_JAR,path.join(__dirname,'ContactsReferenceDbProbe.java')],{input:sql,encoding:'utf8',timeout:30000,windowsHide:true});if(r.status!==0)throw Error('SELECT probe failed: '+r.stderr.slice(0,400));return JSON.parse(r.stdout);}
function name(){return query("SELECT FIRST_NAME FROM PERSON WHERE PARTY_ID='PR13QA_A_01'")[0]?.first_name;}
function billing(){const tables=query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME IN ('INVOICE','INVOICE_ITEM','PAYMENT','ORDER_HEADER','ORDER_PART','ORDER_ITEM','POS_BILL','POS_BILL_ITEM','ACCTG_TRANS','ACCTG_TRANS_ENTRY') ORDER BY TABLE_NAME");check('Independent billing probe covers invoice/payment/order/ledger tables',tables.length>=8,tables.map(t=>t.table_name));return Object.fromEntries(tables.map(({table_name})=>{const rows=query('SELECT * FROM '+table_name);rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return[table_name,{count:rows.length,sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')}]}));}
async function open(page,shell,screen,params=''){await page.goto(`${base}/${shell}/zenith/Contacts/${screen}${params}`,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.zcontacts-page').first().waitFor({state:'visible',timeout:60000});await page.waitForTimeout(350);}
async function token(page){return page.evaluate(()=>document.querySelector('#confMoquiSessionToken')?.value||document.querySelector('[name=moquiSessionToken]')?.value||window.moqui?.webrootVue?.moquiSessionToken);}
async function waitName(expected){for(let i=0;i<8;i++){if(name()===expected)return true;await new Promise(r=>setTimeout(r,250));}return false;}
async function modal(page,shell,label){await page.locator('.cust-nc-solo').filter({hasText:label}).click();const dialog=page.locator(shell==='apps'?'.modal.in':'.q-dialog');await dialog.waitFor({state:'visible',timeout:10000});check(`${shell}: ${label} opens real create form`,await dialog.locator('form').count()>0);await page.keyboard.press('Escape');if(await dialog.isVisible()){const close=dialog.locator('button').filter({hasText:/Close|Cancel/}).first();if(await close.count())await close.click();}await dialog.waitFor({state:'hidden',timeout:10000});}
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CONTACTS_REFERENCE_CHROME||undefined});const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await context.request.post(base+'/Login/login',{form:{username:process.env.CONTACTS_REFERENCE_USERNAME,password:process.env.CONTACTS_REFERENCE_PASSWORD}});
 await open(page,'apps','FindContact');let csrf=await token(page);check('Authenticated native form CSRF',!!csrf);
 const init=await context.request.post(base+'/apps/zenith/Contacts/ContactsReferenceQa/initialize',{form:{moquiSessionToken:csrf}});check('Fresh captured disposable fixtures loaded once',init.status()===200);
 await context.request.post(base+'/apps/zenith/Contacts/ContactsReferenceQa/scope',{form:{org:'CITEST_ORG_A',moquiSessionToken:csrf}});
 check('Fixture contact exists under Tenant A',query("SELECT OWNER_PARTY_ID FROM PARTY WHERE PARTY_ID='PR13QA_A_01'")[0]?.owner_party_id==='CITEST_ORG_A');
 report.billingBefore=billing();const initialName=name();
 for(const shell of ['apps','qapps']){
   await open(page,shell,'ContactProfile','?partyId=PR13QA_A_01');const edit=page.locator('a.cp-btn').filter({hasText:/^Edit$/});check(`${shell}: profile Edit is a real navigable link`,await edit.count()===1&&(await edit.getAttribute('href')).includes('/EditContact?partyId=PR13QA_A_01'));await edit.click();await page.locator('#ContactDetailForm').waitFor({timeout:60000});
   check(`${shell}: profile breadcrumb targets directory`,(await page.locator('.cp-crumb-link').first().getAttribute('href')).includes('/FindContact'));
   for(const tab of ['profile','tax','banking','licenses','contactinfo','orders']){
     await page.locator('.cpe-tab[data-cpetab="profile"]').click();const expected=`Disposable Saved ${shell} ${tab}`;await page.locator('#ContactDetailForm [name=firstName]').fill(expected);await page.locator(`.cpe-tab[data-cpetab="${tab}"]`).click();
     check(`${shell}: ${tab} tab selects visible panels`,await page.locator(`.cpe-tab[data-cpetab="${tab}"]`).getAttribute('aria-selected')==='true');
     const request=page.waitForRequest(r=>r.method()==='POST'&&r.url().includes('/EditContact/updateContact'),{timeout:15000});await page.locator('[data-cpesave]').click();await request;check(`${shell}: footer Save from ${tab} persists through native service`,await waitName(expected));await page.locator('[data-cpesave]').waitFor({timeout:30000});
   }
   await page.locator('.cpe-tab[data-cpetab="profile"]').click();let before=name();await page.locator('#ContactDetailForm [name=firstName]').fill('Disposable Unsaved Change');await page.locator('.cpe-actionbar a').filter({hasText:'Discard Changes'}).click();await page.locator('#ContactDetailForm [name=firstName]').waitFor({timeout:30000});check(`${shell}: Discard reloads original values without write`,await page.locator('#ContactDetailForm [name=firstName]').inputValue()===before&&name()===before);
   for(const screen of ['FindContact','Customers','Vendors']){
     await open(page,shell,screen,screen==='Customers'?'?pageSize=20&pageIndex=1':'');await modal(page,shell,'Add Person');await modal(page,shell,'Add Company');await page.locator('.cust-nc-trigger').click();check(`${shell} ${screen}: New menu opens`,await page.locator('.cust-newcust').evaluate(e=>e.classList.contains('open')));await page.keyboard.press('Escape');check(`${shell} ${screen}: Escape closes New menu`,!await page.locator('.cust-newcust').evaluate(e=>e.classList.contains('open')));
     if(screen==='Customers'){
       check(`${shell}: off-page fixture absent before searching`,!await page.locator('.sup-id').allTextContents().then(ids=>ids.some(id=>id.includes('PR13QA_A_05'))));
       await page.locator('.contacts-quick-search [name=quickSearch]').fill('QA A 05');await page.locator('.contacts-quick-search [type=submit]').click();await page.waitForURL(u=>u.searchParams.get('quickSearch')==='QA A 05'&&u.searchParams.get('pageIndex')==='0');await page.locator('.sup-id').filter({hasText:'PR13QA_A_05'}).waitFor({timeout:30000});check(`${shell}: quick search finds contact beyond visible page`,await page.locator('.sup-name').allTextContents().then(names=>names.some(n=>n.includes('QA A 05'))));
       await page.locator('.contacts-quick-search [name=quickSearch]').fill('QA A 05 PR13 Contact');await page.locator('.contacts-quick-search [type=submit]').click();await page.waitForURL(u=>u.searchParams.get('quickSearch')==='QA A 05 PR13 Contact');await page.waitForFunction(()=>{const ids=document.querySelectorAll('.sup-id');return ids.length===1&&ids[0].textContent.includes('PR13QA_A_05')},{},{timeout:30000});check(`${shell}: full-name search spans first and last names`,await page.locator('.sup-id').allTextContents().then(ids=>ids.length===1&&ids[0].includes('PR13QA_A_05')));
       await page.locator('.sup-dd summary').first().click();await page.locator('.sup-dd-item').filter({hasText:/^Individual$/}).click();await page.waitForURL(/partyTypeEnumId=PtyPerson/);check(`${shell}: changing type retains quick search and resets page`,new URL(page.url()).searchParams.get('quickSearch')==='QA A 05 PR13 Contact'&&new URL(page.url()).searchParams.get('pageIndex')==='0');
     }
     if(screen!=='FindContact'){
       await open(page,shell,screen);const count=await page.locator('.contacts-row-check').count();check(`${shell} ${screen}: native row selections rendered`,count>0);
       let writes=0;const handler=r=>{if(r.method()==='POST'&&r.url().includes('/Contacts/'))writes++;};page.on('request',handler);
       await page.locator('.contacts-all-check').check();check(`${shell} ${screen}: select-all selects visible rows only`,await page.locator('.contacts-row-check:checked').count()===count);
       await page.locator('.contacts-row-check').first().uncheck();check(`${shell} ${screen}: partial selection is indeterminate`,await page.locator('.contacts-all-check').evaluate(e=>e.indeterminate));await page.waitForTimeout(200);page.off('request',handler);check(`${shell} ${screen}: selection causes no contact writes`,writes===0);
     }
     if(screen==='Vendors'){
       await open(page,shell,screen,'?statusFilter=inactive');const ids=await page.locator('.sup-id').allTextContents().then(a=>a.map(t=>t.replace(/^ID:\s*/, '').trim()).sort());const expected=query("SELECT DISTINCT P.PARTY_ID FROM PARTY P JOIN PARTY_ROLE R ON R.PARTY_ID=P.PARTY_ID WHERE P.OWNER_PARTY_ID='CITEST_ORG_A' AND P.DISABLED='Y' AND R.ROLE_TYPE_ID IN ('Supplier','Vendor') ORDER BY P.PARTY_ID").map(p=>p.party_id);check(`${shell}: supplier inactive filter equals disabled owned DB rows`,JSON.stringify(ids)===JSON.stringify(expected)&&ids.includes('CONTACTS_REF_A_DUP'),{ids,expected});
       const csv=await context.request.get(`${base}/${shell}/zenith/Contacts/Vendors/export?format=csv&statusFilter=inactive`);const text=await csv.text();check(`${shell}: supplier export keeps status filter and owner`,csv.status()===200&&text.includes('CONTACTS_REF_A_DUP')&&!text.includes('CONTACTS_REF_B_DUP')&&!text.includes('CITEST_P14_A_01'));
     }
   }
   for(const [screen,params] of [['FindContact',''],['Customers',''],['Vendors',''],['CustomerGroups',''],['ContactsDashboard',''],['EditCustomerGroup','?customerGroupId=CGQA_EMPTY_A'],['MergeContacts',''],['ContactProfile','?partyId=PR13QA_A_01'],['EditContact','?partyId=PR13QA_A_01']]){
     for(const width of [1440,1024,768,390,320]){
       await page.setViewportSize({width,height:900});await open(page,shell,screen,params);const geometry=await page.locator('.zcontacts-page').first().evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,viewport:innerWidth,scroll:document.documentElement.scrollWidth}});
       check(`${shell} ${screen} ${width}: screen stays in viewport`,geometry.left>=-1&&geometry.right<=width+1&&geometry.scroll<=width+1,geometry);report.layouts.push({shell,screen,width,...geometry});
       if(screen==='EditContact'){
         await page.locator('[data-cpesave]').scrollIntoViewIfNeeded();const hit=await page.locator('[data-cpesave]').evaluate(e=>{const r=e.getBoundingClientRect(), top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===e||e.contains(top);});check(`${shell} ${width}: Save receives actual pointer hit`,hit);
       }
       if(screen==='MergeContacts')check(`${shell} ${width}: Merge action has reference primary colors`,await page.locator('#MergeForm_submitBtn').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(124, 58, 237)'&&getComputedStyle(e).color==='rgb(255, 255, 255)'));
       if([1440,390].includes(width))await page.screenshot({path:path.join(out,`${shell}-${screen}-${width}.png`),fullPage:true});
     }
   }
   await page.setViewportSize({width:1440,height:900});
   await open(page,shell,'EditCustomerGroup','?customerGroupId=CGQA_EMPTY_A');
   const originalGroup=query("SELECT GROUP_NAME,PAYMENT_TERMS,IS_ACTIVE FROM CUSTOMER_GROUP WHERE CUSTOMER_GROUP_ID='CGQA_EMPTY_A'")[0];
   await page.locator('#GroupForm [name=groupName]').fill('Disposable Reference Group '+shell);
   await page.locator('#GroupForm [name=paymentTerms]').fill('QA editable custom terms / 23 days');
   await page.locator(shell==='apps'?'.zecg-page .cg-toggle':'.zecg-page .zecg-active-toggle').click();
   await page.locator('#GroupForm [type=submit]').click();await page.waitForTimeout(600);
   const savedGroup=query("SELECT GROUP_NAME,PAYMENT_TERMS,IS_ACTIVE FROM CUSTOMER_GROUP WHERE CUSTOMER_GROUP_ID='CGQA_EMPTY_A'")[0];
   check(`${shell}: group Update submits editable terms and toggle`,savedGroup.group_name==='Disposable Reference Group '+shell&&savedGroup.payment_terms==='QA editable custom terms / 23 days'&&savedGroup.is_active==='N',savedGroup);
   await page.locator('#GroupForm [name=groupName]').fill(originalGroup.group_name);await page.locator('#GroupForm [name=paymentTerms]').fill(originalGroup.payment_terms||'');
   await page.locator(shell==='apps'?'.zecg-page .cg-toggle':'.zecg-page .zecg-active-toggle').click();await page.locator('#GroupForm [type=submit]').click();await page.waitForTimeout(600);
   check(`${shell}: synthetic group restored`,JSON.stringify(query("SELECT GROUP_NAME,PAYMENT_TERMS,IS_ACTIVE FROM CUSTOMER_GROUP WHERE CUSTOMER_GROUP_ID='CGQA_EMPTY_A'")[0])===JSON.stringify(originalGroup));
 }
 for(const shell of ['apps','qapps']){await open(page,shell,'MergeHistory','?ownerPartyId=CITEST_ORG_B');const history=await page.locator('#AllMergesList_table').innerText();check(`${shell}: forged owner retains only authorized history`,history.includes('Disposable Kept Alpha')&&!history.includes('Disposable Kept Bravo'));await open(page,shell,'MergeContacts');const recent=await page.locator('#MergeHistoryList_table').innerText();check(`${shell}: recent history is org-scoped`,recent.includes('CONTACTS_REF_A_KEEP')&&!recent.includes('CONTACTS_REF_B_KEEP'));}
 // Restoration uses the same customer form; all business ledgers must remain identical.
 await open(page,'apps','EditContact','?partyId=PR13QA_A_01');await page.locator('#ContactDetailForm [name=firstName]').fill(initialName);await page.locator('[data-cpesave]').click();check('Synthetic name restored',await waitName(initialName));report.billingAfter=billing();check('Invoice/payment/order/POS/ledger records unchanged',JSON.stringify(report.billingBefore)===JSON.stringify(report.billingAfter));
 await open(page,'apps','FindContact');csrf=await token(page);await context.request.post(base+'/apps/zenith/Contacts/ContactsReferenceQa/scope',{form:{org:'NONE',moquiSessionToken:csrf}});
 for(const shell of ['apps','qapps']){await open(page,shell,'MergeContacts');check(`${shell}: no organization exposes no merge targets`,!await page.locator('#MergeForm').innerText().then(t=>t.includes('Disposable Kept'))&&await page.locator('select[name=survivingPartyId] option[value]').evaluateAll(es=>es.every(e=>!e.value)));await open(page,shell,'MergeHistory','?ownerPartyId=CITEST_ORG_B');const text=await page.locator('#AllMergesList_table').innerText();check(`${shell}: no-org forged owner exposes no history`,!text.includes('Disposable Kept Alpha')&&!text.includes('Disposable Kept Bravo'));}
 check('No browser page errors',report.pageErrors.length===0,report.pageErrors);
 report.completedAt=new Date().toISOString();report.success=true;
}catch(error){report.success=false;report.error=error.message;process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,layouts:report.layouts.length,error:report.error}));}})();
