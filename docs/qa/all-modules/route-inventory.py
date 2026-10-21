"""Inventory registered screens and their native write transitions for audit coverage."""
import json,sys,xml.etree.ElementTree as ET
from pathlib import Path

root=Path(__file__).resolve().parents[3]
app='component://zenith-erp-app/screen/zenith/ZenithApp.xml'
selected={'Stores','sales','Inventory','pos','tax','Purchase','Crm','Contacts','pricing','barcode','my-subscription','saas-admin','subscriptions'}
def local(uri):
    if not uri.startswith('component://'): raise ValueError(uri)
    return root/'component'/uri.removeprefix('component://')
mounts={}
for conf in (root/'component').glob('*/MoquiConf.xml'):
    for screen in ET.parse(conf).getroot().findall('./screen-facade/screen'):
        for item in screen.findall('subscreens-item'):
            mounts.setdefault(screen.get('location'),{})[item.get('name')]=item.get('location')
screens=[]; errors=[]
def visit(uri,route,ancestors=()):
    if uri in ancestors: errors.append({'route':route,'error':'Recursive mount'}); return
    path=local(uri)
    if not path.is_file(): errors.append({'route':route,'error':'Missing screen','source':str(path.relative_to(root))}); return
    document=ET.parse(path).getroot()
    if document.tag!='screen': return
    screens.append({'route':route,'source':path.relative_to(root).as_posix(),'required':[p.get('name') for p in document.findall('parameter') if p.get('required')=='true'],'title':document.get('default-menu-title'),
        'transitions':[{'name':t.get('name'),'method':t.get('method'),'services':[c.get('name') for c in t.findall('.//service-call')]} for t in document.findall('transition')]})
    children={}
    folder=path.with_suffix('')
    if folder.is_dir():
        for child in folder.glob('*.xml'): children[child.stem]='component://'+child.relative_to(root/'component').as_posix()
    for child in document.findall('./subscreens/subscreens-item'): children[child.get('name')]=child.get('location')
    children.update(mounts.get(uri,{}))
    for name,target in children.items(): visit(target,route+'/'+name,(*ancestors,uri))

for name,uri in mounts.get(app,{}).items():
    if name in selected: visit(uri,'/zenith/'+name)
visit('component://zenith-erp-app/screen/zenith/Dashboard.xml','/zenith/Dashboard')
missing=selected-set(r['route'].split('/')[2] for r in screens)
result={'screens':screens,'errors':errors,'missingModules':sorted(missing),'modules':{name:sum(s['route'].split('/')[2]==name for s in screens) for name in sorted(selected|{'Dashboard'})}}
out=Path(sys.argv[1]) if len(sys.argv)>1 else None
if out: out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'modules':result['modules'],'screens':len(screens),'requiresIds':sum(bool(s['required']) for s in screens),'errors':errors,'missingModules':sorted(missing)},indent=2))
if errors or missing: sys.exit(1)
