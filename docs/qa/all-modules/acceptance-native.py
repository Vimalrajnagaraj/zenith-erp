"""Reuse the existing Shops/My Subscription assertions with an independent H2 fixture adapter.

Only database transport, Postgres JSON fingerprints and date syntax are adapted.
No service assertion is removed or softened. CI retains PostgreSQL acceptance.
"""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
assert os.environ.get('MODULE_QA_DISPOSABLE')=='true'
profile=sys.argv[1];assert profile in ('shops','mysub')
os.environ['MODULE_QA_PROFILE']=profile
here=Path(__file__).resolve().parent
java=Path(os.environ['MODULE_QA_JAVA']);jar=Path(os.environ['MODULE_QA_H2'])
out=Path(os.environ['MODULE_QA_OUT']);out.mkdir(parents=True,exist_ok=True)
subprocess.run([str(java.with_name('javac.exe')),'-d',str(out),str(here/'ModuleFixtureDb.java')],check=True)

def jdbc(statement):
 result=subprocess.run([str(java),'-cp',str(out)+os.pathsep+str(jar),'ModuleFixtureDb'],input=statement,text=True,encoding='utf-8',capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError(result.stderr)
 return json.loads(result.stdout)

def native_sql(statement):
 if 'md5(string_agg' in statement:
  tables=list(dict.fromkeys(re.findall(r'from ([a-z_]+)\b',statement)))
  rows=[]
  for table in tables:rows.extend((table,json.dumps(row,sort_keys=True)) for row in jdbc('SELECT * FROM '+table))
  return hashlib.sha256(json.dumps(sorted(rows)).encode()).hexdigest()
 if statement.startswith('select row_to_json('):
  return json.dumps(jdbc(re.sub(r'select row_to_json\([a-z]+\)::text','SELECT *',statement)),sort_keys=True)
 statement=re.sub(r"current_date\s*\+\s*interval '1 month'","DATEADD('MONTH',1,CURRENT_DATE)",statement,flags=re.I)
 statement=re.sub(r'current_date\s*([+-])\s*(\d+)',lambda m:"DATEADD('DAY',"+('-' if m[1]=='-' else '')+m[2]+',CURRENT_DATE)',statement,flags=re.I)
 rows=jdbc(statement)
 return '\n'.join('|'.join('' if v is None else str(v) for v in row.values()) for row in rows)

folder='shops-runtime' if profile=='shops' else 'my-subscription-runtime'
source=(here.parent/folder/'acceptance.py').read_text(encoding='utf-8')
db_line=next(line for line in source.splitlines() if line.startswith("DB='"))
assert "docker','inspect'" in db_line
source=source.replace(db_line,"DB='native-disposable-memory'",1)
old="def sql(q):return subprocess.check_output(['docker','exec','-i',DB,'psql','-U','moqui','-d','moqui','-v','ON_ERROR_STOP=1','-Atc',q],text=True).strip()"
assert source.count(old)==1
source=source.replace(old,'sql=native_sql',1)
# Keep rejection details outside the repository; never print generated fixture secrets.
source=source.replace("record(name,not r.get('errors'));return r.get('result',{})", "record(name,not r.get('errors'));\n if r.get('errors'):print(json.dumps({'failedCase':name,'errors':r['errors']}),flush=True)\n return r.get('result',{})")
if profile=='mysub':source=source.replace('http://127.0.0.1:18086','http://127.0.0.1:18085').replace('u.port==18086','u.port==18085')
os.environ[('SHOPS' if profile=='shops' else 'MYSUB')+'_QA_OUT']=str(out)
exec(compile(source,str(here.parent/folder/'acceptance.py'),'exec'),{'native_sql':native_sql,'__name__':'__main__'})
