#!/usr/bin/env python3
"""Tax service acceptance; requires the explicit disposable JVM guard and loopback only."""
import base64, http.cookiejar, json, os, re, urllib.parse, urllib.request
from decimal import Decimal
from pathlib import Path
BASE=os.environ.get('TAX_QA_BASE','http://localhost:8087').rstrip('/')
u=urllib.parse.urlsplit(BASE)
assert u.scheme=='http' and u.hostname in ('localhost','127.0.0.1') and u.port in (8080,8087), 'Disposable loopback only'
OUT=Path(os.environ.get('TAX_QA_OUT','/tmp/zenith-tax-qa/results'));OUT.mkdir(parents=True,exist_ok=True)
jar=http.cookiejar.CookieJar();http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def login(user):
 global token,current_user
 jar.clear();current_user=user
 req=urllib.request.Request(BASE+'/apps/zenith/tax/TaxQaAcceptance',headers={'Authorization':'Basic '+base64.b64encode((user+':moqui').encode()).decode()})
 html=http.open(req,timeout=60).read().decode();m=re.findall(r'name="moquiSessionToken"[^>]*value="([^"]+)"',html)
 assert m,'Authenticated page and CSRF token required';token=m[0]
def post(op,data=None):
 fields={'moquiSessionToken':token}
 if op=='initialize':endpoint=op
 else:endpoint='invoke';fields.update(op=op,input=json.dumps(data or {}))
 request=urllib.request.Request(BASE+'/apps/zenith/tax/TaxQaAcceptance/'+endpoint,data=urllib.parse.urlencode(fields).encode())
 response=http.open(request,timeout=60);raw=response.read().decode()
 try:return json.loads(raw)
 except json.JSONDecodeError:
  if current_user=='tax.viewer' and response.geturl()==BASE+'/apps/zenith/Dashboard':return {'errors':['Your role has view-only access'],'deniedBeforeService':True}
  raise
results=[]
def check(name,op,data,predicate,error=False):
 try:
  response=post(op,data)
  passed=bool(response.get('errors')) if error else not response.get('errors') and predicate(response.get('result',{}))
  results.append({'case':name,'passed':bool(passed),'response':response})
 except Exception as exc:results.append({'case':name,'passed':False,'exception':str(exc)})
 OUT.joinpath('services.json').write_text(json.dumps(results,indent=2))
 print(('PASS' if results[-1]['passed'] else 'FAIL')+' '+name,flush=True)
def eq(actual,expected):return Decimal(str(actual))==Decimal(str(expected))
def taxdata(slab='GST_18',price=100,**extra):
 item={'quantity':1,'unitAmount':price,'taxCategoryId':slab};item.update(extra.pop('item',{}))
 return {'organizationPartyId':'TAX_QA_A','originRegionGeoId':'29','destinationRegionGeoId':'29','items':[item],**extra}
login('john.doe')
if os.environ.get('TAX_QA_INITIALIZE','1')=='1':assert post('initialize').get('initialized')
login('tax.qa');post('resetScope')
for slab,rate in [('GST_EXEMPT',0),('GST_5',5),('GST_12',12),('GST_18',18),('GST_28',28)]:
 check('exclusive '+slab,'tax',taxdata(slab),lambda r,rate=rate:eq(r['totalAmount'],100+rate) and eq(r['totalTaxAmount'],rate))
