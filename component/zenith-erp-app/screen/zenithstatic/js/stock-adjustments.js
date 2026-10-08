/* Presentation enhancement only; Moqui owns filters, dialog forms and page totals. */
(function () {
 'use strict';
 if (window.__stockAdjustmentsBoot) return;
 window.__stockAdjustmentsBoot=true;
 var scheduled=false,moved=[];
 function node(tag,cls,text) {var n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;}
 function icon(name) {var n=node('span','material-icons',name);n.setAttribute('aria-hidden','true');return n;}
 function button(label,glyph,action,cls) {var b=node('button',cls||'sa-page-button');b.type='button';b.title=label;b.setAttribute('aria-label',label);if(glyph)b.appendChild(icon(glyph));b.addEventListener('click',action);return b;}
 function enhance(root) {
  var create=Array.from(root.querySelectorAll('.sa-head-actions button,.sa-head-actions a')).find(function(n){return n.textContent.includes('New Adjustment');});
  if(create&&!create.classList.contains('sa-new')) {create.classList.add('sa-new');var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML='<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.6"/>';(create.querySelector('.q-btn__content')||create).prepend(svg);}
  var collapse=root.querySelector('.sa-collapse');if(collapse&&!collapse.__bound) {collapse.__bound=true;collapse.addEventListener('click',function(){var instructions=root.querySelector('#sa-instructions');instructions.hidden=!instructions.hidden;collapse.setAttribute('aria-expanded',String(!instructions.hidden));collapse.setAttribute('aria-label',instructions.hidden?'Expand instructions':'Collapse instructions');});}
  var card=root.querySelector('.sa-card'),table=card&&card.querySelector('#AdjListForm_table'),native=card&&card.querySelector('.form-list-nav-row');if(!table||!native)return;
  var range=/(\d+)\s*-\s*(\d+)\s*(?:\/|of)\s*(\d+)/i;
  var counter=Array.from(native.querySelectorAll('.q-pagination button,ul.pagination a,ul.pagination span')).find(function(n){return range.test(n.textContent.replace(/,/g,''));});
  var text=counter?counter.textContent.replace(/,/g,''):'',count=text.match(range),page=text.match(/(?:Page\s*)?(\d+)\s*(?:\/|of)\s*(\d+)/i);
  if(!count||!page) {if(native.querySelector('.q-pagination,ul.pagination'))return;var length=table.querySelectorAll('.tbody>.tr,tbody>tr:not(.form-list-nav-row)').length;count=['',length?'1':'0',String(length),String(length)];page=['','1','1'];}
  var signature=count.slice(1).join(':')+':'+page.slice(1).join(':')+':'+location.href;
  if(card.__native===native&&card.__signature===signature)return;
  card.querySelectorAll('.sa-toolbar,.sa-empty').forEach(function(n){n.remove();});
  var find=Array.from(native.querySelectorAll('button,a')).find(function(n){return /Find Options/.test(n.textContent);});
  var current=Math.max(1,+page[1]),pages=Math.max(1,+page[2]);if(+count[3]===0){count[1]='0';count[2]='0';}
  var arrows={},qp=native.querySelector('.q-pagination');
  if(qp) ['skip_previous','fast_rewind','fast_forward','skip_next'].forEach(function(name){arrows[name]=Array.from(qp.querySelectorAll('button')).find(function(b){return b.textContent.includes(name);});});
  else {var items=native.querySelectorAll('ul.pagination>li');if(items.length>=5){arrows.skip_previous=items[0].querySelector('a');arrows.fast_rewind=items[1].querySelector('a');arrows.fast_forward=items[items.length-2].querySelector('a');arrows.skip_next=items[items.length-1].querySelector('a');}}
  function pager(bottom) {
   var toolbar=node('div','sa-toolbar'+(bottom?' sa-bottom':'')),nav=node('nav','sa-pagination');nav.setAttribute('aria-label',bottom?'Bottom adjustment pages':'Adjustment pages');
   if(!bottom&&find){var f=button('Find Options','search',function(){find.click();},'sa-find');f.appendChild(node('span','','Find Options'));toolbar.appendChild(f);}
   var size=node('select','');size.setAttribute('aria-label',bottom?'Bottom rows per page':'Rows per page');
   var nativeSize=native.querySelector('.q-btn-dropdown .block,select[name="pageSize"]'),chosen=new URL(location.href).searchParams.get('pageSize')||(nativeSize&&(nativeSize.value||nativeSize.textContent.trim()))||'100';
   Array.from(new Set(['20','50','100',chosen])).forEach(function(value){var option=node('option','',value);option.value=value;option.selected=value===chosen;size.appendChild(option);});
   size.addEventListener('change',function(){var url=new URL(location.href);url.searchParams.set('pageSize',size.value);url.searchParams.set('pageIndex','0');location.assign(url.href);});nav.appendChild(size);
   function arrow(label,glyph,key,enabled) {var source=arrows[key],b=button(label,glyph,function(){source.click();});b.disabled=!enabled||!source||source.disabled||source.classList.contains('disabled')||source.parentNode.classList.contains('disabled');nav.appendChild(b);}
   arrow('First page','first_page','skip_previous',current>1);arrow('Previous page','keyboard_double_arrow_left','fast_rewind',current>1);
   var info=node('span','sa-page-info',current+' / '+pages+' ('+count[1]+'-'+count[2]+' / '+count[3]+')');info.setAttribute('aria-live','polite');nav.appendChild(info);
   arrow('Next page','keyboard_double_arrow_right','fast_forward',current<pages);arrow('Last page','last_page','skip_next',current<pages);
   toolbar.appendChild(nav);return toolbar;
  }
  if(!table.parentNode.classList.contains('sa-table-scroll')){var scroll=node('div','sa-table-scroll');scroll.setAttribute('tabindex','0');scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Stock adjustments table');table.parentNode.insertBefore(scroll,table);scroll.appendChild(table);}
  var scroll=table.parentNode;scroll.before(pager(false));scroll.after(pager(true));
  if(+count[3]===0){var empty=node('div','sa-empty','No adjustments match these filters. Use Find Options to change or clear them.');empty.setAttribute('role','status');scroll.after(empty);}
  card.classList.add('sa-enhanced');card.__native=native;card.__signature=signature;
 }
 function dialogs(scope){if(!window.jQuery)return;scope.querySelectorAll('.container-dialog').forEach(function(d){if(d.__saDialog)return;d.__saDialog=true;d.setAttribute('role','dialog');var title=d.querySelector('.modal-title');if(title){title.id=d.id+'-title';d.setAttribute('aria-labelledby',title.id);}window.jQuery(d).on('shown.bs.modal',function(){d.setAttribute('aria-hidden','false');d.setAttribute('aria-modal','true');}).on('hidden.bs.modal',function(){d.setAttribute('aria-hidden','true');d.removeAttribute('aria-modal');});});}
 function scan(){scheduled=false;var root=document.getElementById('stockAdjustments'),detail=document.getElementById('stockAdjustmentDetail');if(root||detail){dialogs(root||detail);var side=document.querySelector('#zq-sidebar .zqs-scroll,#z-sidebar .zs-scroll');if(side&&!moved.length)Array.from(side.querySelectorAll('a')).filter(function(a){return /\/zenith\/(pricing|barcode|tax)(\/|$)/i.test(new URL(a.href,location.href).pathname);}).forEach(function(link){moved.push({link:link,parent:link.parentNode,next:link.nextSibling});side.appendChild(link);});var footer=document.querySelector('#footer>div:last-child');if(footer&&footer.id==='apps-footer-content'&&!footer.parentNode.querySelector('.sa-copyright'))footer.before(node('span','sa-copyright','© 2024-2026 ZetaERP · Cloud ERP Platform')); if(footer&&!footer.querySelector('.sa-support')){var support=node('a','sa-support','Support');support.href='mailto:support@zetaclantech.com';footer.appendChild(support);}if(root)enhance(root);}else{document.querySelectorAll('.sa-support,.sa-copyright').forEach(function(n){n.remove();});moved.reverse().forEach(function(m){if(m.parent.isConnected)m.parent.insertBefore(m.link,m.next&&m.next.parentNode===m.parent?m.next:null);});moved=[];}}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(scan);}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
 new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
