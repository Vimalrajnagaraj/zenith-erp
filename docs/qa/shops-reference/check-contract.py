#!/usr/bin/env python3
"""Compare functional contracts with the reviewed master base; never mutate runtime data."""
import subprocess,sys,xml.etree.ElementTree as ET,re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
BASE=sys.argv[1] if len(sys.argv)>1 else 'origin/master'
def old(p):return subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT).decode('utf-8')
def now(p):return (ROOT/p).read_text(encoding='utf-8')
def same_nodes(p,tags):
 a,b=ET.fromstring(old(p)),ET.fromstring(now(p))
 for tag in tags:
  assert [ET.tostring(x) for x in a.findall('.//'+tag)]==[ET.tostring(x) for x in b.findall('.//'+tag)],p+': '+tag
 print(p+': functional XML contracts unchanged')
for name in ['FindStore','EditStore']:
 same_nodes('component/zenith-erp-stores/screen/zenith/stores/'+name+'.xml',['transition','actions','form-list','form-single'])
p='component/zenith-erp-app/screen/zenithstatic/js/shops.js'
s=re.sub(r"        // The narrow Quasar toolbar wraps;.*?(?=        if \(!document.getElementById)",'',now(p),flags=re.S)
assert s==old(p),'Shops business/event handlers changed'
print('Shops handlers byte-identical after excluding isolated header measurement')
p='component/zenith-erp-app/screen/zenith/ZenithApp.xml'
asset='shops-reference'
s='\n'.join(x for x in now(p).split('\n') if asset+'.css' not in x)
assert s==old(p),'Shared app changed beyond two asset registrations'
print('Both native asset registrations are the only shared-app change')
