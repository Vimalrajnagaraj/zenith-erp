/* Barcode Labels screen logic. Loaded as an EXTERNAL script because the /qapps SPA
   strips inline <script> bodies from screen content (external src scripts still run).
   Consolidated: label DRAWING now lives in ONE place — the barcode-module renderLabels
   transition (server, template-aware, any format + QR). This screen only collects the
   product selection + copies + template and delegates to renderLabels in an iframe. */
(function(){
    if (window.__blInit) return; window.__blInit = 1;
    var RENDER = '/apps/zenith/barcode/renderLabels';

    function picked(){ return Array.prototype.slice.call(document.querySelectorAll('.bl-pick:checked')); }
    function token(){ var e=document.getElementById('bl-token'); return e ? (e.getAttribute('data-t')||'') : ''; }
    function opts(){
        var copies=Math.max(1,Math.min(200,parseInt((document.getElementById('bl-copies')||{}).value||'1',10)||1));
        var tsel=document.getElementById('bl-template');
        if(tsel && tsel.value){ return { copies:copies, labelId:tsel.value }; }
        // "Custom size": no template -> pass explicit size + Show-price (name/sku shown, as before)
        var sz=((document.getElementById('bl-size')||{}).value||'50,25').split(',');
        return { copies:copies, w:parseFloat(sz[0])||50, h:parseFloat(sz[1])||30,
                 price:((document.getElementById('bl-showprice')||{}).checked)!==false };
    }
    function buildUrl(){
        var items=picked(); if(!items.length) return null;
        var o=opts();
        var pids=items.map(function(cb){ return encodeURIComponent(cb.value); }).join(',');
        var p='productIds='+pids+'&copies='+o.copies+'&moquiSessionToken='+encodeURIComponent(token());
        if(o.labelId){ p+='&labelId='+encodeURIComponent(o.labelId); }
        // Custom: JsBarcode already prints the code under the bars, so showSku=N avoids a duplicate line.
        else { p+='&w='+o.w+'&h='+o.h+'&showName=Y&showSku=N&showPrice='+(o.price?'Y':'N'); }
        return RENDER+'?'+p;
    }
    function frame(){ return document.getElementById('bl-frame'); }
    function show(){ var a=document.getElementById('bl-preview-area'); if(a) a.style.display='block'; }
    function doPreview(){
        var url=buildUrl(); if(!url){ alert('Tick at least one product first.'); return; }
        var f=frame(); if(!f) return;
        f.onload=null; show(); f.src=url;
        var a=document.getElementById('bl-preview-area'); if(a) a.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    function doPrint(){
        var url=buildUrl(); if(!url){ alert('Tick at least one product first.'); return; }
        var f=frame(); if(!f) return;
        show();
        // give the in-frame barcodes (JsBarcode/QR) a moment to draw, then print the iframe
        f.onload=function(){ setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} }, 500); };
        f.src=url;
    }
    // Document-level delegation: independent of when the qvt markup mounts.
    document.addEventListener('click', function(ev){
        var t = ev.target && ev.target.closest ? ev.target.closest('button') : null; if(!t) return;
        if(t.id==='bl-preview'){ doPreview(); }
        else if(t.id==='bl-print'){ doPrint(); }
        else if(t.id==='bl-all'){ document.querySelectorAll('.bl-pick').forEach(function(c){c.checked=true;}); }
        else if(t.id==='bl-none'){ document.querySelectorAll('.bl-pick').forEach(function(c){c.checked=false;}); }
    });
    // Template selected -> hide the manual size + price controls (the template drives them); Custom -> show.
    document.addEventListener('change', function(ev){
        var t=ev.target; if(!t || t.id!=='bl-template') return;
        var custom=!t.value;
        var sw=document.getElementById('bl-size-wrap'); if(sw) sw.style.display=custom?'':'none';
        var pw=document.getElementById('bl-price-wrap'); if(pw) pw.style.display=custom?'flex':'none';
    });
    window.blPreview=doPreview; window.blPrint=doPrint; window.blBuildUrl=buildUrl;
})();
