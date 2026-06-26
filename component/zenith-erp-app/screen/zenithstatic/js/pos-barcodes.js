/* Barcodes bulk-manage grid logic. Loaded as an EXTERNAL script because the /qapps SPA
   strips inline <script> bodies from screen content (external scripts injected via appendChild
   still run). Saves one product's Item Code / Barcode via the saveBarcode transition. */
(function(){
    if (window.__bcInit) return; window.__bcInit = 1;

    function tok(){ try{ if(window.moqui&&window.moqui.webrootVue&&window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; }catch(e){} return ''; }
    function note(btn,msg,ok){ var o=btn.textContent,c=btn.style.background; btn.textContent=msg; btn.style.background=ok?'#1b5e20':'#c62828'; setTimeout(function(){ btn.textContent=o; btn.style.background=c; },2000); }
    function setStatus(td,code){ if(!td) return; if(!code){ td.innerHTML='<span style="color:#b71c1c">⚠ No code</span>'; } else { td.innerHTML='<span style="color:#2e7d32">✔ OK</span>'; } }

    document.addEventListener('click',function(ev){
        var btn=ev.target.closest&&ev.target.closest('.bc-save'); if(!btn) return;
        var tr=btn.closest('tr'); if(!tr) return;
        var inp=tr.querySelector('.bc-code'); var code=(inp&&inp.value||'').trim();
        btn.disabled=true; btn.textContent='...';
        var body=new URLSearchParams({ productId:tr.getAttribute('data-pid'), code:code, moquiSessionToken:tok() });
        fetch('Barcodes/saveBarcode',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,credentials:'same-origin'})
            .then(function(r){return r.json();})
            .then(function(d){ btn.disabled=false; if(d&&d.success){ note(btn,'✓ Saved',true); setStatus(tr.querySelector('.bc-status'), d.code); } else { note(btn,'✗ '+((d&&d.error)||'Error'),false); } })
            .catch(function(e){ btn.disabled=false; note(btn,'✗ '+e.message,false); });
    });
    // pressing Enter in a code box (e.g. after a scanner gun types the code) saves that row
    document.addEventListener('keydown',function(ev){ if(ev.key!=='Enter') return; var inp=ev.target; if(!inp.classList||!inp.classList.contains('bc-code')) return; ev.preventDefault(); var tr=inp.closest('tr'); var b=tr&&tr.querySelector('.bc-save'); if(b) b.click(); });
})();
