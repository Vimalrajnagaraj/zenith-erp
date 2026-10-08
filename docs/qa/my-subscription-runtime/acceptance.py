#!/usr/bin/env python3
"""Run only against the fresh labelled My Subscription stack. No production credentials/data."""
import base64,hashlib,hmac,http.cookiejar,json,os,secrets,subprocess,urllib.error,urllib.parse,urllib.request
from pathlib import Path
from datetime import date
assert date(2026,10,1) <= date.today() < date(2026,11,1), "Refresh the documented synthetic period before rerunning outside October 2026"
BASE=os.environ.get('MYSUB_QA_BASE','http://127.0.0.1:18086').rstrip('/')
u=urllib.parse.urlsplit(BASE);assert u.scheme=='http' and u.hostname in ('localhost','127.0.0.1') and u.port==18086
OUT=Path(os.environ.get('MYSUB_QA_OUT','/tmp/zenith-mysub-qa/results'));OUT.mkdir(parents=True,exist_ok=True)
DB='zenith-mysub-qa-db-1';assert subprocess.check_output(['docker','inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',DB],text=True).strip()=='zenith-mysub-qa'
jar=http.cookiejar.CookieJar();http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));path='/apps/zenith/my-subscription/MySubscriptionQa';results=[];token='';user=''
def sql(q):return subprocess.check_output(['docker','exec','-i',DB,'psql','-U','moqui','-d','moqui','-v','ON_ERROR_STOP=1','-Atc',q],text=True).strip()
def login(name):
 global token,user
 jar.clear();user=name
 raw=http.open(urllib.request.Request(BASE+path+'/token',headers={'Authorization':'Basic '+base64.b64encode((name+':moqui').encode()).decode()}),timeout=60).read().decode()
 token=json.loads(raw)["token"]
def request(p,data=None,csrf=True):
 body=None if data is None else urllib.parse.urlencode({**({'moquiSessionToken':token} if csrf else {}),**data},doseq=True).encode()
 try:
  r=http.open(urllib.request.Request(BASE+p,data=body),timeout=60);return r.status,r.read().decode(),r.geturl()
 except urllib.error.HTTPError as e:return e.code,e.read().decode(),e.url

def call(op,data=None):
 status,raw,url=request(path+('/initialize' if op=='initialize' else '/invoke'),{} if op=='initialize' else {'op':op,'input':json.dumps(data or {})})
 try:return json.loads(raw)
 except json.JSONDecodeError:
  if user=='mysub.view' and url.endswith('/Dashboard'):return {'errors':['view-only gate']}
  raise AssertionError('QA JSON absent, HTTP '+str(status))


def record(name,ok):
 results.append({'case':name,'passed':bool(ok)});print(('PASS' if ok else 'FAIL')+' '+name,flush=True)
 OUT.joinpath('services-summary.json').write_text(json.dumps({'checks':results},indent=2))
def snapshot():
 return sql("select md5(string_agg(v,'|' order by v)) from (select row_to_json(t)::text v from saas_tenant t union all select row_to_json(s)::text from saas_subscription s union all select row_to_json(i)::text from saas_invoice i union all select row_to_json(p)::text from saas_payment p union all select row_to_json(a)::text from saas_audit_log a union all select row_to_json(u)::text from saas_usage u) x")
def denied(name,op,data):
 before=snapshot();r=call(op,data);record(name,bool(r.get('errors')) and snapshot()==before)
def passed(name,op,data):
 r=call(op,data);record(name,not r.get('errors'));return r.get('result',{})