for name,inputs,base,tax,total in [
 ('inclusive fractional GST',taxdata('GST_0_25',100,item={'isTaxInclusive':'Y'}),99.75,0.25,100),
 ('inclusive paisa',taxdata(item={'isTaxInclusive':'Y'}),84.75,15.25,100),
 ('inclusive cess',taxdata('GST_28_CESS_12',140,item={'isTaxInclusive':'Y'}),100,40,140),
 ('inclusive RCM',taxdata(isReverseCharge='Y',item={'isTaxInclusive':'Y'}),100,0,100),
 ('inclusive LUT export',taxdata(destinationCountryGeoId='USA',item={'isTaxInclusive':'Y'}),100,0,100),
 ('inclusive SEZ LUT',taxdata(isSezSupply='Y',item={'isTaxInclusive':'Y'}),100,0,100),
 ('export with payment and cess',taxdata('GST_28_CESS_12',100,destinationCountryGeoId='USA',isWithPayment='Y'),100,40,140),
 ('product exemption overrides slab',taxdata(item={'productId':'TAX_QA_PEX'}),100,0,100),
 ('discount',taxdata(item={'quantity':2,'discountAmount':50}),150,27,177),
 ('zero quantity stays zero',taxdata(item={'quantity':0}),0,0,0),
]:check(name,'tax',inputs,lambda r,base=base,tax=tax,total=total:eq(r['totalTaxableAmount'],base) and eq(r['totalTaxAmount'],tax) and eq(r['totalAmount'],total) and all(eq(sum(Decimal(str(b['taxAmount'])) for b in i['taxBreakdowns']),i['totalTaxAmount']) for i in r['taxedItems']))
check('interstate IGST','tax',taxdata(destinationRegionGeoId='27'),lambda r:eq(r['totalTaxAmount'],18) and r['taxedItems'][0]['taxBreakdowns'][0]['taxName']=='IGST')
for name,inputs in [('negative quantity',taxdata(item={'quantity':-1})),('negative price',taxdata(price=-1)),('excess discount',taxdata(item={'discountAmount':101})),('bad state',taxdata(destinationRegionGeoId='99')),('foreign product',taxdata(item={'productId':'TAX_QA_PB'})),('foreign calculation org',taxdata(organizationPartyId='TAX_QA_B'))]:check(name,'tax',inputs,lambda r:False,error=True)
for gstin,valid in [('29ABCDE1234F1ZW',True),(' 29abcde1234f1zw ',True),('29ABCDE1234F1Z5',False),('99ABCDE1234F1ZW',False),('short',False)]:check('GSTIN '+('valid' if valid else 'invalid')+' '+str(len(gstin)),'gstin',{'gstin':gstin},lambda r,valid=valid:r['isValid']==valid)
check('country-specific registration','getRegistration',{'partyId':'TAX_QA_CUST','countryGeoId':'USA'},lambda r:not r.get('registrationNumber'))
check('foreign party registration denied','getRegistration',{'partyId':'TAX_QA_FOREIGN','countryGeoId':'IND'},lambda r:False,error=True)
reg={'partyId':'TAX_QA_CUST','taxAuthorityId':'TAX_QA_AUTH','registrationTypeEnumId':'TrtGstin','registrationNumber':'27ABCDE1234F1Z0','countryGeoId':'IND','regionGeoId':'27'}
check('registration invalid checksum denied','registration',{**reg,'registrationNumber':'27ABCDE1234F1Z5'},lambda r:False,error=True)
check('registration reversed dates denied','registration',{**reg,'effectiveFrom':'2026-10-10','effectiveThru':'2026-10-01'},lambda r:False,error=True)
check('registration foreign org denied','registration',{**reg,'organizationPartyId':'TAX_QA_B'},lambda r:False,error=True)
check('foreign registration delete denied','deleteRegistration',{'registrationId':'TAX_QA_REG_B'},lambda r:False,error=True)
check('foreign exemption delete denied','deleteExemption',{'exemptionId':'TAX_QA_EX_B'},lambda r:False,error=True)
check('foreign exemption update denied','exemption',{'exemptionId':'TAX_QA_EX_B','partyId':'TAX_QA_FOREIGN','taxAuthorityId':'TAX_QA_AUTH','exemptionTypeEnumId':'TexFull'},lambda r:False,error=True)
check('party-only exemption matches product context','checkExemption',{'partyId':'TAX_QA_CUST','productId':'TAX_QA_P18','taxAuthorityId':'TAX_QA_AUTH'},lambda r:r['isExempt'])
check('partial exemption is not full exemption','checkExemption',{'productId':'TAX_QA_P18','taxAuthorityId':'TAX_QA_AUTH'},lambda r:not r['isExempt'])
for period in ['132026','002026','0726','xx2026']:
 check('invalid return period '+period,'gstr1',{'organizationPartyId':'TAX_QA_A','returnPeriod':period},lambda r:False,error=True)
