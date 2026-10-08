/* Barcode screen behaviors: scoped, idempotent, and compatible with Quasar navigation. */
(function(){'use strict';
 function init(){
 if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init,{once:true});return;}
 document.querySelectorAll('.zbc-page').forEach(function(page){if(page.dataset.barcodeBound)return;page.dataset.barcodeBound='1';
if(page.querySelector('#bm-lookup')){

        window.bmLook = function(){
            var el=document.getElementById('bm-lookup'); var v=el ? (el.value||'').trim() : '';
            var base=location.pathname.split('/zenith/')[0];
            location.href = base + '/zenith/barcode/BarcodeDashboard?barcodeValue=' + encodeURIComponent(v);
        };
        
}
if(page.querySelector('#ab-overlay')){

        (function(){
            var ov=document.getElementById('gb-overlay'); if(!ov) return;
            var pre=document.getElementById('gb-prefix'), code=document.getElementById('gb-code');
            function upd(){ var p=((pre.value||'').trim())||'ZEN'; code.textContent=p+'000001'; }
            if(pre){ pre.addEventListener('input', upd); upd(); }
            var create=document.getElementById('gb-create');
            if(create && !create.__w){ create.__w=1; create.addEventListener('click', function(){
                var prod=document.getElementById('gb-product'); var pid=prod ? prod.value : '';
                if(!pid){ alert('Select a product.'); return; }
                var tok=''; try{ tok=window.moqui.webrootVue.moquiSessionToken; }catch(e){}
                if(!tok){ var t=document.getElementById('gb-token'); tok=t?t.value:''; }
                var body=new URLSearchParams(); body.append('productId', pid); body.append('prefix', ((pre.value||'ZEN').trim())||'ZEN'); body.append('moquiSessionToken', tok);
                var base=location.pathname.split('/zenith/')[0];
                create.disabled=true; create.textContent='Generating...';
                fetch(base+'/zenith/barcode/FindBarcode/generateBarcode',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
                    .then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href = r.url || location.href; })
                    .catch(function(){ create.disabled=false; create.textContent='Generate'; alert('Generate failed — please try again.'); });
            }); }
        })();
        
}
if(page.querySelector('#ab-overlay')){

        (function(){
            var ov=document.getElementById('ab-overlay'); if(!ov) return;
            var tg=ov.querySelector('.ab-tg'); var hid=document.getElementById('ab-primary');
            function styleTG(){
                var cur=hid.value;
                Array.prototype.forEach.call(tg.querySelectorAll('.ab-pill'), function(p){
                    var v=p.getAttribute('data-v'); var ico=p.querySelector('.ab-pico'); var on=(v===cur);
                    if(on){ p.style.background='rgba(124,58,237,.1)'; p.style.borderColor='#7C3AED'; p.style.color='#7C3AED'; }
                    else { p.style.background='#fff'; p.style.borderColor='#E5E7EB'; p.style.color='#6B7280'; }
                    if(ico) ico.style.display = on ? 'inline-block' : 'none';
                });
            }
            Array.prototype.forEach.call(tg.querySelectorAll('.ab-pill'), function(p){ p.addEventListener('click', function(){ hid.value=p.getAttribute('data-v'); styleTG(); }); });
            styleTG();
            var create=document.getElementById('ab-create');
            if(create && !create.__w){ create.__w=1; create.addEventListener('click', function(){
                var pid=document.getElementById('ab-product').value; var typ=document.getElementById('ab-type').value;
                var val=(document.getElementById('ab-value').value||'').trim();
                if(!pid){ alert('Select a product.'); return; }
                if(!typ){ alert('Select a type.'); return; }
                if(!val){ alert('Barcode Value is required.'); return; }
                var tok=''; try{ tok=window.moqui.webrootVue.moquiSessionToken; }catch(e){} if(!tok){ var t=document.getElementById('ab-token'); tok=t?t.value:''; }
                var body=new URLSearchParams(); body.append('productId',pid); body.append('barcodeTypeEnumId',typ); body.append('barcodeValue',val); body.append('isPrimary',hid.value); body.append('moquiSessionToken',tok);
                var base=location.pathname.split('/zenith/')[0];
                create.disabled=true; create.textContent='Adding...';
                fetch(base+'/zenith/barcode/FindBarcode/addBarcode',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
                    .then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href = r.url || location.href; })
                    .catch(function(){ create.disabled=false; create.textContent='Add Barcode'; alert('Add failed — please try again.'); });
            }); }
        })();
        
}
if(page.querySelector('#lt-token')){

        (function(){
            function styleLT(tg){
                var cur=tg.getAttribute('data-cur');
                Array.prototype.forEach.call(tg.querySelectorAll('.lt-pill'), function(p){
                    var v=p.getAttribute('data-v'); var ico=p.querySelector('.lt-pico'); var on=(v===cur);
                    if(on && v==='Y'){ p.style.background='rgba(16,185,129,.12)'; p.style.borderColor='#10B981'; p.style.color='#0E9F6E'; }
                    else if(on){ p.style.background='rgba(220,38,38,.1)'; p.style.borderColor='#DC2626'; p.style.color='#DC2626'; }
                    else { p.style.background='#fff'; p.style.borderColor='#E5E7EB'; p.style.color='#6B7280'; }
                    if(ico) ico.style.display = on ? 'inline-block' : 'none';
                });
            }
            function tok(){ var t=''; try{ t=window.moqui.webrootVue.moquiSessionToken; }catch(e){} if(!t){ var h=document.getElementById('lt-token'); t=h?h.value:''; } return t; }
            Array.prototype.forEach.call(page.querySelectorAll('.lt-tg'), function(tg){
                styleLT(tg);
                Array.prototype.forEach.call(tg.querySelectorAll('.lt-pill'), function(p){
                    p.addEventListener('click', function(){
                        var v=p.getAttribute('data-v'), cur=tg.getAttribute('data-cur');
                        if(v===cur) return;
                        var f=tg.getAttribute('data-f'), id=tg.getAttribute('data-id'), prev=cur;
                        tg.setAttribute('data-cur', v); styleLT(tg);
                        var body=new URLSearchParams(); body.append('labelId', id); body.append(f, v); body.append('moquiSessionToken', tok());
                        var base=location.pathname.split('/zenith/')[0];
                        fetch(base+'/zenith/barcode/LabelTemplates/updateTemplate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
                            .then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href=r.url||location.href; })
                            .catch(function(){ tg.setAttribute('data-cur', prev); styleLT(tg); alert('Update failed — please try again.'); });
                    });
                });
            });
        })();
        
}
if(page.querySelector('#lt-token')){

        (function(){
            var ov=document.getElementById('nlt-overlay'); if(!ov) return;
            page.querySelectorAll('.lt-edit').forEach(function(button){button.addEventListener('click',function(){
                var d=button.dataset;ov.dataset.labelId=d.id;document.getElementById('nlt-title').textContent='Edit Label Template';document.getElementById('nlt-create').textContent='Save Template';
                ['name','width','height','format'].forEach(function(key){document.getElementById('nlt-'+key).value=d[key]});document.getElementById('nlt-cval').textContent=d.columns;
                var flags={showPrice:d.price,showProductName:d.nameFlag,showSku:d.sku,showMrp:d.mrp,default:d.default};Object.keys(flags).forEach(function(key){document.getElementById('nlt-'+key).value=flags[key]});
                ov.querySelectorAll('.nlt-tg').forEach(styleTG);upd();ov.style.display='flex';document.getElementById('nlt-name').focus();
            })});
            page.querySelectorAll('button').forEach(function(button){if(button.textContent.trim()==='addNew Template' || button.textContent.trim()==='add New Template')button.addEventListener('click',function(){delete ov.dataset.labelId;document.getElementById('nlt-title').textContent='New Label Template';document.getElementById('nlt-create').textContent='Create Template';
                var defaults={name:'',width:'50',height:'25',format:'BctCode128',showProductName:'Y',showPrice:'Y',showSku:'N',showMrp:'N',default:'N'};
                Object.keys(defaults).forEach(function(key){document.getElementById('nlt-'+key).value=defaults[key]});setCols(3);ov.querySelectorAll('.nlt-tg').forEach(styleTG);upd()})});

            function styleTG(tg){
                var k=tg.getAttribute('data-k'); var hid=document.getElementById('nlt-'+k); var val=hid?hid.value:'Y';
                Array.prototype.forEach.call(tg.querySelectorAll('.nlt-pill'), function(p){
                    var v=p.getAttribute('data-v'); var ico=p.querySelector('.nlt-pico'); var on=(v===val);
                    if(on && v==='Y'){ p.style.background='rgba(16,185,129,.12)'; p.style.borderColor='#10B981'; p.style.color='#0E9F6E'; }
                    else if(on){ p.style.background='rgba(220,38,38,.1)'; p.style.borderColor='#DC2626'; p.style.color='#DC2626'; }
                    else { p.style.background='#fff'; p.style.borderColor='#E5E7EB'; p.style.color='#6B7280'; }
                    if(ico) ico.style.display = on ? 'inline-block' : 'none';
                });
            }
            Array.prototype.forEach.call(ov.querySelectorAll('.nlt-tg'), function(tg){
                styleTG(tg);
                Array.prototype.forEach.call(tg.querySelectorAll('.nlt-pill'), function(p){
                    p.addEventListener('click', function(){ var hid=document.getElementById('nlt-'+tg.getAttribute('data-k')); if(hid) hid.value=p.getAttribute('data-v'); styleTG(tg); });
                });
            });
            var cv=document.getElementById('nlt-cval');
            function setCols(n){ n=Math.min(10, Math.max(1, n)); cv.textContent=n; var pc=document.getElementById('nlt-pv-cols'); if(pc) pc.textContent=n+' per row'; }
            document.getElementById('nlt-cdec').addEventListener('click', function(){ setCols((parseInt(cv.textContent,10)||1)-1); });
            document.getElementById('nlt-cinc').addEventListener('click', function(){ setCols((parseInt(cv.textContent,10)||1)+1); });
            function g(id){ var e=document.getElementById(id); return e?(e.value||'').trim():''; }
            var fmt=document.getElementById('nlt-format');
            function upd(){
                var pf=document.getElementById('nlt-pv-fmt'); if(pf && fmt) pf.textContent=fmt.options[fmt.selectedIndex].text;
                var w=g('nlt-width'), h=g('nlt-height'); var ps=document.getElementById('nlt-pv-size');
                if(ps) ps.textContent=(w||'—')+' x '+(h||'—')+' mm';
            }
            if(fmt) fmt.addEventListener('change', upd);
            document.getElementById('nlt-width').addEventListener('input', upd);
            document.getElementById('nlt-height').addEventListener('input', upd);
            upd();
            var create=document.getElementById('nlt-create');
            if(create && !create.__w){ create.__w=1; create.addEventListener('click', function(){
                var name=g('nlt-name'); if(!name){ alert('Template Name is required.'); return; }
                var tok=''; try{ tok=window.moqui.webrootVue.moquiSessionToken; }catch(e){}
                if(!tok){ var t=document.getElementById('nlt-token'); tok=t?t.value:''; }
                var body=new URLSearchParams();
                if(ov.dataset.labelId)body.append('labelId',ov.dataset.labelId);
                body.append('labelName', name);
                body.append('labelWidth', g('nlt-width'));
                body.append('labelHeight', g('nlt-height'));
                body.append('barcodeTypeEnumId', g('nlt-format'));
                body.append('columnsPerRow', cv.textContent);
                body.append('showProductName', g('nlt-showProductName'));
                body.append('showPrice', g('nlt-showPrice'));
                body.append('showSku', g('nlt-showSku'));
                body.append('showMrp', g('nlt-showMrp'));
                body.append('isDefault', g('nlt-default'));
                body.append('moquiSessionToken', tok);
                var base=location.pathname.split('/zenith/')[0];
                create.disabled=true; create.textContent='Creating...';
                fetch(base+'/zenith/barcode/LabelTemplates/'+(ov.dataset.labelId?'updateTemplate':'createTemplate'),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
                    .then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href = r.url || location.href; })
                    .catch(function(){ create.disabled=false; create.textContent='Create Template'; alert('Create failed — please try again.'); });
            }); }
        })();
        
}
if(page.querySelector('#npj-overlay')){
if(document.getElementById('epj-token')){

                (function(){
                    var tok=function(){ var t=''; try{ t=window.moqui.webrootVue.moquiSessionToken; }catch(e){} if(!t){ var h=document.getElementById('epj-token'); t=h?h.value:''; } return t; };
                    var base=location.pathname.split('/zenith/')[0];
                    var jobId=document.getElementById('epj-token').getAttribute('data-job');
                    function post(path, extra){
                        var body=new URLSearchParams(); body.append('printJobId', jobId); body.append('moquiSessionToken', tok());
                        for(var k in extra){ body.append(k, extra[k]); }
                        return fetch(base+'/zenith/barcode/PrintJobs/'+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'});
                    }
                    var add=document.getElementById('epj-add');
                    if(add && !add.__w){ add.__w=1; add.addEventListener('click', function(){
                        var pid=document.getElementById('epj-product').value; var qty=document.getElementById('epj-qty').value||'1';
                        if(!pid){ alert('Select a product.'); return; }
                        add.disabled=true; post('addItem',{productId:pid, quantity:qty}).then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href=r.url||location.href; }).catch(function(){ add.disabled=false; alert('Add failed — please try again.'); });
                    }); }
                    Array.prototype.forEach.call(page.querySelectorAll('.epj-rm'), function(b){
                        b.addEventListener('click', function(){ b.disabled=true; post('removeItem',{productId:b.getAttribute('data-pid')}).then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href=r.url||location.href; }).catch(function(){ b.disabled=false; alert('Remove failed.'); }); });
                    });
                    var mark=document.getElementById('epj-mark');
                    if(mark && !mark.__w){ mark.__w=1; mark.addEventListener('click', function(){
                        mark.disabled=true; post('completePrintJob',{}).then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href=r.url||location.href; }).catch(function(){ mark.disabled=false; alert('Mark failed.'); });
                    }); }
                })();
                
}
}
if(page.querySelector('#npj-overlay')){

        (function(){
            function setColor(s){ s.style.color = s.value ? '#111827' : '#9CA3AF'; }
            Array.prototype.forEach.call(page.querySelectorAll('#npj-overlay select'), function(s){ setColor(s); s.addEventListener('change', function(){ setColor(s); }); });
            var addBtn=document.getElementById('npj-add'), cont=document.getElementById('npj-pentries');
            if(addBtn && cont && !addBtn.__w){ addBtn.__w=1; addBtn.addEventListener('click', function(){
                var first=cont.querySelector('.npj-pentry'); if(!first) return;
                var clone=first.cloneNode(true); Array.prototype.forEach.call(clone.querySelectorAll('.npj-remove-row'),function(e){e.remove();});
                Array.prototype.forEach.call(clone.querySelectorAll('select,input'), function(el){
                    if(el.name==='productId'){ el.selectedIndex=0; el.removeAttribute('required'); setColor(el); el.addEventListener('change', function(){ setColor(el); }); }
                    else if(el.name==='quantity'){ el.value='1'; }
                });
                var rm=document.createElement('div'); rm.className='npj-remove-row';
                rm.style.cssText='text-align:right;margin:-8px 0 12px';
                var rl=document.createElement('button');
                rl.type='button'; rl.textContent='Remove'; rl.style.cssText='border:none;background:transparent;color:#DC2626;font-size:12.5px;font-weight:600;cursor:pointer';
                rl.addEventListener('click', function(){ clone.parentNode.removeChild(clone); });
                rm.appendChild(rl); clone.appendChild(rm);
                cont.appendChild(clone);
            }); }
            // Create: collect labelId + every product row -> fetch POST to createPrintJob, then follow the
            // transition's redirect (response URL carries ?printJobId -> lands on the builder).
            var create=document.getElementById('npj-create');
            if(create && !create.__w){ create.__w=1; create.addEventListener('click', function(){
                var lbl=document.getElementById('npj-label'); var labelId=lbl ? lbl.value : '';
                if(!labelId){ alert('Label Template is required.'); return; }
                var prods=cont.querySelectorAll('select[name="productId"]');
                var qtys=cont.querySelectorAll('input[name="quantity"]');
                var body=new URLSearchParams(); body.append('labelId', labelId); var any=false;
                Array.prototype.forEach.call(prods, function(ps, i){ if(ps.value){ any=true; body.append('productId', ps.value); var q=(qtys[i] && qtys[i].value) ? qtys[i].value : '1'; body.append('quantity', q); } });
                if(!any){ alert('Select at least one product.'); return; }
                var tok=''; try{ tok=window.moqui.webrootVue.moquiSessionToken; }catch(e){}
                if(!tok){ var h=document.getElementById('npj-token'); tok=h ? h.value : ''; }
                body.append('moquiSessionToken', tok);
                var base=location.pathname.split('/zenith/')[0];
                create.disabled=true; create.textContent='Creating...';
                fetch(base+'/zenith/barcode/PrintJobs/createPrintJob',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
                    .then(function(r){ if(!r.ok) throw new Error('Request failed'); location.href = r.url || location.href; })
                    .catch(function(){ create.disabled=false; create.textContent='Create & Add Products'; alert('Create failed — please try again.'); });
            }); }
        })();
        
}
// Inline open/close handlers work on both shells; keep keyboard focus inside the active dialog.
page.addEventListener('click',function(event){
 var trigger=event.target.closest('button');if(!trigger)return;
 page.querySelectorAll('[id$="-overlay"]').forEach(function(overlay){
  if(overlay.style.display==='flex' && !overlay.contains(trigger)){overlay.__opener=trigger;var control=overlay.querySelector('input:not([type="hidden"]),select,button');if(control)control.focus();}
  else if(overlay.style.display==='none' && overlay.contains(trigger) && overlay.__opener)overlay.__opener.focus();
 });
});
var iconLabels={'nlt-cdec':'Decrease columns','nlt-cinc':'Increase columns'};
Object.keys(iconLabels).forEach(function(id){var button=page.querySelector('#'+id);if(button)button.setAttribute('aria-label',iconLabels[id])});
page.querySelectorAll('[id$="-overlay"]').forEach(function(overlay){
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',overlay.id==='nlt-overlay'?'Label template':overlay.id==='ab-overlay'?'Add barcode':overlay.id==='gb-overlay'?'Generate internal barcode':'New print job');
 overlay.addEventListener('keydown',function(event){if(event.key==='Escape'){overlay.style.display='none';if(overlay.__opener)overlay.__opener.focus();return}
 if(event.key!=='Tab')return;var controls=Array.from(overlay.querySelectorAll('button,input,select')).filter(function(e){return !e.disabled && e.type!=='hidden' && e.getClientRects().length});
 if(!controls.length)return;var first=controls[0],last=controls[controls.length-1];if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
 });
});
page.querySelectorAll('input[id],select[id]').forEach(function(input){if(!input.getAttribute('aria-label')){var row=input.closest('div');var label=row && row.querySelector('label');if(label)input.setAttribute('aria-label',label.textContent.trim());}});
});}
 window.ZenithBarcode={init:init};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