# Guard the actual fixture state; no acceptance against missing fixtures or an earlier run.
assert sql("select count(*) from saas_tenant where tenant_id in ('MYSUB_QA_A','MYSUB_QA_B','MYSUB_QA_T','MYSUB_QA_S')")=='4'
assert sql("select count(*) from user_account where user_id in ('MYSUB_QA_OWNER','MYSUB_QA_VIEW','MYSUB_QA_NONE') and disabled='Y'")=='3'
login('john.doe');record('fresh fixture initialization',call('initialize').get('initialized'))
billing=sql("select md5(string_agg(row_to_json(i)::text,'|' order by invoice_id)) from invoice i")
foreign=sql("select row_to_json(t)::text from saas_tenant t where tenant_id='MYSUB_QA_B'")
login('mysub.owner')
for shell in ['apps','qapps']:
 before=snapshot();status,raw,_=request('/'+shell+'/zenith/my-subscription'+('.qvt' if shell=='qapps' else ''))
 record(shell+' content renders, GET is read-only',status==200 and 'mysub-wrap' in raw and snapshot()==before)
 record(shell+' excludes foreign invoice','MYSUB_QA_A' in raw and 'MYSUB_QA_B' not in raw)
 record(shell+' native CSRF supplied','mysub-session-token' in raw)
 for tx in ['changePlan','cancelSubscription','initiatePayment','verifyPayment']:
  before=snapshot();status,_,_=request('/'+shell+'/zenith/my-subscription/'+tx);record(shell+' '+tx+' GET never executes write',status==405 and snapshot()==before)
  before=snapshot();status,_,_=request('/'+shell+'/zenith/my-subscription/'+tx,{'newPlanId':'STARTER','saasInvoiceId':'MYSUB_QA_A'},False);record(shell+' '+tx+' rejects missing CSRF',status in (401,403) and snapshot()==before)
