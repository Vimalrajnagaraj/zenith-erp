/* Barcodes bulk-manage grid logic. Loaded as an EXTERNAL script because the /qapps SPA
   strips inline <script> bodies from screen content (external scripts injected via appendChild
   still run). Saves or REMOVES one product's Item Code / Barcode via the saveBarcode transition
   (an empty code removes it). */
(function(){
    if (window.__bcInit) return; window.__bcInit = 1;

    function tok(){ try{ if(window.moqui&&window.moqui.webrootVue&&window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; }catch(e){} var field=document.getElementById('bc-token');return field?field.value:''; }
    function note(btn,msg,ok){ var o=btn.textContent,c=btn.style.background; btn.textContent=msg; btn.style.background=ok?'#1b5e20':'#c62828'; setTimeout(function(){ btn.textContent=o; btn.style.background=c; },2000); }
    function setStatus(td,code){ if(!td) return; if(!code){ td.innerHTML='<span style="color:#b71c1c">⚠ No code</span>'; } else { td.innerHTML='<span style="color:#2e7d32">✔ OK</span>'; } }

    // Save (code) or remove (code='') one row's Item Code / Barcode.
    function submit(tr, btn, code, okMsg){
        btn.disabled=true; var orig=btn.textContent; btn.textContent='...';
        var body=new URLSearchParams({ productId:tr.getAttribute('data-pid'), code:code, moquiSessionToken:tok() });
        fetch('Barcodes/saveBarcode',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
            .then(function(r){if(!r.ok)throw Error('Could not save the code. Refresh and try again.');return r.json();})
            .then(function(d){
                btn.disabled=false; btn.textContent=orig;
                if(d&&d.success){
                    note(btn,okMsg,true);
                    var inp=tr.querySelector('.bc-code'); if(inp) inp.value=d.code||'';
                    setStatus(tr.querySelector('.bc-status'), d.code);
                    var rm=tr.querySelector('.bc-remove');
                    if(!rm && d.code){rm=document.createElement('button');rm.type='button';rm.className='bc-remove';rm.textContent='Remove';rm.title='Remove primary code; preserve secondary barcodes';rm.style.cssText='padding:7px 12px;background:#fff;color:#c62828;border:1px solid #e0a3a3;border-radius:6px;cursor:pointer';btn.parentNode.appendChild(rm);}
                    if(rm) rm.style.display=(d.code?'':'none'); // nothing left to remove
                } else { note(btn,'✗ '+((d&&d.error)||'Error'),false); }
            })
            .catch(function(e){ btn.disabled=false; btn.textContent=orig; note(btn,'✗ '+e.message,false); });
    }

    document.addEventListener('input',function(ev){if(ev.target.matches('.bc-code')){var td=ev.target.closest('tr').querySelector('.bc-status');td.textContent='Unsaved';}});
    document.addEventListener('click',function(ev){
        var t=ev.target;
        var saveBtn = t.closest && t.closest('.bc-save');
        if(saveBtn){ var tr=saveBtn.closest('tr'); if(!tr) return; var inp=tr.querySelector('.bc-code'); submit(tr,saveBtn,(inp&&inp.value||'').trim(),'✓ Saved'); return; }
        var rmBtn = t.closest && t.closest('.bc-remove');
        if(rmBtn){ var tr2=rmBtn.closest('tr'); if(!tr2) return;
            if(!window.confirm("Remove this product's primary code? Secondary barcodes remain, and an active alternate becomes primary.")) return;
            submit(tr2,rmBtn,'','✓ Removed'); return; }
    });
    // pressing Enter in a code box (e.g. after a scanner gun types the code) saves that row
    document.addEventListener('keydown',function(ev){ if(ev.key!=='Enter') return; var inp=ev.target; if(!inp.classList||!inp.classList.contains('bc-code')) return; ev.preventDefault(); var tr=inp.closest('tr'); var b=tr&&tr.querySelector('.bc-save'); if(b) b.click(); });
})();
