#!/usr/bin/env python3
"""Read-only Purchase render checks around explicit, guarded fixture setup/cleanup."""
import base64, csv, html as html_module, http.cookiejar, io, json, os, re, urllib.parse, urllib.request
from pathlib import Path
BASE=os.environ.get('PURCHASE_UI_QA_BASE','http://localhost:8088').rstrip('/')
u=urllib.parse.urlsplit(BASE)
assert u.scheme=='http' and u.hostname in ('localhost','127.0.0.1') and u.port==8088, 'Disposable loopback only'
OUT=Path(os.environ.get('PURCHASE_UI_QA_OUT','/tmp/purchase-ui-qa'));OUT.mkdir(parents=True,exist_ok=True)
jar=http.cookiejar.CookieJar();http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
HELPER='/apps/zenith/pricing/PurchaseUiQaAcceptance'
def login(user):
 global token
 jar.clear()
 req=urllib.request.Request(BASE+HELPER,headers={'Authorization':'Basic '+base64.b64encode((user+':moqui').encode()).decode()})
 html=http.open(req,timeout=60).read().decode()
 m=re.findall(r'name="moquiSessionToken"[^>]*value="([^"]+)"',html)
 assert m,'Authenticated page and CSRF token required';token=m[0]
def post(operation):
 req=urllib.request.Request(BASE+HELPER+'/'+operation,data=urllib.parse.urlencode({'moquiSessionToken':token}).encode())
 return json.loads(http.open(req,timeout=60).read().decode())
PAGES={'GoodsReceipt':'Goods Receipt Notes','FindPurchaseOrder':'Purchase Orders','FindPurchaseInvoice':'Vendor Bills (ITC)','CreatePurchaseInvoice':'Log Vendor Bill','PurchaseInvoices':'Purchase Invoices &amp; GSTR-2B','PurchaseReturns':'Purchase Returns','JobWorkChallan':'Job Work Challan Management','RfqList':'Requests for Quotation (RFQ)','Gstr2bRecon':'GSTR-2B Reconciliation','VendorEvaluation':'Vendor Evaluations'}
if __name__=='__main__':
 import sys
 if '--cleanup' in sys.argv:
  login('john.doe');print(json.dumps(post('cleanup')));raise SystemExit()
 if '--initialize' in sys.argv:
  login('john.doe');assert post('initialize').get('initialized');print('PASS guarded fixture initialized');raise SystemExit()
 login('purchase.pricing.qa');results=[]
 # /qapps is verified in a real browser. This HTTP check verifies Bootstrap renders only.
 for surface in ('apps',):
  for route,title in PAGES.items():
   path=f'/{surface}/zenith/Purchase/{route}'
   # Quasar screen payload is requested by the SPA itself. A shell 200 is not sufficient.
   query='?renderMode=qvt&lastStandalone=true' if surface=='qapps' else ''
   html=http.open(BASE+path+query,timeout=60).read().decode()
   passed=title in html and 'zc-purchase-page' in html and 'Error rendering screen' not in html
   results.append({'surface':surface,'page':route,'passed':passed})
   exports=re.findall(r'href="([^"]*renderMode=csv[^"]*)"',html)
   for export in dict.fromkeys(exports):
    path=html_module.unescape(export)
    parsed=urllib.parse.urlsplit(urllib.parse.urljoin(BASE,path))
    assert parsed.hostname==u.hostname and parsed.port==u.port,'Local export only'
    content=http.open(urllib.parse.urlunsplit(parsed),timeout=60).read().decode('utf-8-sig')
    rows=list(csv.reader(io.StringIO(content)))
    assert rows and title.replace('&amp;','&') not in rows[0][0],route+' leaked page chrome into CSV'
    assert all(len(row)==len(rows[0]) for row in rows[1:]),route+' CSV column mismatch'
    OUT.joinpath(route+'.csv').write_text(content,encoding='utf-8')
    print('PASS CSV '+route+' ('+str(len(rows)-1)+' rows, '+str(len(rows[0]))+' columns)')
   print(('PASS' if passed else 'FAIL')+' '+surface+' '+route)
 OUT.joinpath('renders.json').write_text(json.dumps(results,indent=2))
 assert all(r['passed'] for r in results),'Render failure; see renders.json'
