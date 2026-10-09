/* Preserve native Columns/Saved Finds; search and paging always query the server. */
(function(){
 'use strict';
 function enhance(){
  var root=document.getElementById('serialTracking');if(!root)return;
  var slot=root.querySelector('.sn-native-controls');
  if(slot){
   ['Columns','Saved Finds'].forEach(function(label){
    if(Array.from(slot.querySelectorAll('button,a')).some(function(n){return n.textContent.trim().includes(label);}))return;
    var control=Array.from(root.querySelectorAll('.form-list-nav-row button,.form-list-nav-row a')).find(function(n){return n.textContent.trim().includes(label);});
    if(!control && label==='Saved Finds' && !document.body.classList.contains('zq-nav')){
     control=root.querySelector('.form-list-nav-row button[data-target$="_hdialog"]');
     if(control){control.textContent='Saved Finds';control.setAttribute('aria-label','Saved Finds');}
    }
    if(control){control.classList.add('sn-tool');slot.appendChild(control.parentElement?.parentElement?.tagName==='SPAN' ? control.parentElement.parentElement : control);}
   });
   if(slot.querySelectorAll('.sn-tool').length===2)root.classList.add('sn-enhanced');
  }
  Array.from(root.querySelectorAll('.sn-header button,.sn-header a')).forEach(function(n){if(n.textContent.includes('Register Serial')){n.classList.add('sn-register');if(!n.querySelector('.sn-plus')){var icon=document.createElement('span');icon.className='sn-plus';icon.textContent='＋';icon.setAttribute('aria-hidden','true');(n.querySelector('.q-btn__content')||n).prepend(icon);}}});
  var pagePath=location.pathname; root.querySelectorAll('.sn-search,.sn-reset,.sn-footer a').forEach(function(n){var attr=n.tagName==='FORM'?'action':'href';var url=new URL(n.getAttribute(attr),location.origin);url.pathname=pagePath;n.setAttribute(attr,url.pathname+url.search);});
  if(root.dataset.snBound)return;root.dataset.snBound='true';
  root.addEventListener('submit',function(e){if(!e.target.matches('.sn-search'))return;e.preventDefault();var url=new URL(e.target.action,location.origin);new FormData(e.target).forEach(function(value,key){url.searchParams.set(key,value);});url.searchParams.delete('pageIndex');location.assign(url.href);});
  root.addEventListener('change',function(e){if(!e.target.matches('.sn-page-size'))return;var url=new URL(location.href);url.searchParams.set('pageSize',e.target.value);url.searchParams.set('pageIndex','0');location.assign(url.href);});
 }
 var queued=false;
 new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance();});}).observe(document.documentElement,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