check('filing year mismatch','gstr1',{'organizationPartyId':'TAX_QA_A','returnPeriod':'032026','financialYear':'2026-2027'},lambda r:False,error=True)
check('foreign filing generation denied','gstr1',{'organizationPartyId':'TAX_QA_B','returnPeriod':'072026'},lambda r:False,error=True)
check('foreign filing export denied','exportGstr1',{'filingId':'TAX_QA_FILING_B'},lambda r:False,error=True)
check('GSTR1 issued only','gstr1',{'organizationPartyId':'TAX_QA_A','returnPeriod':'072026','financialYear':'2026-2027'},lambda r:r['invoiceCount']==2 and bool(r['filingId']))
check('cess and round-off charged separately','charged',{'invoiceId':'TAX_QA_INV_PURCHASE'},lambda r:eq(r['taxable'],100) and eq(r['cess'],12) and eq(r['cgst'],14) and eq(r['sgst'],14))
check('GSTR2 tenant+period match isolation and cess','gstr2',{'organizationPartyId':'TAX_QA_A','returnPeriod':'072026'},lambda r:eq(r['totalCess'],12) and r['matchedCount']==0 and r['unmatchedCount']==1)
check('GSTR3B excludes draft/foreign and includes cess','gstr3b',{'organizationPartyId':'TAX_QA_A','returnPeriod':'072026'},lambda r:eq(r['table31']['taxableValue'],110100) and eq(r['table4']['cess'],12))
check('Sales caller creates tax-inclusive GST invoice','sales',{'organizationPartyId':'TAX_QA_A','customerPartyId':'TAX_QA_CUST','currencyUomId':'INR','items':[{'productId':'TAX_QA_P18','quantity':1,'unitAmount':100}]},lambda r:bool(r.get('invoiceId')))
purchase=post('purchase',{'organizationPartyId':'TAX_QA_A','vendorPartyId':'TAX_QA_CUST','currencyUomId':'INR','vendorInvoiceNumber':'TAX_QA_CROSS_PURCHASE'})
results.append({'case':'Purchase caller creates draft','passed':not purchase.get('errors') and bool(purchase.get('result',{}).get('invoiceId')),'response':purchase})
purchase_id=purchase.get('result',{}).get('invoiceId')
if purchase_id:check('Purchase caller taxes item with document ownership','purchaseItem',{'invoiceId':purchase_id,'productId':'TAX_QA_P18','quantity':1,'unitAmount':100},lambda r:bool(r.get('invoiceItemSeqId')))
check('external provider mock prohibited','globalTax',{'tenantId':'TAX_QA_A','items':[{'quantity':1,'unitAmount':100}]},lambda r:False,error=True)
check('provider hostname lookalike denied','engine',{'tenantId':'TAX_QA_A','providerEnumId':'TpAvalara','apiEndpoint':'https://avatax.attacker.invalid','apiKey':'synthetic','apiSecret':'synthetic'},lambda r:False,error=True)
check('e-Invoice mock prohibited','einvoice',{'invoiceId':'TAX_QA_INV_A'},lambda r:False,error=True)
check('e-Way mock prohibited','eway',{'invoiceId':'TAX_QA_INV_A'},lambda r:False,error=True)
check('TCS 206C1H discontinued','tcs',{'organizationPartyId':'TAX_QA_A','customerPartyId':'TAX_QA_CUST','invoiceAmount':6000000,'financialYear':'2026-2027'},lambda r:r['tcsApplicable']=='N' and eq(r['tcsAmount'],0))
check('master rates cannot be changed by tenant admin','rate',{'taxName':'synthetic','rate':18},lambda r:False,error=True)
check('forged org preference resolves membership','forgeScope',{},lambda r:True)
check('forged preference cannot grant foreign access','deleteRegistration',{'registrationId':'TAX_QA_REG_B'},lambda r:False,error=True)
post('resetScope')
check('foreign tax document denied','taxLines',{'referenceType':'InvoiceItem','referenceId':'TAX_QA_INV_FOREIGN'},lambda r:False,error=True)
check('fake PIN distance prohibited','distance',{'fromPincode':'560001','toPincode':'600001'},lambda r:False,error=True)
check('fake payment QR prohibited','qr',{'invoiceId':'TAX_QA_INV_A','upiId':'synthetic@invalid','merchantName':'Disposable'},lambda r:False,error=True)
check('foreign TCS tracker denied','tracker',{'organizationPartyId':'TAX_QA_B','customerPartyId':'TAX_QA_FOREIGN','financialYear':'2026-2027','invoiceAmount':100},lambda r:False,error=True)
login('tax.viewer')
check('viewer cannot save exemption','exemption',{'organizationPartyId':'TAX_QA_A','partyId':'TAX_QA_CUST','taxAuthorityId':'TAX_QA_AUTH','exemptionTypeEnumId':'TexFull'},lambda r:False,error=True)
check('viewer cannot generate filing','gstr1',{'organizationPartyId':'TAX_QA_A','returnPeriod':'072026'},lambda r:False,error=True)
OUT.joinpath('services.json').write_text(json.dumps(results,indent=2))
failed=[r['case'] for r in results if not r['passed']]
print(f'{len(results)-len(failed)}/{len(results)} service cases passed',flush=True)
if failed:raise SystemExit('Failed: '+', '.join(failed))
