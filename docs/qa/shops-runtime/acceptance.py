#!/usr/bin/env python3
"""Run only against the fresh labelled Shops stack. No production credentials/data."""
import base64,csv,datetime,io,http.cookiejar,json,os,re,subprocess,urllib.error,urllib.parse,urllib.request
from pathlib import Path
from html.parser import HTMLParser
BASE=os.environ.get('SHOPS_QA_BASE','http://127.0.0.1:18085').rstrip('/')
u=urllib.parse.urlsplit(BASE);assert u.scheme=='http' and u.hostname in ('localhost','127.0.0.1') and u.port==18085
OUT=Path(os.environ.get('SHOPS_QA_OUT','/tmp/zenith-shops-qa/results'));OUT.mkdir(parents=True,exist_ok=True)
DB='zenith-shops-qa-db-1';assert subprocess.check_output(['docker','inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',DB],text=True).strip()=='zenith-shops-qa'
jar=http.cookiejar.CookieJar();http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));path='/apps/zenith/Stores/ShopsQaAcceptance';results=[];token='';user=''
def sql(q):return subprocess.check_output(['docker','exec','-i',DB,'psql','-U','moqui','-d','moqui','-v','ON_ERROR_STOP=1','-Atc',q],text=True).strip()
def login(name):
 global token,user
 jar.clear();user=name
 raw=http.open(urllib.request.Request(BASE+path,headers={'Authorization':'Basic '+base64.b64encode((name+':moqui').encode()).decode()}),timeout=60).read().decode()
 token=re.search(r'name="moquiSessionToken"[^>]*value="([^"]+)"',raw)[1]
def request(p,data=None,csrf=True):
 body=None if data is None else urllib.parse.urlencode({**({'moquiSessionToken':token} if csrf else {}),**data},doseq=True).encode()
 try:
  r=http.open(urllib.request.Request(BASE+p,data=body),timeout=60);return r.status,r.read().decode(),r.geturl()
 except urllib.error.HTTPError as e:return e.code,e.read().decode(),e.url

def call(op,data=None):
 status,raw,url=request(path+('/initialize' if op=='initialize' else '/invoke'),{} if op=='initialize' else {'op':op,'input':json.dumps(data or {})})
 try:return json.loads(raw)
 except json.JSONDecodeError:
  if user=='shops.viewer' and url.endswith('/Dashboard'):return {'errors':['view-only gate']}
  raise AssertionError('QA JSON absent, HTTP '+str(status))

class ShopTableText(HTMLParser):
 def __init__(self):super().__init__();self.depth=0;self.target=None;self.parts=[];self.scripts=0
 def handle_starttag(self,tag,attrs):
  if tag not in {'input','img','br','hr','meta','link','area','base','embed','param','source','track','wbr'}:
   self.depth+=1
   if self.target is None and 'z-listchrome' in dict(attrs).get('class','').split():self.target=self.depth
   if self.target is not None and tag in {'script','style'}:self.scripts+=1
 def handle_startendtag(self,tag,attrs):
  if tag in {'input','img','br','hr','meta','link','area','base','embed','param','source','track','wbr'}:return
  self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  if self.target is not None and tag in {'script','style'}:self.scripts-=1
  if self.depth==self.target:self.target=None
  self.depth-=1
 def handle_data(self,data):
  if self.target is not None and not self.scripts:self.parts.append(data)
def table_text(raw):
 p=ShopTableText();p.feed(raw);return ' '.join(p.parts)

def record(name,ok):
 results.append({'case':name,'passed':bool(ok)});print(('PASS' if ok else 'FAIL')+' '+name,flush=True)
 OUT.joinpath('services-summary.json').write_text(json.dumps({'checks':results},indent=2))
