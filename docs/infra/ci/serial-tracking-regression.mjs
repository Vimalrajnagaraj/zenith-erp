// Import seed/serial-tracking-local.sql into a dedicated disposable database first.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const base=process.env.SERIAL_TRACKING_URL||'http://127.0.0.1:8084';
const database=process.env.SERIAL_TRACKING_DATABASE||'moqui_serial_number_tracking_review';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert(/^moqui_serial_number_tracking_[a-z0-9_]+$/.test(database));
assert(process.env.SMOKE_PASS,'Provide the existing local demo password privately');
const sql=s=>execFileSync('docker',['exec','zenith-erp-db-1','psql','-U','moqui','-d',database,'-At','-v','ON_ERROR_STOP=1','-c',s],{encoding:'utf8'}).trim();
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const rows=s=>JSON.parse(sql(s)||'[]');
const count=(table,where)=>Number(sql(`select count(*) from ${table} where ${where}`));
const route='/apps/zenith/Inventory/SerialNumbers';const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS',name);}
async function session(user='serial.tracking.audit'){
 const jar=new Map();let token;
 async function request(path,params,csrf=true){
  const response=await fetch(base+path,{redirect:'manual',method:params?'POST':'GET',headers:{...(!jar.size?{Authorization:'Basic '+Buffer.from(user+':'+process.env.SMOKE_PASS).toString('base64')}:{}),Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')},body:params?new URLSearchParams({...params,...(csrf?{moquiSessionToken:token}:{})}):undefined});
  for(const entry of response.headers.getSetCookie()){const [key,value]=entry.split(';')[0].split('=');jar.set(key,value);}
  const text=await response.text();token=text.match(/name="moquiSessionToken" value="([^"]+)"/)?.[1]||text.match(/['"]moquiSessionToken['"]\s*:\s*['"]([^'"]+)['"]/)?.[1]||text.match(/moquiSessionToken\s*=\s*['"]([^'"]+)['"]/)?.[1]||token;
  if(csrf&&(response.status>=500||/Template Error|Error rendering screen|Exception running actions|Error running service/.test(text))){writeFileSync(process.env.SERIAL_TRACKING_ERROR_FILE||'tmp/serial-tracking-error.html',text);assert.fail('Server/render error at '+path);}
  if(!params&&response.status===302){const next=new URL(response.headers.get('location'),base);return request(next.pathname+next.search);}
  return {response,text};
 }
 await request(route);assert(token,'Session token available');
 await request('/apps/setPreference',{preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:user==='serial.tracking.noorg'?'_NA_':'SNFIX_ORG'});
 return {request,post:(name,p,csrf=true)=>request(route+'/'+name,p,csrf),csv:p=>request(route+'/exportCsv?'+new URLSearchParams(p))};
}
const total=()=>count('product_serial_number',"product_id in ('SNFIX_P','SNFIX_BATCH','SNFIX_OFF')");
const status=id=>sql(`select status_id from product_serial_number where serial_number_id=${q(id)}`);
let writer;
const register=p=>writer.post('registerSerial',{productId:'SNFIX_P',facilityId:'SNFIX_A',serialNumber:'SAMPLE-REGISTERED',receivedDate:new Date().toISOString().slice(0,10),...p});
try{
 writer=await session();
 const report=await writer.csv({});
 check('CSV contains only the selected organization',()=>{assert(report.text.includes('SAMPLE-SR-001'));assert(!report.text.includes('FOREIGN-SR-001'));assert.equal(report.response.status,200);});
 const page=await writer.request(route);
 check('Summary counts and product/facility choices are scoped',()=>{assert(!page.text.includes('Foreign Serial Product'));assert(!page.text.includes('Foreign Serial Warehouse'));assert(page.text.includes('Total Serials'));});
 const before=total();
 for(const p of [{serialNumber:' '},{serialNumber:'a'.repeat(101)},{productId:'SNFIX_OFF'},{productId:'SNFIX_FOREIGN'},{facilityId:'SNFIX_FOREIGN'},{facilityId:''},{receivedDate:'invalid'},{receivedDate:'2099-01-01'},{warrantyExpiryDate:'2000-01-01'},{supplierPartyId:'SNFIX_OTHER'},{productId:'SNFIX_BATCH',batchNumber:''}])await register(p);
 check('Invalid serials, dates, untracked products, foreign choices and missing batches are rejected',()=>assert.equal(total(),before));
 await register({supplierPartyId:'SNFIX_SUP',serialNumber:'  Sample-Registered  ',warrantyExpiryDate:'2027-10-30',statusId:'SnSold',assetId:'forged',customerPartyId:'SNFIX_OTHER'});
 const registered=rows("select json_agg(t) from (select serial_number_id,status_id,serial_number,asset_id,customer_party_id,warranty_expiry_date from product_serial_number where serial_number='Sample-Registered' and product_id='SNFIX_P') t")[0];
 check('Registration trims identity, preserves warranty and fixes initial status without mass assignment',()=>{assert(registered);assert.equal(registered.status_id,'SnInStock');assert.equal(registered.asset_id,null);assert.equal(registered.customer_party_id,null);assert.equal(registered.warranty_expiry_date,'2027-10-30');});
 check('Registration writes one audit record',()=>assert.equal(count('serial_number_history',`serial_number_id=${q(registered.serial_number_id)} and event_type='Register'`),1));
 await register({serialNumber:'sample-registered'});
 check('Case-insensitive duplicate registration is rejected',()=>assert.equal(total(),before+1));
 await Promise.all([register({serialNumber:'SAMPLE-CONCURRENT'}),register({serialNumber:'SAMPLE-CONCURRENT'})]);
 check('Concurrent submissions register one identity',()=>assert.equal(count('product_serial_number',"serial_number='SAMPLE-CONCURRENT' and product_id='SNFIX_P'"),1));
 await writer.post('updateSerialStatus',{serialNumberId:'SNFIX_1',expectedStatusId:'SnInStock',statusId:'SnSold',facilityId:'SNFIX_FOREIGN'});
 check('Tracking cannot fabricate a sale or relocate stock',()=>{assert.equal(status('SNFIX_1'),'SnInStock');assert.equal(sql("select facility_id from product_serial_number where serial_number_id='SNFIX_1'"),'SNFIX_A');});
 await writer.post('updateSerialStatus',{serialNumberId:'SNFIX_1',expectedStatusId:'SnInStock',statusId:'SnDefective',notes:'Sample metadata lifecycle'});
 check('Allowed identity lifecycle change writes audit',()=>{assert.equal(status('SNFIX_1'),'SnDefective');assert.equal(count('serial_number_history',"serial_number_id='SNFIX_1' and from_status_id='SnInStock' and to_status_id='SnDefective'"),1);});
 await writer.post('updateSerialStatus',{serialNumberId:'SNFIX_1',expectedStatusId:'SnInStock',statusId:'SnInWarranty'});
 check('Stale status changes do not overwrite a newer state',()=>assert.equal(status('SNFIX_1'),'SnDefective'));
 await writer.post('updateSerialStatus',{serialNumberId:'SNFIX_1',expectedStatusId:'SnDefective',statusId:'SnInWarranty'});
 check('Invalid lifecycle transition is rejected',()=>assert.equal(status('SNFIX_1'),'SnDefective'));
 await writer.post('updateSerialStatus',{serialNumberId:'SNFIX_F',expectedStatusId:'SnSold',statusId:'SnReturned'});
 check('Foreign serial cannot be mutated',()=>assert.equal(status('SNFIX_F'),'SnSold'));
 const n=total();await writer.post('registerSerial',{productId:'SNFIX_P',facilityId:'SNFIX_A',serialNumber:'SAMPLE-NO-CSRF'},false);const getRejected=await writer.request(route+'/registerSerial?productId=SNFIX_P&facilityId=SNFIX_A&serialNumber=SAMPLE-GET',undefined,false);assert(getRejected.response.status>=400);
 check('GET and missing-CSRF requests cannot register stock identities',()=>assert.equal(total(),n));
 const viewer=await session('serial.tracking.viewer');await viewer.post('registerSerial',{productId:'SNFIX_P',facilityId:'SNFIX_A',serialNumber:'SAMPLE-VIEW'});
 check('Read-only user cannot register a serial',()=>assert.equal(total(),n));
 const noorg=await session('serial.tracking.noorg');const empty=await noorg.csv({});await noorg.post('registerSerial',{productId:'SNFIX_P',facilityId:'SNFIX_A',serialNumber:'SAMPLE-NOORG'});
 check('Missing organization exposes no serials and permits no writes',()=>{assert(!empty.text.includes('SAMPLE-SR'));assert(!empty.text.includes('FOREIGN-SR'));assert.equal(total(),n);});
 const manager=await session('serial.tracking.manager');await manager.request('/apps/setPreference',{preferenceKey:'ACTIVE_ORGANIZATION',preferenceValue:'SNFIX_OTHER'});const forged=await manager.csv({});
 check('Forged organization selection cannot bypass membership',()=>assert(!forged.text.includes('FOREIGN-SR')));
 sql("insert into product_serial_number (serial_number_id,product_id,serial_number,facility_id,status_id,received_date) select 'SNFIX_FILL_'||n,'SNFIX_P','SAMPLE-FILL-'||n,'SNFIX_A','SnInStock',CURRENT_DATE from generate_series(1,12) n");
 const found=await writer.csv({serialNumber:'SAMPLE-FILL-',serialNumber_op:'begins',pageSize:10,pageIndex:1});
 check('Server search and CSV include all matches across pagination',()=>assert.equal(found.text.split(/\r?\n/).filter(l=>l.startsWith('"SAMPLE-FILL-')).length,12));
 const second=await writer.request(route+'?serialNumber=SAMPLE-FILL-&serialNumber_op=begins&pageSize=10&pageIndex=1&orderByField=serialNumber');
 if(!second.text.includes('SAMPLE-FILL-8'))writeFileSync(process.env.SERIAL_TRACKING_ERROR_FILE||'tmp/serial-tracking-error.html',second.text);
 check('Search pagination returns the second page on the server',()=>{assert(second.text.includes('SAMPLE-FILL-8'));assert(!second.text.includes('SAMPLE-FILL-1"'));});
 await register({serialNumber:'=SAMPLE-FORMULA',notes:'Sample CSV test'});const escaped=await writer.csv({serialNumber:'=SAMPLE-FORMULA'});
 check('CSV neutralizes spreadsheet formula strings',()=>assert(escaped.text.includes('"\'=SAMPLE-FORMULA"')));
 for(const surface of ['apps','qapps']){const rendered=await writer.request(`/${surface}/zenith/Inventory/SerialNumbers?lastStandalone=true&renderMode=${surface==='qapps'?'qvt':'html'}`);check('Serial page renders on '+surface,()=>{assert.equal(rendered.response.status,200);assert(rendered.text.includes('SerialListForm'));});}
 console.log(JSON.stringify({passed:checks.length}));
}finally{
 const serials=rows("select coalesce(json_agg(serial_number_id),'[]') from product_serial_number where product_id in ('SNFIX_P','SNFIX_BATCH','SNFIX_OFF','SNFIX_FOREIGN')");
 const history=rows(`select coalesce(json_agg(history_id),'[]') from serial_number_history where serial_number_id in (${serials.map(q).join(',')||'NULL'})`);
 const statements=[];const del=(t,k,v)=>{if(v.length)statements.push(`delete from ${t} where ${k} in (${v.map(q).join(',')});`);};
 del('serial_number_history','history_id',history);del('product_serial_number','serial_number_id',serials);del('product','product_id',['SNFIX_P','SNFIX_BATCH','SNFIX_OFF','SNFIX_FOREIGN']);del('facility','facility_id',['SNFIX_A','SNFIX_FOREIGN']);
 for(const t of ['user_preference','user_group_member','user_account'])del(t,'user_id',['SNFIX_USER','SNFIX_VIEW','SNFIX_NOORG','SNFIX_MANAGER']);
 del('party_relationship','party_relationship_id',['SNFIX_MEMBERSHIP']);for(const t of ['party_role','organization','party'])del(t,'party_id',['SNFIX_ORG','SNFIX_OTHER','SNFIX_PERSON','SNFIX_SUP']);
 writeFileSync(process.env.SERIAL_TRACKING_MANIFEST||'tmp/serial-tracking-audit.json',JSON.stringify({serials,history,checks},null,2));
 sql('BEGIN;'+statements.join('\n')+'COMMIT;');assert.equal(count('party',"party_id in ('SNFIX_ORG','SNFIX_OTHER','SNFIX_PERSON','SNFIX_SUP')"),0);assert.equal(count('product_serial_number',"product_id in ('SNFIX_P','SNFIX_BATCH','SNFIX_OFF','SNFIX_FOREIGN')"),0);
 console.log('Captured fixture IDs removed; zero residue verified.');
}
