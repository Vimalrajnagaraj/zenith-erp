// Import seed/expiry-risk-local.sql into a dedicated disposable database before running.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const base=process.env.EXPIRY_RISK_URL || 'http://127.0.0.1:8083';
const database=process.env.EXPIRY_RISK_DATABASE || 'moqui_expiry_risk_review';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local verification only');
assert(/^moqui_expiry_risk_[a-z0-9_]+$/.test(database),'Dedicated disposable expiry database required');
assert(process.env.SMOKE_PASS,'Set SMOKE_PASS to the existing local demo password');
const sql=s=>execFileSync('docker',['exec','zenith-erp-db-1','psql','-U','moqui','-d',database,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim();
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const rows=s=>JSON.parse(sql(s)||'[]');
const count=(table,where)=>Number(sql(`select count(*) from ${table} where ${where}`));
const asset=id=>JSON.parse(sql(`select row_to_json(a) from asset a where asset_id=${q(id)}`)||'null');
const version=id=>String(Math.trunc(Number(sql(`select extract(epoch from last_updated_stamp)*1000 from asset where asset_id=${q(id)}`))));
const route='/apps/zenith/Inventory/ExpiryDashboard'; const checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS',name);};
async function session(user='expiry.risk.audit') {
 const jar=new Map();let token;
 async function request(path,params,csrf=true,allowRejection=false) {
  const body=params?new URLSearchParams():null;
  if(params) for(const [k,v] of Object.entries({...params,...(csrf?{moquiSessionToken:token}:{})})) body.append(k,String(v));
  let response;
  for(let attempt=0;attempt<45;attempt++) {
   try { response=await fetch(base+path,{redirect:'manual',method:params?'POST':'GET',headers:{...(!jar.size?{Authorization:'Basic '+Buffer.from(`${user}:${process.env.SMOKE_PASS}`).toString('base64')}:{}),Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body});break; }
   catch(error) { if(params || attempt===44) throw error; await new Promise(resolve=>setTimeout(resolve,1000)); }
  }
  for(const entry of response.headers.getSetCookie()){const [k,v]=entry.split(';')[0].split('=');jar.set(k,v);}
  const text=await response.text();token=text.match(/name="moquiSessionToken" value="([^"]+)"/)?.[1]||text.match(/['"]moquiSessionToken['"]\s*:\s*['"]([^'"]+)['"]/)?.[1]||token;
  if(!allowRejection && csrf && (response.status>=500 || /Template Error|Error rendering screen|Exception running actions|Error running service|Error rendering.*form/.test(text))){writeFileSync(process.env.EXPIRY_RISK_ERROR_FILE||'tmp/expiry-risk-error.html',text);assert.fail('Render/server error at '+path);}
  if(!params && response.status===302){const target=new URL(response.headers.get('location'),base);return request(target.pathname+target.search);}
  return {response,text};
 }
 await request(route);assert(token,'Session token obtained');
 await request('/apps/setPreference',{preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:user==='expiry.risk.noorg'?'_NA_':'ERFIX_ORG'});
 return {request,post:(tx,p,csrf=true)=>request(route+'/'+tx,p,csrf),csv:params=>request(route+'/exportCsv?'+new URLSearchParams(params))};
}
let writer;
const create=p=>writer.post('createExpiryStock',{productId:'ERFIX_P',facilityId:'ERFIX_A',receiptRequestId:randomUUID(),quantity:'2.5',unitValue:'4',expiryDate:'2026-11-07',...p});
const edit=(id,p)=>writer.post('updateExpiryStock',{assetId:id,stockVersion:version(id),quantity:asset(id).quantity_on_hand_total,unitValue:asset(id).valuation_rate,expiryDate:'2026-11-07',batchNumber:asset(id).batch_number||'',adjustReason:'PhysicalCount',...p});
const ids=r=>r.text.split(/\r?\n/).slice(1).map(l=>l.match(/^"([^"]+)"/)?.[1]).filter(Boolean);
const assetCount=()=>count('asset',"owner_party_id='ERFIX_ORG'");
try {
 writer=await session();
 check('Seeded fixtures exist before testing',()=>{assert.equal(asset('ERFIX_A1').quantity_on_hand_total,10);assert.equal(count('party',"party_id='ERFIX_ORG'"),1);});
 const all=await writer.csv({withinDays:'all'});
 check('Reports include only available inventory owned by the active organization',()=>{assert(ids(all).includes('ERFIX_A1'));assert(!ids(all).includes('ERFIX_SUPPLY'));assert(!ids(all).includes('ERFIX_BAD_OWNER'));assert(!ids(all).includes('ERFIX_SCRAPPED'));});
 const selected=await writer.csv({withinDays:'all',searchText:'ERFIX-SKU',selIds:'ERFIX_BATCH1,ERFIX_A1'});
 check('Selected export retains search scope instead of exposing nonmatching selected IDs',()=>assert.deepEqual(ids(selected),['ERFIX_A1']));
 const initialPage=await writer.request(route+'?daysBucket=all&pageSize=50&orderByField=-value');
 check('KPI totals keep prospective and expired values separate from the active date bucket',()=>{assert(initialPage.text.includes('98.00'));assert(initialPage.text.includes('32.00'));assert(initialPage.text.includes('value="50" selected'));});
 const pdf=await writer.request('/fop/apps/zenith/Inventory/ExpiryRiskPrint?daysBucket=expired&filename=expiry-risk-test.pdf');
 check('Filtered PDF renders as an actual PDF download',()=>{assert.equal(pdf.response.status,200);assert(pdf.response.headers.get('content-type').includes('application/pdf'));assert(pdf.text.startsWith('%PDF-'));});
 await writer.post('saveView',{viewName:'Expiry review',searchText:'ERFIX-SKU',withinDays:'all',daysBucket:'90+',pageSize:50,orderByField:'-value'});
 check('Saved view retains the date range, sorting and page size for this organization',()=>{const view=JSON.parse(sql("select preference_value from user_preference where user_id='ERFIX_USER' and preference_key='EXPIRY_SAVED_VIEWS_ERFIX_ORG'"))[0];assert.equal(view.daysBucket,'90+');assert.equal(String(view.pageSize),'50');assert.equal(view.orderByField,'-value');assert.equal(count('user_preference',"user_id='ERFIX_USER' and preference_key='EXPIRY_SAVED_VIEWS_ERFIX_OTHER'"),0);});
 await writer.post('saveColumns',{col_batch:'Y',col_supplier:'Y',col_status:'Y',col_quantity:'Y',col_value:'Y'});
 for(const surface of ['apps','qapps']) {const page=await writer.request(`/${surface}/zenith/Inventory/ExpiryDashboard?lastStandalone=true&renderMode=${surface==='qapps'?'qvt':'html'}`);check('Saved column choices reach '+surface,()=>assert(page.text.includes('er-hide-sku')));}
 await writer.post('saveColumns',{col_sku:'Y',col_batch:'Y',col_supplier:'Y',col_status:'Y',col_quantity:'Y',col_value:'Y'});
 await writer.post('emailReport',{});const noEmail=await writer.request(route);
 check('Email report does not claim success when the account has no email address',()=>{assert(!noEmail.text.includes('report emailed to'));assert(noEmail.text.includes('no email address'));});
 const today=all.text.split(/\r?\n/).find(l=>l.startsWith('"ERFIX_TODAY"'));
 check('Expiry-today stays at zero calendar days and explicit zero valuation remains zero',()=>{assert(today.includes('"0","1","0"'));});
 const after=await writer.csv({daysBucket:'90+'});
 check('After-90-days bucket is reachable',()=>assert.deepEqual(ids(after),['ERFIX_B1']));
 for(const [bucket,expected] of [['0-30',['ERFIX_TODAY','ERFIX_A1','ERFIX_A2','ERFIX_S1']],['31-60',['ERFIX_EDGE31','ERFIX_EDGE60']],['61-90',['ERFIX_EDGE61','ERFIX_EDGE90']],['expired',['ERFIX_BATCH1']]]) {
  const report=await writer.csv({daysBucket:bucket});check('Calendar bucket '+bucket+' has exact boundary rows',()=>assert.deepEqual(ids(report).sort(),expected.sort()));
 }
 const invalid=await writer.csv({withinDays:'invalid'});check('Invalid period fails safely',()=>assert(!ids(invalid).includes('ERFIX_A1')));
 let before=assetCount();for(const p of [{productId:'ERFIX_FOREIGN'},{facilityId:'ERFIX_FOREIGN'},{quantity:'-1'},{quantity:'0'},{unitValue:'-1'},{expiryDate:'bad'},{productId:'ERFIX_SERIAL'},{productId:'ERFIX_BATCH',batchNumber:''}]) await create(p);
 check('Invalid, foreign, serial and unlabelled batch receipts cannot create stock',()=>assert.equal(assetCount(),before));
 const previous=rows("select coalesce(json_agg(asset_id),'[]') from asset where owner_party_id='ERFIX_ORG'");await create({});
 const added=rows("select coalesce(json_agg(asset_id),'[]') from asset where owner_party_id='ERFIX_ORG'").find(id=>!previous.includes(id));
 check('Receipt creates usable decimal stock once through the ledger',()=>{assert(added);assert.equal(asset(added).quantity_on_hand_total,2.5);assert.equal(asset(added).available_to_promise_total,2.5);assert.equal(Number(sql(`select sum(quantity_on_hand_diff) from asset_detail where asset_id=${q(added)}`)),2.5);});
 const replayId=randomUUID();before=assetCount();await Promise.all([create({receiptRequestId:replayId}),create({receiptRequestId:replayId})]);await create({receiptRequestId:replayId});
 check('Repeated and concurrent receipt submissions create one asset',()=>assert.equal(assetCount(),before+1));
 await edit('ERFIX_A1',{quantity:1});check('Count cannot remove reserved units',()=>assert.equal(asset('ERFIX_A1').quantity_on_hand_total,10));
 await edit('ERFIX_A1',{quantity:11,adjustReason:'Damage'});check('Damage cannot increase stock',()=>assert.equal(asset('ERFIX_A1').quantity_on_hand_total,10));
 await edit('ERFIX_BAD_OWNER',{quantity:1});check('Foreign lot cannot be edited even by selected-tenant admin',()=>assert.equal(asset('ERFIX_BAD_OWNER').quantity_on_hand_total,100));
 await edit('ERFIX_S1',{quantity:2});check('Serial quantities require the explicit serial workflow',()=>assert.equal(asset('ERFIX_S1').quantity_on_hand_total,3));
 await edit('ERFIX_BATCH1',{batchNumber:'new-identity'});check('Batch identity cannot be replaced by metadata editing',()=>assert.equal(asset('ERFIX_BATCH1').batch_number,'ERFIX-LOT'));
 const stockVersion=version('ERFIX_A1');const edits={assetId:'ERFIX_A1',stockVersion,quantity:'7.25',unitValue:'5',expiryDate:'2026-11-07',adjustReason:'PhysicalCount'};
 const auditBefore=count('stock_adjustment',"organization_party_id='ERFIX_ORG'");await Promise.all([writer.post('updateExpiryStock',edits),writer.post('updateExpiryStock',edits)]);
 check('Concurrent lot edits post once and preserve reserved quantity',()=>{assert.equal(asset('ERFIX_A1').quantity_on_hand_total,7.25);assert.equal(asset('ERFIX_A1').available_to_promise_total,5.25);assert.equal(count('stock_adjustment',"organization_party_id='ERFIX_ORG'"),auditBefore+1);assert.equal(Number(sql("select sum(quantity_on_hand_diff) from asset_detail where asset_id='ERFIX_A1'")),7.25);});
 await writer.post('updateExpiryStock',{...edits,quantity:9});check('Stale edit cannot overwrite newer stock',()=>assert.equal(asset('ERFIX_A1').quantity_on_hand_total,7.25));
 await edit('ERFIX_BATCH1',{quantity:0,adjustReason:'Expiry'});check('Expired lot can be written off to zero',()=>assert.equal(asset('ERFIX_BATCH1').quantity_on_hand_total,0));
 before=assetCount();await writer.request(route+'/createExpiryStock',undefined,true,true);await writer.post('createExpiryStock',{productId:'ERFIX_P',facilityId:'ERFIX_A',receiptRequestId:randomUUID(),quantity:2,unitValue:4,expiryDate:'2026-11-07'},false);
 check('GET and missing-CSRF requests cannot create stock',()=>assert.equal(assetCount(),before));
 const viewer=await session('expiry.risk.viewer');await viewer.post('createExpiryStock',{productId:'ERFIX_P',facilityId:'ERFIX_A',receiptRequestId:randomUUID(),quantity:2,unitValue:4,expiryDate:'2026-11-07'});check('View-only account cannot receive stock',()=>assert.equal(assetCount(),before));
 const noorg=await session('expiry.risk.noorg');const empty=await noorg.csv({withinDays:'all'});await noorg.post('createExpiryStock',{productId:'ERFIX_P',facilityId:'ERFIX_A',receiptRequestId:randomUUID(),quantity:2,unitValue:4,expiryDate:'2026-11-07'});check('Missing organization exposes no stock and allows no write',()=>{assert.equal(ids(empty).length,0);assert.equal(assetCount(),before);});
 const manager=await session('expiry.risk.manager');await manager.request('/apps/setPreference',{preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:'ERFIX_OTHER'});const forged=await manager.csv({withinDays:'all'});check('Forged selected organization cannot bypass membership',()=>assert.equal(ids(forged).length,0));
 await writer.post('saveAlertSettings',{alertDays:'7',alertEnabled:'Y',alertEmail:'N'});check('Alert settings persist only for the active tenant',()=>assert.equal(sql("select setting_value from company_settings where organization_party_id='ERFIX_ORG' and setting_key='EXPIRY_ALERT_DAYS'"),'7'));
 for(const surface of ['apps','qapps']){const page=await writer.request(`/${surface}/zenith/Inventory/ExpiryDashboard?lastStandalone=true&renderMode=${surface==='qapps'?'qvt':'html'}`);check('Expiry page renders on '+surface,()=>{assert.equal(page.response.status,200);assert(page.text.includes('ExpiringAssetsForm'));});}
 console.log(JSON.stringify({passed:checks.length},null,2));
} finally {
 const assets=rows("select coalesce(json_agg(asset_id),'[]') from asset where owner_party_id in ('ERFIX_ORG','ERFIX_OTHER')");
 const adjustments=rows("select coalesce(json_agg(stock_adjustment_id),'[]') from stock_adjustment where organization_party_id in ('ERFIX_ORG','ERFIX_OTHER')");
 const details=assets.length?rows(`select coalesce(json_agg(asset_detail_id),'[]') from asset_detail where asset_id in (${assets.map(q).join(',')})`):[];
 const statements=[];const del=(table,column,values)=>{if(values.length)statements.push(`delete from ${table} where ${column} in (${values.map(q).join(',')});`);};
 del('stock_adjustment_item','stock_adjustment_id',adjustments);del('stock_adjustment','stock_adjustment_id',adjustments);del('product_serial_number','serial_number_id',['ERFIX_SN1','ERFIX_SN2','ERFIX_SN3','ERFIX_SN4']);del('asset_detail','asset_detail_id',details);del('asset','asset_id',assets);
 del('product','product_id',['ERFIX_P','ERFIX_BATCH','ERFIX_SERIAL','ERFIX_NEW','ERFIX_FOREIGN']);del('facility','facility_id',['ERFIX_A','ERFIX_B','ERFIX_FOREIGN']);
 for(const table of ['user_preference','user_group_member','user_account'])del(table,'user_id',['ERFIX_USER','ERFIX_VIEW','ERFIX_NOORG','ERFIX_MANAGER']);
 del('company_settings','organization_party_id',['ERFIX_ORG','ERFIX_OTHER']);del('party_relationship','party_relationship_id',['ERFIX_MEMBERSHIP']);for(const table of ['party_role','organization','party'])del(table,'party_id',['ERFIX_ORG','ERFIX_OTHER','ERFIX_PERSON']);
 writeFileSync(process.env.EXPIRY_RISK_MANIFEST||'tmp/expiry-risk-audit.json',JSON.stringify({assets,adjustments,details,checks},null,2));
 sql('BEGIN;'+statements.join('\n')+'COMMIT;');
 assert.equal(count('asset',"owner_party_id in ('ERFIX_ORG','ERFIX_OTHER')"),0);assert.equal(count('party',"party_id in ('ERFIX_ORG','ERFIX_OTHER','ERFIX_PERSON')"),0);console.log('Captured fixture IDs removed; zero residue verified.');
}
