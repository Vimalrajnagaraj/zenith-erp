// Called after the existing scope/browser checks on a fresh disposable fixture DB only.
module.exports=async function({query,check,report,base,password,exportRows}){
 const {chromium}=require('playwright');let browser;
 const created=[];
 function pref(){return query("SELECT preference_value FROM user_preference WHERE user_id='CITEST_P14_USER_A' AND preference_key='ACTIVE_ORGANIZATION'");}
 function foreignState(){return {parties:query("SELECT party_id,owner_party_id,disabled FROM party WHERE party_id IN ('CITEST_P14_B_01','CITEST_P14_GLOBAL') ORDER BY party_id"),groups:query("SELECT customer_group_id,organization_party_id,group_name FROM customer_group WHERE customer_group_id IN ('CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA') ORDER BY customer_group_id"),members:query("SELECT customer_group_id,party_id,from_date,thru_date FROM customer_group_member WHERE customer_group_id IN ('CITEST_P14_GROUP_B','CITEST_P14_GROUP_NA') ORDER BY customer_group_id,party_id,from_date")};}
 const before=JSON.stringify(foreignState());
 const memberships=query("SELECT to_party_id FROM party_relationship WHERE from_party_id='CITEST_P14_USER_A' AND relationship_type_enum_id IN ('PrtAgent','PrtEmployee','PrtMember') ORDER BY to_party_id");
 check('Organization regression uses captured A-only fixture membership',memberships.length===1&&memberships[0].to_party_id==='CITEST_ORG_A',memberships);
 try{
  browser=await chromium.launch({executablePath:process.env.CONTACTS_QA_CHROME||undefined,headless:true});
  const context=await browser.newContext();
  const login=await context.request.get(base+'/apps/zenith/Contacts/CustomerGroups',{headers:{Authorization:'Basic '+Buffer.from('contacts.qa.a:'+password).toString('base64')}});
  check('Organization regression establishes one authenticated cookie session',login.status()===200&&(await context.cookies(base)).some(c=>c.name==='JSESSIONID'));
  const page=await context.newPage();await page.goto(base+'/apps/zenith/Contacts/CustomerGroups',{waitUntil:'domcontentloaded'});await page.locator('.cust-title').first().waitFor();
  const token=await page.evaluate(()=>document.querySelector('#confMoquiSessionToken')?.value||document.querySelector('[name=moquiSessionToken]')?.value||window.moqui?.webrootVue?.moquiSessionToken);
  check('Organization regression retains actual CSRF token',!!token);
  async function setOrg(id){
   const r=await context.request.get(base+'/apps/setPrefGoLast?'+new URLSearchParams({preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:id}),{maxRedirects:0});
   check('Synthetic preference transition succeeds',r.status()>=200&&r.status()<400,r.status());
   const rows=pref();check('DB proves preference before each direct operation',rows.length===1&&rows[0].preference_value===id,rows);
  }
  async function op(shell,operation,extra={}){
   const r=await context.request.post(`${base}/${shell}/zenith/Contacts/ContactsQaAcceptance/verify`,{form:{operation,customerGroupId:'CITEST_P14_GROUP_B',moquiSessionToken:token,...extra}});
   check(`${shell} ${operation}: authenticated service returns HTTP200`,r.status()===200,r.status());
   const data=await r.json();check(`${shell} ${operation}: temporary helper fixture restriction remains active`,data.fixtureCheck===true);return data;
  }
  const normal=await context.request.get(base+'/rest/s1/mantle/my/userOrgInfo');const choices=await normal.json();
  check('Normal organization picker includes A and excludes B',normal.status()===200&&JSON.stringify(choices).includes('CITEST_ORG_A')&&!JSON.stringify(choices).includes('CITEST_ORG_B'));
  for(const shell of ['apps','qapps']){
   for(const screen of ['FindContact','Customers','Vendors','CustomerGroups'])for(const format of ['csv','xlsx']){
    await setOrg('CITEST_ORG_B');
    const rows=await exportRows(shell,screen,{format},'contacts.qa.a');
    check(`${shell} ${screen} ${format}: outside-membership preference cannot expose rows`,rows.length===0,rows.length);
    check(`${shell} ${screen} ${format}: invalid preference normalized by authoritative lookup`,!pref().some(x=>x.preference_value==='CITEST_ORG_B'));
   }
   for(const operation of ['guard','members','update','assign','remove','contactGuard']){
    await setOrg('CITEST_ORG_B');
    const data=await op(shell,operation,{partyId:'CITEST_P14_B_01',groupName:'P14QA Must Never Persist',fromDateInstant:'2024-01-01T00:00:00Z'});
    check(`${shell} ${operation}: outside-membership operation denied`,data.denied===true&&(operation!=='members'||data.memberIds.length===0),data);
   }
   for(const operation of ['createContact','createGroup']){
    await setOrg('CITEST_ORG_B');
    const data=await op(shell,operation,{contactType:'PtyPerson'});
    check(`${shell} ${operation}: outside-membership creation denied without returned ID`,data.denied===true&&!data.partyId&&!data.customerGroupId,data);
   }
   // Positive DB checks protect normal creation and pin ownership despite extra untrusted inputs.
   for(const contactType of ['PtyPerson','PtyOrganization']){
    await setOrg('CITEST_ORG_A');const data=await op(shell,'createContact',{contactType});
    check(`${shell} ${contactType}: permitted creation returns a new contact ID`,!data.denied&&!!data.partyId,data);
    check('New contact identifier is safe for captured DB lookup',/^[A-Za-z0-9_-]+$/.test(data.partyId));
    const rows=query(`SELECT party_id,owner_party_id,party_type_enum_id FROM party WHERE party_id='${data.partyId}'`);
    check(`${shell} ${contactType}: persisted contact belongs to authorized A`,rows.length===1&&rows[0].owner_party_id==='CITEST_ORG_A'&&rows[0].party_type_enum_id===contactType,rows);
    created.push({kind:contactType,id:data.partyId,organization:'CITEST_ORG_A'});
   }
   await setOrg('CITEST_ORG_A');const group=await op(shell,'createGroup');
   check(`${shell}: permitted group creation returns a new ID`,!group.denied&&!!group.customerGroupId,group);
   check('New group identifier is safe for captured DB lookup',/^[A-Za-z0-9_-]+$/.test(group.customerGroupId));
   const rows=query(`SELECT customer_group_id,organization_party_id,group_name FROM customer_group WHERE customer_group_id='${group.customerGroupId}'`);
   check(`${shell}: new group persisted in authorized A`,rows.length===1&&rows[0].organization_party_id==='CITEST_ORG_A'&&rows[0].group_name==='P14QA Functional Created',rows);
   created.push({kind:'group',id:group.customerGroupId,organization:'CITEST_ORG_A'});
  }
  await setOrg('CITEST_ORG_A');
  check('Outside-organization contacts, groups and memberships remain unchanged',JSON.stringify(foreignState())===before);
  report.organizationMembership={productionAccess:false,created,foreignFixturesUnchanged:true,originalOrganizationRestored:true};
 }finally{if(browser)await browser.close();}
};