def snapshot():
 return sql("select md5(string_agg(v,'|' order by v)) from (select row_to_json(s)::text v from store s where organization_party_id like 'SHOP_QA_%' union all select row_to_json(h)::text from store_operating_hours h where store_id like 'SHOP_QA_%' union all select row_to_json(t)::text from store_target t where store_id like 'SHOP_QA_%' union all select row_to_json(h)::text from store_holiday h where store_id like 'SHOP_QA_%' union all select row_to_json(f)::text from facility f where owner_party_id like 'SHOP_QA_%' union all select row_to_json(t)::text from pos_terminal t where terminal_id like 'SHOP_QA_%') x")
def denied(name,op,data):
 before=snapshot();r=call(op,data);record(name,bool(r.get('errors')) and snapshot()==before)
def passed(name,op,data):
 r=call(op,data);record(name,not r.get('errors'));return r.get('result',{})
login('john.doe');record('initialize fixture users',call('initialize').get('initialized'))
assert sql("select count(*) from store where store_id in ('SHOP_QA_A_S1','SHOP_QA_B_S1')")=='2'
billing=sql("select md5(string_agg(row_to_json(i)::text,'|' order by invoice_id)) from invoice i")
login('shops.qa')
for shell in ['apps','qapps']:
 before=snapshot();status,html,_=request('/'+shell+'/zenith/Stores/FindStore'+('.qvt' if shell=='qapps' else ''));record(shell+' list GET is read-only',status==200 and snapshot()==before);record(shell+' list header retained','Manage and monitor all company stores' in html)
 if shell=='apps':record('tenant list excludes foreign sentinel','Synthetic Shop A1' in html and 'Synthetic Shop B1' not in html)
 status,html,_=request('/'+shell+'/zenith/Stores/EditStore'+('.qvt' if shell=='qapps' else '')+'?storeId=SHOP_QA_A_S1');record(shell+' own detail HTTP render',status==200 and 'Internal Server Error' not in html)
 _,html,_=request('/'+shell+'/zenith/Stores/EditStore'+('.qvt' if shell=='qapps' else '')+'?storeId=SHOP_QA_B_S1');record(shell+' foreign detail denied','Synthetic Shop B1' not in html)
 status,_,_=request('/'+shell+'/zenith/Stores/FindStore/createStore',{'storeName':'Synthetic CSRF','storeTypeEnumId':'StOwned'},False);record(shell+' POST needs CSRF',status in (401,403))
 before=snapshot();status,_,_=request('/'+shell+'/zenith/Stores/FindStore/createStore');record(shell+' write rejects GET',snapshot()==before)
