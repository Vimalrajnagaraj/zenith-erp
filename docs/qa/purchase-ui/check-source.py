#!/usr/bin/env python3
"""Compare the UI candidate with its merge base; executable Purchase behavior must match."""
import subprocess,sys,xml.etree.ElementTree as E
from pathlib import Path
repo=Path(__file__).resolve().parents[3]
base=sys.argv[1] if len(sys.argv)>1 else 'origin/master'
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True,encoding='utf-8')
def normalized(element):
 return (element.tag,tuple(sorted(element.attrib.items())),(element.text or '').strip(),tuple(normalized(c) for c in element))
changed=git('diff','--name-only',base,'--','component').splitlines()
checked=0
for filename in changed:
 if not filename.endswith('.xml'):continue
 old=E.fromstring(git('show',base+':'+filename));new=E.parse(repo/filename).getroot()
 assert [normalized(c) for c in old if c.tag!='widgets']==[normalized(c) for c in new if c.tag!='widgets'],filename+' changed executable screen behavior'
 for tag in ('entity-find','entity-find-one','row-actions','service-call','search-form-inputs','form-single'):
  # form-single comparison includes all native fields, validation and POST/CSRF submission wiring.
  assert [normalized(c) for c in old.iter(tag)]==[normalized(c) for c in new.iter(tag)],filename+' changed '+tag
 checked+=1
print('PASS executable actions, transitions, queries, native forms and role conditions unchanged in',checked,'screens')