passed('current tenant usage','usage',{'tenantId':'MYSUB_QA_A'})
record('two unique enabled seats, active POS, null-status store',sql("select active_users || '|' || pos_terminals || '|' || total_stores from saas_usage where tenant_id='MYSUB_QA_A'")=='2|1|1')
for label,op,p in [
 ('foreign plan','change',dict(tenantId='MYSUB_QA_B',newPlanId='STARTER')),
 ('foreign cancel','cancel',dict(tenantId='MYSUB_QA_B')),
 ('foreign usage','usage',dict(tenantId='MYSUB_QA_B')),
 ('foreign limits','limits',dict(tenantId='MYSUB_QA_B',planId='ENTERPRISE')),
 ('foreign payment order','order',dict(saasInvoiceId='MYSUB_QA_B')),
 ('cancelled invoice','order',dict(saasInvoiceId='MYSUB_QA_CANCEL')),
 ('invalid billing cycle','change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER',billingCycle='Invalid')),
 ('mid-period cycle switch','change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER',billingCycle='Yearly')),
 ('same-plan repeat','change',dict(tenantId='MYSUB_QA_A',newPlanId='GROWTH')),
 ('missing usage plan','limits',dict(tenantId='MYSUB_QA_A',planId='MYSUB_QA_MISSING')),
 ('missing plan','change',dict(tenantId='MYSUB_QA_A',newPlanId='MYSUB_QA_MISSING')),
 ('missing provider config','order',dict(saasInvoiceId='MYSUB_QA_A')),
 ('invalid payment signature','verify',dict(saasInvoiceId='MYSUB_QA_A',razorpay_order_id='order_QA',razorpay_payment_id='pay_QA',razorpay_signature='invalid')),
]:denied(label,op,p)
login('mysub.view')
for op,p in [('change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER')),('cancel',dict(tenantId='MYSUB_QA_A')),('order',dict(saasInvoiceId='MYSUB_QA_A')),('usage',dict(tenantId='MYSUB_QA_A'))]:denied('viewer '+op,op,p)
status,raw,_=request('/apps/zenith/my-subscription');record('viewer can read, cannot see write/payment controls',status==200 and 'mysub-wrap' in raw and 'saas-pay-btn' not in raw and 'id="CancelDialog-button"' not in raw)
call('forgeScope');denied('forged org cannot cancel victim','cancel',dict(tenantId='MYSUB_QA_B'));call('resetScope')
login('mysub.none');denied('no membership ignores editable org','cancel',dict(tenantId='MYSUB_QA_A'))
status,raw,_=request('/apps/zenith/my-subscription');record('no membership renders unavailable','mysub-wrap' not in raw and 'Subscription Unavailable' in raw)
login('mysub.owner')
# Positive mutation through the actual browser transition, independently assert the database.
status,raw,_=request('/apps/zenith/my-subscription/changePlan',dict(newPlanId='PROFESSIONAL',billingCycle='Monthly'))
record('owner transition upgrade',status==200 and sql("select plan_id from saas_tenant where tenant_id='MYSUB_QA_A'")=='PROFESSIONAL')
record('upgrade preserves prepaid dates',sql("select start_date || '|' || renewal_date from saas_subscription where tenant_id='MYSUB_QA_A' and status_id='SubActive'")=='2026-10-01|2026-11-01')
record('upgrade leaves one live subscription',sql("select count(*) from saas_subscription where tenant_id='MYSUB_QA_A' and status_id in ('SubActive','SubTrial')")=='1')
record('proration reconciles exclusive GST and grand',sql("select count(*) from saas_invoice where tenant_id='MYSUB_QA_A' and invoice_number like 'SAAS-%' and subtotal>0 and round(subtotal*0.18,2)=tax_amount and subtotal+tax_amount=total_amount and status_id='SiSent'")=='1')
count=sql("select count(*) from saas_invoice where tenant_id='MYSUB_QA_A'")
passed('immediate downgrade','change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER'))
record('downgrade persisted without additional invoice or time reset',sql("select plan_id from saas_tenant where tenant_id='MYSUB_QA_A'")=='STARTER' and sql("select count(*) from saas_invoice where tenant_id='MYSUB_QA_A'")==count and sql("select renewal_date from saas_subscription where tenant_id='MYSUB_QA_A' and status_id='SubActive'")=='2026-11-01')
beforeCount=sql("select count(*) from saas_invoice where tenant_id='MYSUB_QA_A'")
passed('restore previously committed plan','change',dict(tenantId='MYSUB_QA_A',newPlanId='PROFESSIONAL'))
record('downgrade and restore never bills the same price difference twice',sql("select count(*) from saas_invoice where tenant_id='MYSUB_QA_A'")==beforeCount)
passed('return to starter','change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER'))
# Enable the third synthetic seat to prove usage-limit enforcement at the service boundary.
sql("update user_account set disabled='N' where user_id='MYSUB_QA_DISABLED'")
passed('growth upgrade','change',dict(tenantId='MYSUB_QA_A',newPlanId='GROWTH'))
denied('downgrade with three seats','change',dict(tenantId='MYSUB_QA_A',newPlanId='STARTER'))
sql("update user_account set disabled='Y' where user_id='MYSUB_QA_DISABLED'")
passed('cancel own subscription','cancel',dict(tenantId='MYSUB_QA_A',reason='Disposable test cancellation'))
before=snapshot();passed('cancellation repeat','cancel',dict(tenantId='MYSUB_QA_A'));record('cancellation repeat is a no-op',snapshot()==before)
record('cancel retains access only through retained period',sql("select count(*) from saas_subscription where tenant_id='MYSUB_QA_A' and status_id='SubCancelled' and auto_renew='N' and end_date='2026-11-01'")=='1' and sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_A'")=='SaasTenantActive')
login('john.doe')
# ADMIN services accept explicit target; ordinary org preference remains scoped for tenant screens.
passed('platform admin activates trial plan','change',dict(tenantId='MYSUB_QA_T',newPlanId='PROFESSIONAL'))
record('trial retired, tenant active',sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_T'")=='SaasTenantActive' and sql("select count(*) from saas_subscription where tenant_id='MYSUB_QA_T' and status_id='SubTrial'")=='0')
# Renewal resets the period's committed price; stale higher-tier basis must not survive a renewal.
sql("update saas_subscription set renewal_date=current_date where tenant_id='MYSUB_QA_T' and status_id='SubActive'")
passed('renew synthetic current period','renew',{})
record('renewal resets start, amount and proration basis',sql("select count(*) from saas_subscription where tenant_id='MYSUB_QA_T' and status_id='SubActive' and start_date=current_date and renewal_date=current_date+interval '1 month' and proration_base_amount=amount and amount=2499")=='1')
before=snapshot();passed('renewal repeat','renew',{});record('renewal repeat does not duplicate charges',snapshot()==before)
# Use known synthetic org selector for read-only suspended account rendering.
login('mysub.owner');call('suspendedScope')
for shell in ['apps','qapps']:
 status,raw,_=request('/'+shell+'/zenith/my-subscription'+('.qvt' if shell=='qapps' else ''));record(shell+' suspended account reaches own payment page',status==200 and 'mysub-wrap' in raw and 'MYSUB_QA_S' in raw)
login('john.doe')
sql("update saas_subscription set renewal_date=null where subscription_id='MYSUB_QA_B'")
denied('cancellation without period end','cancel',dict(tenantId='MYSUB_QA_B'))
sql("update saas_subscription set renewal_date='2026-11-01' where subscription_id='MYSUB_QA_B'")
passed('platform admin cancel future period','cancel',dict(tenantId='MYSUB_QA_B'))
passed('future cancellation not expired','expire',dict(subscriptionId='MYSUB_QA_B'))
record('future period access preserved',sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_B'")=='SaasTenantActive')
sql("update saas_subscription set end_date=current_date-1 where subscription_id='MYSUB_QA_B'")
passed('elapsed cancellation expires','expire',dict(subscriptionId='MYSUB_QA_B'))
record('expired cancellation stops access',sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_B'")=='SaasTenantCancelled')
before=snapshot();passed('cancel expiry repeat','expire',dict(subscriptionId='MYSUB_QA_B'));record('expiry idempotent',snapshot()==before)
# Caller cannot reactivate a suspended account without a confirmed receipt.
denied('unpaid reactivation','reactivate',dict(tenantId='MYSUB_QA_S',paymentId='pay_QA_MISSING'))
record('financial Invoice rows untouched',sql("select md5(string_agg(row_to_json(i)::text,'|' order by invoice_id)) from invoice i")==billing)
# Authenticate a synthetic provider event against a generated disposable secret. This proves
# real webhook/DB behavior, not a hosted Razorpay Checkout or actual bank capture.
assert sql("select count(*) from company_settings where organization_party_id='ZETAERP' and setting_key in ('RAZORPAY_WEBHOOK_SECRET','RAZORPAY_KEY_SECRET')")=='0'
secret=secrets.token_hex(32)
for key in ['RAZORPAY_WEBHOOK_SECRET','RAZORPAY_KEY_SECRET']:
 sql("insert into company_settings (organization_party_id,setting_key,setting_value) values ('ZETAERP','"+key+"','"+secret+"')")
sql("update saas_invoice set gateway_order_id='order_MYSUBQAS', gateway_order_amount=total_amount where saas_invoice_id='MYSUB_QA_S'")
def webhook(payment,valid=True):
 raw=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':payment}}},separators=(',',':')).encode()
 sig=hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest() if valid else 'invalid'
 req=urllib.request.Request(BASE+'/razorpay-webhook',data=raw,headers={'Content-Type':'application/json','X-Razorpay-Signature':sig})
 try:r=http.open(req,timeout=60);return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
payment=dict(id='pay_MYSUBQAS',order_id='order_MYSUBQAS',status='captured',amount=117882,currency='INR',method='upi')
for name,paymentOverride,signatureValid in [
 ('invalid webhook signature',{},False),('webhook wrong amount',{'amount':1},True),
 ('webhook wrong currency',{'currency':'USD'},True),('substring order must not match',{'order_id':'MYSUBQAS'},True),
 ('authorized is not captured',{'status':'authorized'},True)]:
 before=snapshot();status,raw=webhook({**payment,**paymentOverride},signatureValid);record(name,snapshot()==before and (signatureValid or status==400))
before=snapshot();status,_,_=request('/razorpay-webhook');record('webhook GET is method-rejected and read-only',status==405 and snapshot()==before)
signed_raw=json.dumps({'event':'ignored'},separators=(',',':'))
raw_sig=hmac.new(secret.encode(),signed_raw.encode(),hashlib.sha256).hexdigest()
before=snapshot();r=passed('signed raw body controls webhook service','webhook',dict(rawBody=signed_raw,webhookSignature=raw_sig,webhookBody={'event':'payment.captured','payload':{'payment':{'entity':payment}}}))
record('unsigned separate payload cannot settle an invoice',r.get('accepted') and snapshot()==before)
status,raw=webhook(payment)
record('signed captured webhook accepted',status==200 and json.loads(raw).get('status')=='ok')
record('webhook payment and invoice persist atomically',sql("select count(*) from saas_payment p join saas_invoice i on i.saas_invoice_id=p.saas_invoice_id where p.gateway_payment_id='pay_MYSUBQAS' and p.amount=i.total_amount and p.status_id='SpSuccess' and i.status_id='SiPaid'")=='1')
record('paid suspended tenant reactivated',sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_S'")=='SaasTenantActive')
before=snapshot();webhook(payment);record('webhook replay is a no-op',snapshot()==before)
sig=hmac.new(secret.encode(),b'order_MYSUBQAS|pay_MYSUBQAS',hashlib.sha256).hexdigest()
r=passed('confirmed payment callback replay','verify',dict(saasInvoiceId='MYSUB_QA_S',razorpay_order_id='order_MYSUBQAS',razorpay_payment_id='pay_MYSUBQAS',razorpay_signature=sig))
record('callback replay succeeds without duplicate DB writes',r.get('success') and snapshot()==before)
# The existing platform invoice screen must keep working after receipt verification is strengthened.
login('mysub.owner');call('resetScope')
denied('tenant cannot record manual platform payment','manual',dict(saasInvoiceId='MYSUB_QA_A'))
sql("update saas_tenant set status_id='SaasTenantSuspended' where tenant_id='MYSUB_QA_S'; update saas_subscription set status_id='SubPastDue' where tenant_id='MYSUB_QA_S'; insert into saas_invoice (saas_invoice_id,tenant_id,status_id,subtotal,tax_amount,total_amount,currency_uom_id) values ('MYSUB_QA_MANUAL1','MYSUB_QA_S','SiOverdue',10,1.8,11.8,'INR'),('MYSUB_QA_MANUAL2','MYSUB_QA_S','SiOverdue',10,1.8,11.8,'INR')")
login('john.doe')
passed('platform admin records first manual payment','manual',dict(saasInvoiceId='MYSUB_QA_MANUAL1'))
record('partial manual settlement leaves other overdue invoice and suspension',sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_S'")=='SaasTenantSuspended' and sql("select status_id from saas_invoice where saas_invoice_id='MYSUB_QA_MANUAL2'")=='SiOverdue')
passed('platform admin records remaining manual payment','manual',dict(saasInvoiceId='MYSUB_QA_MANUAL2'))
record('manual receipts reconcile and reactivate only fully settled tenant',sql("select count(*) from saas_payment where tenant_id='MYSUB_QA_S' and payment_gateway='Manual' and status_id='SpSuccess' and amount=11.8")=='2' and sql("select status_id from saas_tenant where tenant_id='MYSUB_QA_S'")=='SaasTenantActive')
before=snapshot();passed('manual payment repeat','manual',dict(saasInvoiceId='MYSUB_QA_MANUAL2'));record('manual payment repeat is a no-op',snapshot()==before)
# Return to the synthetic owner for UI tests. Nothing leaves this disposable database.
login('mysub.owner');call('resetScope')
if not all(x['passed'] for x in results):raise SystemExit('Acceptance failures')