raw=request(path)[1];token=re.search(r'name="moquiSessionToken"[^>]*value="([^"]+)"',raw)[1]
for label,op,params in [
 ('foreign store','update',dict(storeId='SHOP_QA_B_S1',storeName='denied')),
 ('foreign facility','update',dict(storeId='SHOP_QA_A_S1',facilityId='SHOP_QA_B_F1')),
 ('nonretail facility','create',dict(storeName='Synthetic Warehouse',storeTypeEnumId='StOwned',facilityId='SHOP_QA_WAREHOUSE')),
 ('duplicate facility','create',dict(storeName='Synthetic Duplicate',storeTypeEnumId='StOwned',facilityId='SHOP_QA_A_F1')),
 ('blank name','update',dict(storeId='SHOP_QA_A_S1',storeName='   ')),
 ('negative area','update',dict(storeId='SHOP_QA_A_S1',areaSqFt=-1)),
 ('wrong type','update',dict(storeId='SHOP_QA_A_S1',storeTypeEnumId='TpMonthly')),
 ('foreign manager','update',dict(storeId='SHOP_QA_A_S1',managerPartyId='SHOP_QA_B_M')),
 ('invalid email','update',dict(storeId='SHOP_QA_A_S1',email='invalid')),
 ('invalid status flow','update',dict(storeId='SHOP_QA_A_S1',statusId='StClosed')),
 ('linked facility immutable','update',dict(storeId='SHOP_QA_A_S1',facilityId='SHOP_QA_A_F2')),
 ('invalid day','hours',dict(storeId='SHOP_QA_A_S1',dayOfWeek='Invalid',openTime='09:00',closeTime='18:00')),
 ('invalid time','hours',dict(storeId='SHOP_QA_A_S1',dayOfWeek='Mon',openTime='99:99',closeTime='18:00')),
 ('partial time','hours',dict(storeId='SHOP_QA_A_S1',dayOfWeek='Mon',openTime='09:00')),
 ('foreign hours','hours',dict(storeId='SHOP_QA_B_S1',dayOfWeek='Mon',isClosed='Y')),
 ('reversed dates','target',dict(storeId='SHOP_QA_A_S1',targetPeriodEnumId='TpMonthly',periodStart='2026-10-10',periodEnd='2026-10-01')),
 ('negative target','target',dict(storeId='SHOP_QA_A_S1',targetPeriodEnumId='TpMonthly',periodStart='2026-10-01',periodEnd='2026-10-10',salesTarget=-1)),
 ('invalid target period','target',dict(storeId='SHOP_QA_A_S1',targetPeriodEnumId='StOwned',periodStart='2026-10-01',periodEnd='2026-10-10')),
 ('foreign holiday','holiday',dict(storeId='SHOP_QA_B_S1',holidayDate='2026-10-10')),
 ('foreign configuration','config',dict(storeId='SHOP_QA_B_S1',configKey='synthetic',configValue='denied')),
 ('foreign dashboard','dashboard',dict(storeId='SHOP_QA_B_S1')),
 ('foreign delete','delete',dict(storeId='SHOP_QA_B_S1')),
]:denied(label,op,params)
passed('valid fields','update',dict(storeId='SHOP_QA_A_S1',storeName='Synthetic Shop Renamed',managerPartyId='SHOP_QA_A_M',email='shops@example.invalid',areaSqFt='12.5'))
record('store/facility rename persistence',sql("select count(*) from store s join facility f on f.facility_id=s.facility_id where s.store_id='SHOP_QA_A_S1' and s.store_name=f.facility_name and s.area_sq_ft=12.5")=='1')
for status in ['StInactive','StActive']:passed('status '+status,'update',dict(storeId='SHOP_QA_A_S1',statusId=status))
passed('closed day','hours',dict(storeId='SHOP_QA_A_S1',dayOfWeek='Sun',isClosed='Y'))
passed('overnight hours retained','hours',dict(storeId='SHOP_QA_A_S1',dayOfWeek='Sat',openTime='22:00',closeTime='05:00',isClosed='N'))
passed('target saved','target',dict(storeId='SHOP_QA_A_S1',targetPeriodEnumId='TpMonthly',periodStart='2026-10-01',periodEnd='2026-10-10',salesTarget=100))
passed('holiday saved','holiday',dict(storeId='SHOP_QA_A_S1',holidayDate='2026-10-10',description='Synthetic closure'))
denied('duplicate holiday','holiday',dict(storeId='SHOP_QA_A_S1',holidayDate='2026-10-10'))
passed('configuration saved','config',dict(storeId='SHOP_QA_A_S1',configKey='synthetic',configValue='local-only'))
profile=dict(storeId='SHOP_QA_A_S1',storeName='Synthetic Atomic Save',hDay=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],hOpen=['09:00']*7,hClose=['18:00']*7,hClosed=['N']*7)
denied('incomplete profile','profile',{**profile,'hDay':['Mon']})
denied('invalid last day rolls back earlier days','profile',{**profile,'hClose':['18:00']*6+['bad']})
denied('bad profile fields roll back schedule','profile',{**profile,'areaSqFt':-1})
passed('atomic seven-day save','profile',profile)
record('seven schedule rows persisted',sql("select count(*) from store_operating_hours where store_id='SHOP_QA_A_S1' and open_time='09:00' and close_time='18:00'")=='7')
passed('explicit sync','reconcile',{});before=snapshot();passed('repeat sync','reconcile',{});record('sync idempotence',snapshot()==before)
record('one profile per retail facility',sql("select count(*) from store where organization_party_id='SHOP_QA_A'")=='2')
r=passed('create automatic facility','create',dict(storeName='Synthetic New Store',storeTypeEnumId='StOwned',city='Synthetic City'));id=r.get('storeId');assert id
record('created facility owner/type persistence',sql("select count(*) from store s join facility f on f.facility_id=s.facility_id where s.store_id='"+id+"' and f.owner_party_id=s.organization_party_id and f.facility_type_enum_id='FcTpRetailStore'")=='1')
passed('new store configuration','config',dict(storeId=id,configKey='synthetic',configValue='cleanup'))
passed('delete unused store','delete',dict(storeId=id));record('deleted child gone',sql("select count(*) from store_configuration where store_id='"+id+"'")=='0')
passed('create after sequence gap','create',dict(storeName='Synthetic After Gap',storeTypeEnumId='StOwned'))
record('unique shop codes',sql("select count(*) from (select store_code from store where organization_party_id='SHOP_QA_A' group by store_code having count(*)>1) x")=='0')
try:r=call('delete',dict(storeId='SHOP_QA_A_S1'))
except AssertionError:r={'errors':['reference constraint']}
record('used facility deletion rolls back profile/children',bool(r.get('errors')) and sql("select count(*) from store where store_id='SHOP_QA_A_S1'")=='1' and sql("select count(*) from store_operating_hours where store_id='SHOP_QA_A_S1'")=='7')
other=sql("select store_id from store where facility_id='SHOP_QA_A_F2'")
denied('counter session history cannot move shops','assign',dict(storeId=other,terminalId='SHOP_QA_COUNTER'))
passed('assign same shop counter','assign',dict(storeId='SHOP_QA_A_S1',terminalId='SHOP_QA_COUNTER'))
call('forgeScope');denied('forged scope rejected','update',dict(storeId='SHOP_QA_B_S1',storeName='denied'));call('resetScope')
today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date().isoformat()
passed('today target','target',dict(storeId='SHOP_QA_A_S1',targetPeriodEnumId='TpDaily',periodStart=today,periodEnd=today,salesTarget='123.45'))
passed('today holiday','holiday',dict(storeId='SHOP_QA_A_S1',holidayDate=today,description='Synthetic today'))
r=passed('dashboard date boundary','dashboard',dict(storeId='SHOP_QA_A_S1'))
record('today remains in targets and holidays',any(datetime.datetime.fromtimestamp(t['periodEnd']/1000,datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date().isoformat()==today for t in r.get('currentTargets',[])) and any(datetime.datetime.fromtimestamp(h['holidayDate']/1000,datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date().isoformat()==today for h in r.get('holidays',[])))
for shell in ['apps','qapps']:
 status,raw,url=request('/'+shell+'/zenith/Stores/FindStore/createStore',{'storeName':'Synthetic HTTP '+shell,'storeTypeEnumId':'StOwned'})
 record(shell+' create stays in original shell',status==200 and '/'+shell+'/zenith/Stores/EditStore?storeId=' in url)
 newId=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).get('storeId',[''])[0]
 assert newId and sql("select count(*) from store where store_id='"+newId+"' and organization_party_id='SHOP_QA_A'")=='1'
 status,raw,url=request('/'+shell+'/zenith/Stores/EditStore/updateStore',{'storeId':newId,'email':'native@example.invalid'})
 record(shell+' update stays in original shell',status==200 and '/'+shell+'/zenith/Stores/EditStore?storeId=' in url and sql("select email from store where store_id='"+newId+"'")=='native@example.invalid')
 before=snapshot();status,raw,url=request('/'+shell+'/zenith/Stores/EditStore/updateStore',{'storeId':newId,'areaSqFt':-1})
 record(shell+' validation returns original shell without write',status==200 and '/'+shell+'/zenith/Stores/EditStore?storeId=' in url and snapshot()==before)
login('shops.viewer');status,raw,url=request('/apps/zenith/Stores/FindStore');record('viewer reads own list without create or sync','Synthetic Atomic Save' in raw and '>New Store</button>' not in raw and 'class="zc-shop-sync"' not in raw)
denied('view-only direct write denied','update',dict(storeId='SHOP_QA_A_S1',storeName='denied'))
login('john.doe');call('clearScope');before=snapshot();_,raw,_=request('/apps/zenith/Stores/FindStore');record('no-org list fail-closed','Synthetic Shop' not in raw and snapshot()==before);denied('no-org create denied','create',dict(storeName='Synthetic No Org',storeTypeEnumId='StOwned'));call('resetScope')
login('shops.qa')
sql("insert into store (store_id,store_name,store_code,store_type_enum_id,facility_id,organization_party_id,manager_party_id,status_id) values ('SHOP_QA_LEGACY','Synthetic Legacy','LEGACY','StOwned','SHOP_QA_B_F1','SHOP_QA_A','SHOP_QA_B_M','StActive')")
for shell in ['apps','qapps']:
 status,raw,_=request('/'+shell+'/zenith/Stores/FindStore'+('.qvt' if shell=='qapps' else ''))
 record(shell+' legacy foreign linked labels masked',status==200 and 'Synthetic Legacy' in raw and 'Synthetic Shop B1' not in raw and 'Synthetic Manager B' not in raw)
 status,raw,_=request('/'+shell+'/zenith/Stores/FindStore?renderMode=csv&pageNoLimit=true&lastStandalone=true')
 record(shell+' CSV tenant and legacy label scope',status==200 and next(csv.reader(io.StringIO(raw)))[:2]==['Code','Store'] and 'Synthetic Legacy' in raw and 'Synthetic Shop B1' not in raw and 'Synthetic Manager B' not in raw)
r=passed('legacy dashboard read','dashboard',dict(storeId='SHOP_QA_LEGACY'))
record('legacy dashboard masks foreign labels',not r.get('store',{}).get('facilityName') and not r.get('store',{}).get('managerFirstName'))
for i in range(10):passed('pagination fixture '+str(i),'create',dict(storeName='Synthetic Page Check '+str(i).zfill(2),storeTypeEnumId='StOwned'))
passed('last-page search fixture','create',dict(storeName='ZZZ Synthetic Last Page',storeTypeEnumId='StOwned'))
for shell in ['apps','qapps']:
 suffix='.qvt' if shell=='qapps' else ''
 status,raw,_=request('/'+shell+'/zenith/Stores/FindStore'+suffix+'?pageSize=10&pageIndex=0')
 record(shell+' first page excludes last-page sentinel',status==200 and 'ZZZ Synthetic Last Page' not in table_text(raw))
 status,raw,_=request('/'+shell+'/zenith/Stores/FindStore'+suffix+'?pageSize=10&pageIndex=1')
 record(shell+' second page includes last-page sentinel',status==200 and 'ZZZ Synthetic Last Page' in table_text(raw))
 status,raw,_=request('/'+shell+'/zenith/Stores/FindStore'+suffix+'?storeName=ZZZ%20Synthetic&storeName_op=contains&storeName_ic=Y')
 record(shell+' server search finds last-page sentinel',status==200 and 'ZZZ Synthetic Last Page' in table_text(raw) and 'Synthetic Atomic Save' not in table_text(raw))
record('billing invoices unchanged',sql("select md5(string_agg(row_to_json(i)::text,'|' order by invoice_id)) from invoice i")==billing)
failed=[r['case'] for r in results if not r['passed']];print(f'{len(results)-len(failed)}/{len(results)} passed')
if failed:raise SystemExit('Failed: '+', '.join(failed))
