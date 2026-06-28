// Signals to Terminal.xml's legacy inline cart engine (the 7171 IIFE) that the
// optimistic engine in THIS file is present, so it stands down — otherwise on /apps
// both bind a grid-submit handler and every product tap fires TWO addItem POSTs,
// making the cart flicker through optimistic + two server settles ("three states").
window.__posTermJsActive = true;
console.log('[posterm] script loaded v116 — posOpenHistory defined:', (typeof window.posOpenHistory));
/* POS Terminal - external JS for SPA (qapps) - Full AJAX */

/* === Close the SPA left nav drawer when on the POS terminal ===
   On narrow/tablet screens the Quasar nav drawer opens as an overlay and
   covers the POS header (HISTORY, fullscreen, CLOSE), making those buttons
   un-clickable. Collapse it whenever the terminal is present. */
(function closeNavDrawer() {
    // NOTE: offsetParent is always null for position:fixed elements, so it can't
    // be used to test visibility here. Use computed display/visibility/opacity.
    function isShown(el) {
        if (!el) return false;
        var cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
    }
    function tryClose() {
        if (!document.getElementById('pos-history-btn') && !document.getElementById('pos-history-btn-ns')) return;
        // Quasar overlay/mobile drawer puts a backdrop over the page; clicking it closes the drawer
        var bd = document.querySelector('.q-drawer__backdrop');
        if (bd && isShown(bd)) bd.click();
    }
    // Run a few times while the SPA finishes its initial render/animation
    var n = 0;
    var iv = setInterval(function() { tryClose(); if (++n >= 15) clearInterval(iv); }, 400);
})();

/* === Cross-browser POS optimizations (Safari + Chrome) ===
   - touch-action:manipulation kills the iOS 300ms tap delay + double-tap zoom (snappy billing)
   - -webkit-overflow-scrolling adds momentum scroll on the grid/cart
   - iOS-only (@supports -webkit-touch-callout) bumps inputs to 16px so focusing them
     doesn't auto-zoom the page; desktop Chrome/Safari are unaffected. === */
(function posXBrowser() {
    if (document.getElementById('pos-xbrowser-css')) return;
    var css = ''
        + '.pos-product-grid button,.pos-cat-strip a,.pos-summary button,.pos-summary a,.pos-header button,'
        + '.pos-header a,.pos-cart button,.pos-cart select,.pos-pay-form button,button.aj-q,.aj-pb,.aj-rm,'
        + '.credit-settle-btn,.pos-cash-confirm,.pos-cash-btn,.pos-split-btn,.sm-opt{touch-action:manipulation;}'
        + 'button,a,select,input{-webkit-tap-highlight-color:rgba(0,0,0,0.12);}'
        + '.pos-product-grid,.pos-cart,.pos-cart tbody,.pos-cat-strip,.pos-summary{-webkit-overflow-scrolling:touch;}'
        + 'select.aj-mode{-webkit-appearance:menulist;-moz-appearance:menulist;appearance:menulist;}'
        + '@supports (-webkit-touch-callout:none){'
        +   '.pos-cart input,.pos-cart select,.pos-search-bar input,.pos-cash-input,#cartInlineSearch,'
        +   '.aj-p,.aj-qi,.aj-mode,#credit-name,#credit-phone,#settle-amt,#close-cash-input{font-size:16px !important;}'
        + '}';
    var st = document.createElement('style');
    st.id = 'pos-xbrowser-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
})();

/* === Offline Mode: IndexedDB catalog cache + offline cart + sale capture + sync ===
   Self-contained: takes over the cart UI only while navigator is offline; the online
   flow is untouched. _posAjax/_posScan delegate here when offline. === */
window._posOffline = (function() {
    var DBN = 'ZenithPosOffline', DBV = 1, db = null;
    var catalog = {};   // productId -> {productId,name,price,uom,taxCode,barcode}
    var cart = [];
    var booted = false;
    var syncing = false;
    function active(){ return !navigator.onLine; }
    function f2(x){ return Number(x||0).toFixed(2); }
    function tCtx(){ var af=document.getElementById('cartInlineAddForm'); function v(n){ var el=af&&af.querySelector?af.querySelector('[name='+n+']'):null; return el?el.value:''; } var tEl=document.querySelector('input[name=posTerminalId]'); return { sessionId:v('sessionId'), terminalId: tEl?tEl.value:'' }; }
    function openDB(){ return new Promise(function(res,rej){ var rq=indexedDB.open(DBN,DBV); rq.onupgradeneeded=function(e){ var d=e.target.result; if(!d.objectStoreNames.contains('catalog'))d.createObjectStore('catalog',{keyPath:'productId'}); if(!d.objectStoreNames.contains('queue'))d.createObjectStore('queue',{keyPath:'offlineId'}); }; rq.onsuccess=function(e){db=e.target.result;res(db);}; rq.onerror=function(e){rej(e);}; }); }
    function putCatalog(items){ return new Promise(function(res){ if(!db){res(0);return;} var tx=db.transaction(['catalog'],'readwrite'); var s=tx.objectStore('catalog'); s.clear(); catalog={}; items.forEach(function(p){ s.put(p); catalog[p.productId]=p; }); tx.oncomplete=function(){res(items.length);}; tx.onerror=function(){res(0);}; }); }
    function loadCatalog(){ return new Promise(function(res){ if(!db){res();return;} var tx=db.transaction(['catalog'],'readonly'); var rq=tx.objectStore('catalog').getAll(); rq.onsuccess=function(){ catalog={}; (rq.result||[]).forEach(function(p){catalog[p.productId]=p;}); res(); }; rq.onerror=function(){res();}; }); }
    function cacheCatalog(){ return fetch('Terminal/exportPosCatalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){ var prods=(d.products||[]).map(function(p){ return {productId:p.productId, name:p.productName||p.productId, price:Number(p.listPrice||0), uom:p.uom||'', taxCode:p.taxCode||'', barcode:p.barcode||''}; }); return putCatalog(prods); }).catch(function(){ return 0; }); }
    function enqueue(sale){ return new Promise(function(res){ var tx=db.transaction(['queue'],'readwrite'); tx.objectStore('queue').put(sale); tx.oncomplete=function(){res();}; tx.onerror=function(){res();}; }); }
    function getQueue(){ return new Promise(function(res){ if(!db){res([]);return;} var tx=db.transaction(['queue'],'readonly'); var rq=tx.objectStore('queue').getAll(); rq.onsuccess=function(){res(rq.result||[]);}; rq.onerror=function(){res([]);}; }); }
    function clearQueue(){ return new Promise(function(res){ var tx=db.transaction(['queue'],'readwrite'); tx.objectStore('queue').clear(); tx.oncomplete=function(){res();}; tx.onerror=function(){res();}; }); }
    function toast(msg,bg){ var t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:9999999;background:'+(bg||'#2e7d32')+';color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,0.3);max-width:90vw;text-align:center'; document.body.appendChild(t); setTimeout(function(){t.remove();},3000); }
    function banner(show){ var b=document.getElementById('pos-offline-banner'); if(!b){ b=document.createElement('div'); b.id='pos-offline-banner'; b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999991;background:#c62828;color:#fff;text-align:center;padding:7px 12px;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3)'; document.body.appendChild(b); } b.style.display=show?'block':'none'; if(show){ getQueue().then(function(q){ b.innerHTML='&#9888; OFFLINE — sales saved on this device, will sync when online'+(q.length?(' &middot; '+q.length+' queued'):''); }); } }
    function render(){
        var tb=document.querySelector('.pos-cart tbody');
        if(tb){ var h=''; if(!cart.length) h='<tr><td colspan="7" style="text-align:center;padding:40px;color:#aaa;font-size:16px">Offline &mdash; tap products to add items</td></tr>';
            cart.forEach(function(it,i){ h+='<tr style="border-bottom:1px solid #e0e0e0">'
                +'<td style="padding:8px 10px;text-align:center;font-weight:700;color:#777;width:30px">'+(i+1)+'</td>'
                +'<td style="padding:8px 10px"><div style="font-size:14px;font-weight:600;color:#000">'+it.name+'</div><div style="font-size:11px;color:#555">'+it.productId+'</div></td>'
                +'<td style="padding:8px 10px;text-align:right;color:#000">'+f2(it.price)+'</td>'
                +'<td style="padding:4px;text-align:center"><div style="display:flex;align-items:center;justify-content:center">'
                +'<button data-i="'+i+'" class="ofl-minus" style="width:32px;height:38px;border:2px solid #e53935;background:#fff;font-size:20px;font-weight:bold;cursor:pointer;border-radius:8px 0 0 8px;color:#e53935">-</button>'
                +'<input data-i="'+i+'" class="ofl-qi" type="number" step="any" value="'+Number(it.qty)+'" style="width:52px;height:38px;text-align:center;font-weight:bold;font-size:15px;border-top:2px solid #ccc;border-bottom:2px solid #ccc;border-left:none;border-right:none;box-sizing:border-box;outline:none"/>'
                +'<button data-i="'+i+'" class="ofl-plus" style="width:32px;height:38px;border:2px solid #2e7d32;background:#fff;font-size:20px;font-weight:bold;cursor:pointer;border-radius:0 8px 8px 0;color:#2e7d32">+</button>'
                +'</div>'+(it.uom?'<div style="font-size:11px;color:#e65100;font-weight:700;text-align:center;margin-top:2px">'+it.uom+'</div>':'')+'</td>'
                +'<td style="padding:8px 10px;text-align:right;font-weight:700;color:#000">'+f2(it.qty*it.price)+'</td>'
                +'<td style="padding:4px;text-align:center"><button data-i="'+i+'" class="ofl-rm" style="width:30px;height:30px;border:none;background:#e53935;color:#fff;border-radius:6px;cursor:pointer">&#10005;</button></td></tr>'; });
            tb.innerHTML=h; }
        var sm=document.querySelector('.pos-summary');
        if(sm){ var total=cart.reduce(function(a,it){return a+it.qty*it.price;},0); var qty=cart.reduce(function(a,it){return a+Number(it.qty);},0);
            var s='<div style="display:flex;justify-content:space-between;font-size:13px;color:#777;margin-bottom:6px"><span style="color:#c62828;font-weight:700">OFFLINE</span><span>Qty: <b>'+qty+'</b></span></div>'
                +'<div style="background:#c62828;color:#fff;padding:14px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:16px;font-weight:600">OFFLINE TOTAL</span><span style="font-size:28px;font-weight:800">&#8377;'+f2(total)+'</span></div>';
            if(cart.length){ s+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
                +'<button type="button" class="ofl-pay" data-m="Cash" style="padding:16px 8px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#4caf50;color:#fff">&#128176; CASH</button>'
                +'<button type="button" class="ofl-pay" data-m="Card" style="padding:16px 8px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#2196f3;color:#fff">&#128179; CARD</button>'
                +'<button type="button" class="ofl-pay" data-m="UPI" style="padding:16px 8px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#9c27b0;color:#fff">&#128241; UPI</button></div>';
            } else { s+='<div style="text-align:center;padding:16px;color:#aaa">Offline &mdash; tap products to add items</div>'; }
            sm.innerHTML=s; }
    }
    function add(pid, price){ var p=catalog[pid]||{}; var pr=Number(price||p.price||0); var ex=cart.find(function(it){return it.productId===pid && Number(it.price)===pr;}); if(ex) ex.qty=Number(ex.qty)+1; else cart.push({productId:pid,name:p.name||pid,price:pr,qty:1,uom:p.uom||''}); render(); }
    function scan(code){ var lc=(code||'').toLowerCase(); var found=null; for(var k in catalog){ var p=catalog[k]; if(p.barcode===code||p.productId===code||(p.name||'').toLowerCase().indexOf(lc)!==-1){found=p;break;} } if(found) add(found.productId,found.price); else toast('Item not in offline catalog','#e53935'); }
    function printReceipt(sale){ var h='<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}body{margin:0;padding:0;font-family:Arial;font-size:12px}.rcpt{width:72mm;margin:0 auto;padding:2mm 3mm;box-sizing:border-box}.c{text-align:center}.r{text-align:right}.b{font-weight:bold}table{width:100%;border-collapse:collapse}td,th{font-size:11px;padding:2px 1px}.sep{border-bottom:1px dashed #000;margin:4px 0}</style></head><body><div class="rcpt">';
        h+='<div class="c b" style="font-size:15px">Offline Receipt</div><div class="c" style="font-size:9px;color:#444">** SAVED OFFLINE &mdash; will sync **</div><div class="sep"></div>';
        h+='<div style="font-size:10px">'+new Date().toLocaleString()+'</div><div class="sep"></div>';
        h+='<table><thead><tr><th style="text-align:left">Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Total</th></tr></thead><tbody>';
        sale.items.forEach(function(it){ h+='<tr><td>'+it.name+'</td><td class="c">'+it.qty+(it.uom?' '+it.uom:'')+'</td><td class="r">'+f2(it.price)+'</td><td class="r">'+f2(it.qty*it.price)+'</td></tr>'; });
        h+='</tbody></table><div class="sep"></div>';
        h+='<table><tr><td class="b" style="font-size:14px">TOTAL</td><td class="r b" style="font-size:14px">&#8377;'+f2(sale.total)+'</td></tr><tr><td>Paid</td><td class="r">'+sale.paymentMethod+'</td></tr></table>';
        h+='<div class="c b" style="margin-top:6px">Thank You !!</div><div class="c" style="font-size:7px;color:#666;margin-top:4px">Powered by ZetaERP &middot; www.zetaclantech.com</div></div>';
        h+='<script>window.onload=function(){window.print();}<\/script></body></html>';
        var f=document.getElementById('pos-offline-frame'); if(!f){ f=document.createElement('iframe'); f.id='pos-offline-frame'; f.style.cssText='position:fixed;left:-9999px;top:-9999px;width:80mm;height:0;border:none'; document.body.appendChild(f); } var d=f.contentDocument||f.contentWindow.document; d.open(); d.write(h); d.close(); }
    function pay(method){ if(!cart.length) return; var c=tCtx(); var total=cart.reduce(function(a,it){return a+it.qty*it.price;},0);
        var sale={ offlineId:'OFL-'+Date.now()+'-'+Math.floor(Math.random()*100000), terminalId:c.terminalId, sessionId:c.sessionId, items:cart.map(function(it){return {productId:it.productId,name:it.name,qty:it.qty,price:it.price,uom:it.uom};}), total:total, paymentMethod:method, ts:new Date().toISOString() };
        enqueue(sale).then(function(){ printReceipt(sale); cart=[]; render(); banner(true); toast('✔ Sale saved offline ('+method+') — will sync when online','#2e7d32'); }); }
    function sync(){ if(syncing) return Promise.resolve(0); syncing=true; return getQueue().then(function(q){ if(!q.length){ syncing=false; return 0; } var c=tCtx(); var body=JSON.stringify({terminalId:c.terminalId, transactions:q.map(function(s){return JSON.stringify(s);})}); return fetch('Terminal/syncOfflineTransactions',{method:'POST',headers:{'Content-Type':'application/json'},body:body,credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){ if(d && (d.syncedCount!=null)){ return clearQueue().then(function(){ syncing=false; return d.syncedCount; }); } syncing=false; return 0; }).catch(function(){ syncing=false; return 0; }); }).catch(function(){ syncing=false; return 0; }); }
    // Instant local-first reads against the cached master data (no server round-trip)
    function search(term){ var lc=(term||'').toLowerCase().trim(); if(!lc) return []; var out=[]; for(var k in catalog){ var p=catalog[k]; if((p.name||'').toLowerCase().indexOf(lc)!==-1 || (p.barcode||'').toLowerCase().indexOf(lc)===0 || (p.productId||'').toLowerCase()===lc){ out.push(p); if(out.length>=30) break; } } return out; }
    function lookup(pid){ return catalog[pid] || null; }
    function catalogSize(){ var n=0; for(var k in catalog) n++; return n; }
    function boot(){ if(booted) return; booted=true;
        openDB().then(function(){ return loadCatalog(); }).then(function(){ if(navigator.onLine) cacheCatalog(); banner(!navigator.onLine); if(!navigator.onLine) render(); });
        window.addEventListener('offline', function(){ banner(true); render(); });
        window.addEventListener('online', function(){ banner(false); sync().then(function(nn){ if(nn>0) toast('✔ '+nn+' offline sale(s) synced','#2e7d32'); setTimeout(function(){ try{location.reload();}catch(e){} }, nn>0?1600:300); }); });
        // Stale-while-revalidate: refresh the local master-data cache in the background so local reads stay current
        setInterval(function(){ if(navigator.onLine) cacheCatalog(); }, 180000);
        document.addEventListener('click', function(e){ var t=e.target; if(!t.classList) return;
            if(t.classList.contains('ofl-minus')){ var i=+t.dataset.i; cart[i].qty=Number(cart[i].qty)-1; if(cart[i].qty<=0)cart.splice(i,1); render(); }
            else if(t.classList.contains('ofl-plus')){ var i2=+t.dataset.i; cart[i2].qty=Number(cart[i2].qty)+1; render(); }
            else if(t.classList.contains('ofl-rm')){ cart.splice(+t.dataset.i,1); render(); }
            else if(t.classList.contains('ofl-pay')){ pay(t.dataset.m); } });
        document.addEventListener('change', function(e){ if(e.target.classList&&e.target.classList.contains('ofl-qi')){ var i=+e.target.dataset.i; var nq=Number(e.target.value); if(isNaN(nq)||nq<=0)cart.splice(i,1); else cart[i].qty=nq; render(); } });
    }
    setTimeout(boot, 1500);
    return { boot:boot, active:active, add:add, scan:scan, sync:sync, render:render, cacheCatalog:cacheCatalog, search:search, lookup:lookup, catalogSize:catalogSize };
})();

/* === Product Import screen: manual add + search auto-fill + CSV (external JS, so the
   qvt template compiler never parses HTML-in-script). Auto-wires when #pi-form is present. === */
(function() {
    function piTok(){ try{ if(window.moqui&&window.moqui.webrootVue&&window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; }catch(e){} return ''; }
    function piPost(url, params){ var p=new URLSearchParams(); for(var k in params){ p.append(k, params[k]==null?'':params[k]); } p.append('moquiSessionToken', piTok()); return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p,credentials:'same-origin'}).then(function(r){return r.json();}); }
    function g(id){ return document.getElementById(id); }
    var FIELDS = ['pi-sku','pi-name','pi-description','pi-listPrice','pi-mrp','pi-productTaxCode','pi-reorderPoint','pi-reorderQuantity','pi-expiryDate','pi-unit'];
    function wire(){
        var form = g('pi-form');
        if(!form || form.dataset.piBound) return;
        form.dataset.piBound='1';
        var s=g('pi-search'), results=g('pi-results'), modeEl=g('pi-mode'), resEl=g('pi-result'), sv=g('pi-save');
        var lastProducts=[]; var tmr=null;
        function setMode(sku){ if(!modeEl) return; modeEl.innerHTML = sku ? '<span style="color:#e65100;font-weight:600">✎ Updating existing product (SKU: '+sku+')</span>' : 'Adding a new product'; }
        function fillFrom(pr){ if(!pr) return; g('pi-sku').value=pr.sku; g('pi-name').value=pr.name; g('pi-description').value=pr.description; g('pi-listPrice').value=pr.price; g('pi-mrp').value=pr.price; g('pi-productTaxCode').value=pr.taxCode; g('pi-reorderPoint').value=pr.reorderPoint; g('pi-reorderQuantity').value=pr.reorderQuantity; if(g('pi-expiryDate')) g('pi-expiryDate').value=pr.expiryDate||''; if(g('pi-unit')) g('pi-unit').value=pr.unit||''; setMode(pr.sku); if(results){results.style.display='none';} if(s){s.value='';} if(resEl){resEl.innerHTML='';} }
        if(s){
            s.addEventListener('input', function(){
                clearTimeout(tmr); var q=s.value.trim();
                if(q.length<1){ results.style.display='none'; return; }
                tmr=setTimeout(function(){
                    piPost('ProductImport/searchProductsForImport',{term:q}).then(function(d){
                        lastProducts=(d&&d.products)?d.products:[];
                        if(!lastProducts.length){ results.innerHTML='<div style="padding:10px;color:#999;font-size:13px">No match — fill the fields to add it as new</div>'; results.style.display='block'; return; }
                        var h=''; lastProducts.forEach(function(pr,i){ h+='<div class="pi-opt" data-i="'+i+'" style="padding:9px 11px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;justify-content:space-between;gap:8px"><span><b>'+pr.name+'</b> <span style="color:#999;font-size:12px">'+pr.sku+'</span></span><span style="color:#2e7d32;font-weight:700;white-space:nowrap">'+(pr.price!==''?('₹'+pr.price):'')+'</span></div>'; });
                        results.innerHTML=h; results.style.display='block';
                        results.querySelectorAll('.pi-opt').forEach(function(o){
                            o.addEventListener('mouseover', function(){ o.style.background='#e3f2fd'; });
                            o.addEventListener('mouseout', function(){ o.style.background='#fff'; });
                            o.addEventListener('click', function(){ fillFrom(lastProducts[parseInt(o.dataset.i)]); });
                        });
                    });
                }, 300);
            });
            document.addEventListener('click', function(e){ if(results && e.target!==s && !results.contains(e.target)){ results.style.display='none'; } });
        }
        if(g('pi-sku')){ g('pi-sku').addEventListener('input', function(){ setMode(g('pi-sku').value.trim()); }); }
        if(g('pi-clear')){ g('pi-clear').addEventListener('click', function(){ FIELDS.forEach(function(id){ g(id).value=''; }); setMode(''); if(resEl){resEl.innerHTML='';} if(s){s.value='';} }); }
        if(sv){
            sv.addEventListener('click', function(){
                var name=g('pi-name').value.trim();
                if(!name){ resEl.innerHTML='<span style="color:#e53935">Product Name is required</span>'; g('pi-name').focus(); return; }
                sv.disabled=true; var ot=sv.innerHTML; sv.textContent='Saving...';
                piPost('ProductImport/addSingleProduct',{sku:g('pi-sku').value.trim(), productName:name, description:g('pi-description').value.trim(), listPrice:g('pi-listPrice').value.trim(), mrp:g('pi-mrp').value.trim(), productTaxCode:g('pi-productTaxCode').value.trim(), reorderPoint:g('pi-reorderPoint').value.trim(), reorderQuantity:g('pi-reorderQuantity').value.trim(), expiryDate:(g('pi-expiryDate')?g('pi-expiryDate').value.trim():''), unit:(g('pi-unit')?g('pi-unit').value:'')}).then(function(d){
                    sv.disabled=false; sv.innerHTML=ot;
                    if(d&&d.success){ resEl.innerHTML='<span style="color:#2e7d32;font-weight:700">✔ Product '+(d.created?'added':'updated')+': '+d.name+'</span>'; FIELDS.forEach(function(id){ g(id).value=''; }); setMode(''); }
                    else { resEl.innerHTML='<span style="color:#e53935">'+((d&&d.error)||'Error')+'</span>'; }
                }).catch(function(e){ sv.disabled=false; sv.innerHTML=ot; resEl.innerHTML='<span style="color:#e53935">'+e.message+'</span>'; });
            });
        }
        // CSV bulk import (file read client-side or paste)
        var cf=g('pos-csv-file'), cta=g('pos-csv-text'), cbtn=g('pos-csv-import'), cres=g('pos-csv-result');
        if(cf){ cf.addEventListener('change', function(){ var file=cf.files&&cf.files[0]; if(!file)return; var rd=new FileReader(); rd.onload=function(){ cta.value=rd.result; }; rd.readAsText(file); }); }
        if(cbtn){
            cbtn.addEventListener('click', function(){
                var txt=(cta.value||'').trim(); if(!txt){ cres.innerHTML='<span style="color:#e53935">Choose a CSV file or paste rows first</span>'; return; }
                cbtn.disabled=true; var ot=cbtn.innerHTML; cbtn.textContent='Importing...';
                piPost('ProductImport/importProducts',{csvText:txt}).then(function(d){
                    cbtn.disabled=false; cbtn.innerHTML=ot;
                    if(d&&d.success){ var h='<span style="color:#2e7d32;font-weight:700">✔ Imported/updated '+d.imported+', skipped '+d.skipped+'</span>'; if(d.errors&&d.errors.length){ h+='<div style="color:#e65100;font-size:12px;margin-top:6px">'+d.errors.join('<br>')+'</div>'; } cres.innerHTML=h; }
                    else { cres.innerHTML='<span style="color:#e53935">'+((d&&d.error)||'Import failed')+'</span>'; }
                }).catch(function(e){ cbtn.disabled=false; cbtn.innerHTML=ot; cres.innerHTML='<span style="color:#e53935">'+e.message+'</span>'; });
            });
        }
    }
    setInterval(wire, 600);
})();

/* === Wastage screen: expiring/expired perishables panel + one-click write-off === */
(function() {
    function wtok(){ try{ if(window.moqui&&window.moqui.webrootVue&&window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; }catch(e){} return ''; }
    // Build an absolute URL to a Wastage transition (works whether the page URL is
    // /pos/Wastage or /pos/Wastage/WastageEntry — a relative path would resolve wrong).
    function wurl(rel){ var p=window.location.pathname; var i=p.indexOf('/pos/'); var base=i>=0?p.substring(0,i+5):'/qapps/zenith/pos/'; return base+rel; }
    function wpost(rel,params){ var p=new URLSearchParams(); for(var k in params){ p.append(k, params[k]==null?'':params[k]); } p.append('moquiSessionToken', wtok()); return fetch(wurl(rel),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p,credentials:'same-origin'}).then(function(r){return r.json();}); }
    function wfmt(n){ return Number(n||0).toFixed(2); }
    function renderExpiring(){
        var root=document.getElementById('wastage-expiring-root'); if(!root) return;
        wpost('Wastage/WastageEntry/expiringProductsJson',{}).then(function(d){
            if(!d||!d.success||!d.rows||!d.rows.length){ root.innerHTML='<div style="padding:14px;color:#999">No perishable products with expiry dates.</div>'; return; }
            var exp=d.rows.filter(function(r){return r.status==='EXPIRED';}).length, soon=d.rows.filter(function(r){return r.status==='SOON';}).length;
            var h='<div style="margin-bottom:8px;font-size:13px">'+(exp?'<span style="color:#c62828;font-weight:700">'+exp+' expired</span>&nbsp;&nbsp;':'')+(soon?'<span style="color:#e65100;font-weight:700">'+soon+' expiring soon</span>':'')+'</div>';
            h+='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:2px solid #eee;text-align:left"><th style="padding:6px">Status</th><th style="padding:6px">SKU</th><th style="padding:6px">Product</th><th style="padding:6px">Expiry</th><th style="padding:6px;text-align:right">Cost</th><th></th></tr></thead><tbody>';
            d.rows.forEach(function(r,i){
                var c=r.status==='EXPIRED'?'#c62828':(r.status==='SOON'?'#e65100':'#2e7d32');
                var lbl=r.status==='EXPIRED'?'EXPIRED':(r.status==='SOON'?'EXPIRING SOON':'OK');
                h+='<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:6px"><span style="color:'+c+';font-weight:700">'+lbl+'</span></td><td style="padding:6px">'+r.sku+'</td><td style="padding:6px">'+r.productName+'</td><td style="padding:6px">'+r.expiry+'</td><td style="padding:6px;text-align:right">'+wfmt(r.cost)+'</td><td style="padding:6px;text-align:right"><button class="wexp-btn" data-i="'+i+'" style="padding:6px 10px;background:#c62828;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700">Record Wastage</button></td></tr>';
            });
            h+='</tbody></table>';
            root.innerHTML=h;
            root.querySelectorAll('.wexp-btn').forEach(function(b){ b.addEventListener('click', function(){ openWasteOverlay(d.rows[parseInt(b.dataset.i)]); }); });
        });
    }
    function openWasteOverlay(r){
        var ov=document.createElement('div'); ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
        ov.innerHTML='<div style="background:#fff;border-radius:16px;width:380px;max-width:92vw;box-shadow:0 12px 48px rgba(0,0,0,0.3);overflow:hidden">'
            +'<div style="padding:16px 20px;background:#c62828;color:#fff;text-align:center;font-size:16px;font-weight:700">Record Wastage (Expired)</div>'
            +'<div style="padding:20px 24px">'
            +'<div style="font-size:14px;font-weight:600;margin-bottom:4px">'+r.productName+'</div>'
            +'<div style="font-size:12px;color:#777;margin-bottom:14px">'+r.sku+' · Expiry '+r.expiry+' · Cost ₹'+wfmt(r.cost)+'</div>'
            +'<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:4px">Quantity to write off</label>'
            +'<input id="wexp-qty" type="number" step="1" value="1" style="width:100%;padding:11px 14px;border:2px solid #c62828;border-radius:8px;font-size:18px;font-weight:700;text-align:center;box-sizing:border-box;outline:none"/>'
            +'<div style="display:flex;gap:10px;margin-top:18px"><button id="wexp-cancel" style="flex:1;padding:13px;border:2px solid #ccc;border-radius:10px;font-weight:700;cursor:pointer;background:#fff;color:#555">Cancel</button><button id="wexp-confirm" style="flex:1;padding:13px;border:none;border-radius:10px;font-weight:700;cursor:pointer;background:#c62828;color:#fff">Record Wastage</button></div>'
            +'</div></div>';
        document.body.appendChild(ov); ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
        document.getElementById('wexp-cancel').addEventListener('click',function(){ ov.remove(); });
        document.getElementById('wexp-confirm').addEventListener('click',function(){
            var q=Number(document.getElementById('wexp-qty').value||0); if(q<=0){ return; }
            var btn=document.getElementById('wexp-confirm'); btn.disabled=true; btn.textContent='Recording...';
            wpost('Wastage/WastageEntry/recordExpiredWastage',{productId:r.productId, productName:r.productName, quantity:q, unitCost:r.cost}).then(function(d){
                if(d&&d.success){ ov.remove(); var t=document.createElement('div'); t.textContent='✔ Wastage recorded'; t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999999;background:#2e7d32;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,0.3)'; document.body.appendChild(t); setTimeout(function(){ t.remove(); },2500); renderExpiring(); }
                else { btn.disabled=false; btn.textContent='Record Wastage'; alert((d&&d.error)||'Error recording wastage'); }
            });
        });
    }
    setInterval(function(){ var root=document.getElementById('wastage-expiring-root'); if(root && !root.dataset.wr){ root.dataset.wr='1'; renderExpiring(); } }, 700);
})();

/* === Bill History (works with or without an open session) === */
(function() {
    var CTX = { sessionId: '', terminalId: '' };
    function histToken() {
        try { if (window.moqui && window.moqui.webrootVue && window.moqui.webrootVue.moquiSessionToken) return window.moqui.webrootVue.moquiSessionToken; } catch(e){}
        var af = document.getElementById('cartInlineAddForm');
        if (af) { var t = af.querySelector('[name=moquiSessionToken]'); if (t) return t.value; }
        return '';
    }
    function histToast(msg, bg) {
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:999999;padding:18px 36px;border-radius:12px;font-size:20px;font-weight:700;color:#fff;background:'+(bg||'#2e7d32')+';box-shadow:0 6px 32px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s;white-space:nowrap;letter-spacing:0.5px';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function() { t.style.opacity = '1'; }, 30);
        setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 400); }, 3500);
    }
        /* === Bill History Panel === */
        var historyOverlay = null;
        function openBillHistory(search) {
            if (historyOverlay) { historyOverlay.remove(); historyOverlay = null; }
            var ov = document.createElement('div');
            ov.id = 'pos-history-overlay';
            historyOverlay = ov;
            ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
            var panel = document.createElement('div');
            panel.style.cssText = 'background:#fff;border-radius:16px;width:90vw;max-width:800px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,0.3);overflow:hidden';
            panel.innerHTML = '<div style="padding:16px 20px;background:#1565c0;color:#fff;display:flex;justify-content:space-between;align-items:center">'
                + '<span style="font-size:18px;font-weight:700">&#128196; Bill History</span>'
                + '<button id="hist-close" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;padding:0 4px">&times;</button></div>'
                + '<div style="padding:12px 20px;border-bottom:1px solid #e0e0e0">'
                + '<input id="hist-search" type="text" placeholder="Search by bill number, amount, or customer..." value="'+(search||'')+'" style="width:100%;padding:10px 14px;border:1px solid #ccc;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none"/></div>'
                + '<div id="hist-list" style="flex:1;overflow-y:auto;padding:8px 12px"><div style="text-align:center;padding:40px;color:#999">Loading...</div></div>';
            ov.appendChild(panel);
            document.body.appendChild(ov);
            try { var _cs=getComputedStyle(ov); console.log('[posterm] overlay appended inDOM=', document.body.contains(ov), 'w=', ov.offsetWidth, 'h=', ov.offsetHeight, 'z=', _cs.zIndex, 'display=', _cs.display, 'pos=', _cs.position, 'parent=', ov.parentNode && ov.parentNode.tagName); } catch(e){ console.log('[posterm] overlay diag err', e); }
            ov.addEventListener('click', function(ev) { if (ev.target === ov) closeHistory(); });
            panel.querySelector('#hist-close').addEventListener('click', closeHistory);
            var searchInput = panel.querySelector('#hist-search');
            var searchTimer = null;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function() { loadHistoryList(searchInput.value); }, 400);
            });
            searchInput.focus();
            loadHistoryList(search || '');
        }
        function closeHistory() {
            if (historyOverlay) { historyOverlay.remove(); historyOverlay = null; }
        }
        function historyPost(params) {
            if (CTX.sessionId) params.sessionId = CTX.sessionId;
            if (CTX.terminalId) params.terminalId = CTX.terminalId;
            params.moquiSessionToken = histToken();
            return fetch('Terminal/ajaxCart', {
                method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: new URLSearchParams(params), credentials: 'same-origin'
            }).then(function(r) { return r.json(); });
        }
        /* === Auto-print a REVISED receipt (with EDITED note) after a bill is amended === */
        function printEditedReceipt(txId, billNo, taxOn) {
            if (!txId) return;
            // On the billing screen, reuse the full QZ/iframe pipeline (silent print when QZ is connected)
            if (typeof window._posPrintReceipt === 'function') {
                try { window._posPrintReceipt(txId, billNo, taxOn || 'Y', true); return; } catch(e) {}
            }
            // Fallback (e.g. no active session): fetch receipt data and browser-print
            historyPost({action:'receiptData', transactionId: txId}).then(function(d) {
                if (!d || !d.success) return;
                histIframePrint(buildHistReceipt(d, taxOn === 'Y'));
            });
        }
        function buildHistReceipt(d, isTax) {
            var s = d.store || {}, bi = d.bill || {}, sm = d.summary || {};
            function f2(n) { return Number(n||0).toFixed(2); }
            var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Revised Receipt</title><style>'
                + '@page{size:80mm auto;margin:0}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000}'
                + '.rcpt{width:72mm;margin:0 auto;padding:2mm 3mm;box-sizing:border-box}'
                + '.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.sep{border-bottom:1px dashed #000;margin:4px 0}.sep2{border-bottom:2px solid #000;margin:4px 0}'
                + 'table{width:100%;border-collapse:collapse}th,td{padding:2px 1px;font-size:11px}th{border-bottom:1px solid #000}.hdr{font-size:8px;color:#666}.tot{font-size:15px;font-weight:bold}</style></head><body><div class="rcpt">';
            h += '<div class="c b" style="font-size:16px;margin:2px 0">' + (s.name || 'Store') + '</div>';
            if (s.address) h += '<div class="c hdr">' + s.address + '</div>';
            if (isTax && s.taxReg) h += '<div class="c hdr">GSTIN: ' + s.taxReg + '</div>';
            h += '<div class="sep"></div>';
            h += '<div class="c b" style="font-size:13px;margin:3px 0">' + (isTax ? 'TAX INVOICE' : 'RECEIPT') + '</div>';
            h += '<div class="c b" style="font-size:12px;margin:3px 0;border:1px dashed #000;padding:3px 2px">** EDITED / REVISED BILL **</div>';
            h += '<div class="c hdr" style="margin-bottom:2px">Reprinted after modification</div>';
            h += '<table><tr><td class="hdr" style="width:30%">Bill No:</td><td class="b">' + (bi.number || '') + '</td></tr>';
            h += '<tr><td class="hdr">Date:</td><td>' + (bi.date || '') + '</td></tr>';
            h += '<tr><td class="hdr">Customer:</td><td>' + (bi.customer || 'Walk-In') + '</td></tr></table>';
            h += '<div class="sep2"></div>';
            h += '<table><thead><tr><th style="width:16px">#</th><th style="text-align:left">Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Total</th></tr></thead><tbody>';
            (d.items || []).forEach(function(it, i) {
                var hnm = (it.name||'') + (it.mode && it.mode !== 'Retail' ? ' <span style="font-size:8px;color:#555">['+it.mode+']</span>' : '');
                h += '<tr><td class="c">' + (i+1) + '</td><td>' + hnm + '</td><td class="c">' + (it.qty + (it.uom ? ' ' + it.uom : '')) + '</td><td class="r">' + f2(it.rate) + '</td><td class="r">' + f2(it.total) + '</td></tr>';
            });
            h += '</tbody></table><div class="sep"></div>';
            h += '<table><tr><td>Subtotal</td><td class="r">' + f2(sm.subtotal) + '</td></tr>';
            if (isTax && Number(sm.tax||0) > 0) h += '<tr><td>Tax</td><td class="r">' + f2(sm.tax) + '</td></tr>';
            h += '</table><div class="sep2"></div>';
            h += '<table><tr><td class="tot">' + (isTax ? 'GRAND TOTAL' : 'TOTAL') + '</td><td class="r tot">' + f2(sm.total) + '</td></tr></table>';
            h += '<div class="c b" style="font-size:13px;margin-top:6px">Thank You !!</div>';
            h += '<div class="c" style="margin-top:6px;font-size:7px;color:#666">Powered by ZetaERP &middot; visit www.zetaclantech.com</div>';
            h += '</div>';
            return h;
        }
        function histIframePrint(html) {
            html += '<script>window.onload=function(){window.print();}<\/script></body></html>';
            var iframe = document.getElementById('pos-hist-receipt-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'pos-hist-receipt-frame';
                iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:80mm;height:0;border:none;visibility:hidden';
                document.body.appendChild(iframe);
            }
            var iDoc = iframe.contentDocument || iframe.contentWindow.document;
            iDoc.open(); iDoc.write(html); iDoc.close();
        }
        function loadHistoryList(search) {
            var listEl = document.getElementById('hist-list');
            if (!listEl) return;
            listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#999">Loading...</div>';
            historyPost({action:'billHistory', search:search||''}).then(function(d) {
                if (!d || !d.success || !d.bills || d.bills.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#999">'+(search ? 'No bills match "'+search+'"' : 'No completed bills in this session')+'</div>';
                    return;
                }
                var h = '<div style="font-size:12px;color:#999;padding:4px 8px;margin-bottom:4px">'+d.total+' bill'+(d.total>1?'s':'')+' found</div>';
                d.bills.forEach(function(bill) {
                    var payStr = (bill.payments||[]).map(function(p) { return p.method; }).join(', ');
                    var edited = bill.amendCount > 0 ? '<span style="background:#ff9800;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;margin-left:6px">EDITED ('+bill.amendCount+')</span>' : '';
                    h += '<div class="hist-bill-row" data-tx-id="'+bill.txId+'" style="padding:12px 14px;border:1px solid #e8e8e8;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;background:#fafafa" onmouseover="this.style.background=\'#e3f2fd\';this.style.borderColor=\'#90caf9\'" onmouseout="this.style.background=\'#fafafa\';this.style.borderColor=\'#e8e8e8\'">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center">'
                        + '<div><span style="font-weight:700;font-size:15px;color:#1565c0">#'+bill.billNo+'</span>'+edited+'</div>'
                        + '<span style="font-weight:800;font-size:16px;color:#2e7d32">₹'+Number(bill.grand||0).toFixed(2)+'</span></div>'
                        + '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#777">'
                        + '<span>'+bill.date+'</span>'
                        + '<span>'+bill.customer+' &middot; '+bill.itemCount+' item'+(bill.itemCount>1?'s':'')+' &middot; '+payStr+'</span>'
                        + '</div></div>';
                });
                listEl.innerHTML = h;
                listEl.querySelectorAll('.hist-bill-row').forEach(function(row) {
                    row.addEventListener('click', function() {
                        var txId = row.dataset.txId;
                        var bill = d.bills.find(function(b) { return b.txId === txId; });
                        if (bill) openCartEditor(bill);
                    });
                });
            });
        }
        function openBillDetail(bill) {
            var listEl = document.getElementById('hist-list');
            if (!listEl) return;
            var h = '<div style="padding:8px">';
            h += '<button id="hist-back" style="background:none;border:none;color:#1565c0;font-size:14px;cursor:pointer;padding:4px 0;font-weight:600">&larr; Back to list</button>';
            h += '<div style="background:#f5f5f5;border-radius:10px;padding:14px;margin-top:8px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
                + '<span style="font-size:18px;font-weight:700;color:#1565c0">Bill #'+bill.billNo+'</span>'
                + '<span style="font-size:11px;color:#999">'+bill.date+'</span></div>';
            h += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
            h += '<thead><tr style="border-bottom:2px solid #ddd"><th style="text-align:left;padding:6px 4px">#</th><th style="text-align:left;padding:6px 4px">Item</th><th style="text-align:right;padding:6px 4px">Rate</th><th style="text-align:center;padding:6px 4px">Qty</th><th style="text-align:right;padding:6px 4px">Total</th><th style="padding:6px 4px"></th></tr></thead><tbody>';
            (bill.items||[]).forEach(function(it, idx) {
                h += '<tr style="border-bottom:1px solid #eee" data-seq="'+it.seq+'" data-tx="'+bill.txId+'">'
                    + '<td style="padding:6px 4px;color:#999">'+(idx+1)+'</td>'
                    + '<td style="padding:6px 4px;font-weight:600">'+it.name+'</td>'
                    + '<td style="padding:6px 4px;text-align:right"><input type="number" class="hist-price" value="'+Number(it.price).toFixed(2)+'" data-seq="'+it.seq+'" style="width:70px;padding:4px;border:1px solid #ccc;border-radius:4px;text-align:right;font-size:13px"/></td>'
                    + '<td style="padding:6px 4px;text-align:center"><input type="number" class="hist-qty" value="'+it.qty+'" data-seq="'+it.seq+'" min="1" style="width:50px;padding:4px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:13px"/></td>'
                    + '<td style="padding:6px 4px;text-align:right;font-weight:600">₹'+Number(it.total).toFixed(2)+'</td>'
                    + '<td style="padding:6px 4px;text-align:center"><button class="hist-rm" data-seq="'+it.seq+'" style="background:#e53935;color:#fff;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1">&times;</button></td>'
                    + '</tr>';
            });
            h += '</tbody></table>';
            h += '<div style="margin-top:10px;display:flex;justify-content:space-between;font-size:14px">'
                + '<span>Subtotal: ₹'+Number(bill.subtotal||0).toFixed(2)+' | Tax: ₹'+Number(bill.tax||0).toFixed(2)+'</span>'
                + '<span style="font-weight:800;font-size:16px;color:#2e7d32">Total: ₹'+Number(bill.grand||0).toFixed(2)+'</span></div>';
            h += '<div style="margin-top:6px;font-size:12px;color:#777">Payment: '+(bill.payments||[]).map(function(p) { return p.method+' ₹'+Number(p.amount).toFixed(2); }).join(', ')+'</div>';
            if (Number(bill.refundDue||0) > 0) {
                h += '<div style="margin-top:8px;background:#fff8e1;border:2px solid #f57f17;border-radius:8px;padding:10px;text-align:center;font-weight:800;font-size:15px;color:#e65100">&#8617; REFUND ₹'+Number(bill.refundDue).toFixed(2)+' to the customer<div style="font-size:11px;font-weight:600;color:#bf360c;margin-top:2px">Bill total dropped below the amount already paid</div></div>';
            } else if (Number(bill.balanceDue||0) > 0) {
                h += '<div style="margin-top:8px;background:#ffebee;border:2px solid #c62828;border-radius:8px;padding:10px;text-align:center;font-weight:800;font-size:15px;color:#b71c1c">&#43; COLLECT ₹'+Number(bill.balanceDue).toFixed(2)+' more from the customer<div style="font-size:11px;font-weight:600;color:#7f0000;margin-top:2px">Bill total rose above the amount already paid</div></div>';
            }
            h += '</div>';
            if (bill.amendments && bill.amendments.length > 0) {
                h += '<div style="margin-top:12px;background:#fff3e0;border-radius:10px;padding:12px">';
                h += '<div style="font-weight:700;font-size:13px;color:#e65100;margin-bottom:6px">&#9888; Edit History ('+bill.amendments.length+')</div>';
                bill.amendments.forEach(function(a) {
                    h += '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #ffe0b2">'
                        + '<span style="color:#999">'+a.date+'</span> — '
                        + '<span style="font-weight:600">'+a.type.replace('_',' ')+'</span>: '
                        + a.product+' ['+a.oldVal+' → '+a.newVal+'] — <i>'+a.reason+'</i></div>';
                });
                h += '</div>';
            }
            h += '<div style="margin-top:12px;background:#e3f2fd;border-radius:10px;padding:12px">';
            h += '<div style="font-weight:600;font-size:13px;color:#1565c0;margin-bottom:6px">&#43; Add Item to Bill</div>';
            h += '<div style="display:flex;gap:6px;align-items:center">';
            h += '<div style="flex:1;position:relative"><input id="hist-add-search" type="text" placeholder="Search product by name or code..." style="width:100%;padding:10px;border:1px solid #90caf9;border-radius:6px;font-size:13px;box-sizing:border-box;outline:none"/>';
            h += '<div id="hist-add-results" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:10;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);max-height:200px;overflow-y:auto;margin-top:2px"></div></div>';
            h += '<input id="hist-add-qty" type="number" value="1" min="1" style="width:60px;padding:10px;border:1px solid #90caf9;border-radius:6px;font-size:13px;text-align:center;box-sizing:border-box"/>';
            h += '</div></div>';
            h += '<div style="margin-top:12px;background:#e8f5e9;border-radius:10px;padding:12px">';
            h += '<div style="font-weight:600;font-size:13px;color:#2e7d32;margin-bottom:6px">Edit this bill</div>';
            h += '<div style="font-size:12px;color:#666;margin-bottom:8px">Change qty or price above, remove items, or add new items. Enter reason and click Save.</div>';
            h += '<input id="hist-reason" type="text" placeholder="Reason for edit (required)..." style="width:100%;padding:10px;border:1px solid #c8e6c9;border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:8px"/>';
            h += '<button id="hist-save-edits" style="width:100%;padding:12px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">&#10003; Save Changes</button>';
            h += '</div></div>';
            listEl.innerHTML = h;
            listEl.querySelector('#hist-back').addEventListener('click', function() {
                var sv = document.getElementById('hist-search');
                loadHistoryList(sv ? sv.value : '');
            });
            listEl.querySelectorAll('.hist-rm').forEach(function(btn) {
                btn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    var reason = document.getElementById('hist-reason').value.trim();
                    if (!reason) { histToast('Please enter a reason for the edit', '#e53935'); document.getElementById('hist-reason').focus(); return; }
                    var seq = btn.dataset.seq;
                    btn.disabled = true; btn.textContent = '...';
                    historyPost({action:'amendBill', editTxId:bill.txId, editType:'ITEM_REMOVED', editItemSeqId:seq, editReason:reason}).then(function(r) {
                        if (r && r.success) {
                            histToast('Item removed & recorded — printing revised bill', '#e65100');
                            openBillDetail(r.bill);
                            printEditedReceipt(r.bill.txId, r.bill.billNo, (Number(r.bill.tax) > 0 ? 'Y' : 'N'));
                        } else { histToast(r.error||'Error', '#e53935'); btn.disabled = false; btn.textContent = '×'; }
                    });
                });
            });
            listEl.querySelector('#hist-save-edits').addEventListener('click', function() {
                var reason = document.getElementById('hist-reason').value.trim();
                if (!reason) { histToast('Please enter a reason for the edit', '#e53935'); document.getElementById('hist-reason').focus(); return; }
                var changes = [];
                listEl.querySelectorAll('.hist-qty').forEach(function(inp) {
                    var seq = inp.dataset.seq;
                    var orig = (bill.items||[]).find(function(it) { return it.seq === seq; });
                    if (orig && Number(inp.value) !== Number(orig.qty)) {
                        changes.push({type:'QTY_CHANGE', seq:seq, val:inp.value});
                    }
                });
                listEl.querySelectorAll('.hist-price').forEach(function(inp) {
                    var seq = inp.dataset.seq;
                    var orig = (bill.items||[]).find(function(it) { return it.seq === seq; });
                    if (orig && Number(inp.value).toFixed(2) !== Number(orig.price).toFixed(2)) {
                        changes.push({type:'PRICE_CHANGE', seq:seq, val:inp.value});
                    }
                });
                if (changes.length === 0) { histToast('No changes to save', '#ff9800'); return; }
                var saveBtn = listEl.querySelector('#hist-save-edits');
                saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
                var chain = Promise.resolve(null);
                changes.forEach(function(c) {
                    chain = chain.then(function() {
                        var params = {action:'amendBill', editTxId:bill.txId, editType:c.type, editItemSeqId:c.seq, editReason:reason};
                        if (c.type === 'QTY_CHANGE') params.newQty = c.val;
                        if (c.type === 'PRICE_CHANGE') params.newPrice = c.val;
                        return historyPost(params);
                    });
                });
                chain.then(function(lastResult) {
                    if (lastResult && lastResult.success) {
                        histToast('✔ Bill edited & recorded — printing revised bill', '#2e7d32');
                        openBillDetail(lastResult.bill);
                        printEditedReceipt(lastResult.bill.txId, lastResult.bill.billNo, (Number(lastResult.bill.tax) > 0 ? 'Y' : 'N'));
                    } else {
                        histToast(lastResult?.error||'Error saving', '#e53935');
                        saveBtn.disabled = false; saveBtn.textContent = '✓ Save Changes';
                    }
                });
            });
            var addSearch = listEl.querySelector('#hist-add-search');
            var addResults = listEl.querySelector('#hist-add-results');
            var addTimer = null;
            if (addSearch) addSearch.addEventListener('input', function() {
                clearTimeout(addTimer);
                var q = addSearch.value.trim();
                if (q.length < 1) { addResults.style.display = 'none'; return; }
                addTimer = setTimeout(function() {
                    historyPost({action:'searchProductsJson', q:q}).then(function(d) {
                        if (!d || !d.success || !d.products || d.products.length === 0) {
                            addResults.innerHTML = '<div style="padding:12px;color:#999;font-size:13px">No products found</div>';
                            addResults.style.display = 'block'; return;
                        }
                        var rh = '';
                        d.products.forEach(function(p) {
                            rh += '<div class="hist-prod-item" data-pid="'+p.pid+'" data-name="'+p.name+'" data-price="'+p.price+'" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;transition:background 0.1s" onmouseover="this.style.background=\'#e3f2fd\'" onmouseout="this.style.background=\'#fff\'">'
                                + '<div><div style="font-weight:600;font-size:13px">'+p.name+'</div><div style="font-size:11px;color:#999">'+p.pid+'</div></div>'
                                + '<span style="font-weight:700;color:#2e7d32">₹'+Number(p.price).toFixed(2)+'</span></div>';
                        });
                        addResults.innerHTML = rh;
                        addResults.style.display = 'block';
                        addResults.querySelectorAll('.hist-prod-item').forEach(function(row) {
                            row.addEventListener('click', function() {
                                var reason = document.getElementById('hist-reason').value.trim();
                                if (!reason) { histToast('Please enter a reason first', '#e53935'); document.getElementById('hist-reason').focus(); return; }
                                var pid = row.dataset.pid;
                                var qty = document.getElementById('hist-add-qty').value || '1';
                                addResults.style.display = 'none';
                                addSearch.value = '';
                                row.style.opacity = '0.5';
                                historyPost({action:'amendBill', editTxId:bill.txId, editType:'ITEM_ADDED', addProductId:pid, addQty:qty, editReason:reason}).then(function(r) {
                                    if (r && r.success) {
                                        histToast('✔ Item added & recorded — printing revised bill', '#2e7d32');
                                        openBillDetail(r.bill);
                                        printEditedReceipt(r.bill.txId, r.bill.billNo, (Number(r.bill.tax) > 0 ? 'Y' : 'N'));
                                    } else { histToast(r.error||'Error adding item', '#e53935'); }
                                });
                            });
                        });
                    });
                }, 300);
            });
        }

        /* === Edit an issued bill IN the cart view ===
           Loads a completed bill's items into a cart-styled editor mounted over the .pos-cart
           panel. Editing is entirely client-side (the live open cart is never touched); SAVE diffs
           against the original and replays the proven server `amendBill` ops (same bill number,
           tracked amendments, tax recompute, refund/collect, revised receipt). No-op for normal
           billing — nothing here runs unless a cashier opens a bill from History to edit. */
        var cartEditorEl = null, cartEditorPrevPos = '';
        function closeCartEditor() {
            var cartEl = document.querySelector('.pos-cart');
            if (cartEditorEl && cartEditorEl.parentNode) cartEditorEl.parentNode.removeChild(cartEditorEl);
            cartEditorEl = null;
            if (cartEl) cartEl.style.position = cartEditorPrevPos || '';
        }
        function openCartEditor(bill) {
            closeHistory();
            closeCartEditor();
            var cartEl = document.querySelector('.pos-cart');
            if (!cartEl) { histToast('Cart view not available', '#e53935'); return; }
            // The editor is a light card; force readable colors so the dark-theme rules
            // (body.body--dark .pos-cart table tbody td/input { …!important }) don't bleed in.
            // An #id selector outranks the theme's class selectors.
            if (!document.getElementById('ced-style')) {
                var st = document.createElement('style'); st.id = 'ced-style';
                st.textContent =
                    '#pos-cart-editor table tbody td{color:#222 !important}'
                  + '#pos-cart-editor table tbody td>div{color:#999 !important}'
                  + '#pos-cart-editor table thead th{color:#777 !important;background:transparent !important}'
                  + '#pos-cart-editor input{background:#fff !important;color:#222 !important}'
                  + '#pos-cart-editor input::placeholder{color:#9aa0a6 !important}'
                  + '#pos-cart-editor .ced-inc,#pos-cart-editor .ced-dec{background:#f5f5f5 !important;color:#222 !important}'
                  + '#pos-cart-editor #ced-add-res{background:#fff !important}'
                  + '#pos-cart-editor .ced-pi div{color:#222 !important}';
                document.head.appendChild(st);
            }
            function f2(n) { return Number(n||0).toFixed(2); }
            // Working model — one row per line. Existing lines carry their seq; new lines have seq=null.
            var work = (bill.items || []).map(function(it) {
                var price = Number(it.price)||0, qty = Number(it.qty)||0;
                var taxable = price * qty;
                return { seq: it.seq, pid: it.pid, name: it.name, uom: it.uom || '',
                         price: price, qty: qty,
                         origPrice: price, origQty: qty,
                         taxRate: (taxable > 0 ? (Number(it.tax)||0) / taxable : 0),
                         isNew: false, removed: false };
            });
            cartEditorPrevPos = cartEl.style.position || '';
            cartEl.style.position = 'relative';
            var ed = document.createElement('div');
            cartEditorEl = ed;
            ed.id = 'pos-cart-editor';
            ed.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:900;background:#fff;display:flex;flex-direction:column;box-shadow:-2px 0 0 #1565c0 inset';
            // Block the global terminal keyboard shortcuts while typing in the editor.
            ed.addEventListener('keydown', function(e) { e.stopPropagation(); });
            ed.innerHTML =
                '<div style="background:#1565c0;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">'
              + '<div><span style="font-size:16px;font-weight:800">&#9998; Editing Bill #'+bill.billNo+'</span>'
              + '<div style="font-size:11px;opacity:0.9;margin-top:2px">Change qty / price, remove or add items, then Save. This updates the same bill &mdash; not a new sale.</div></div>'
              + '<button id="ced-cancel-x" title="Cancel" style="background:rgba(255,255,255,0.18);border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;border-radius:6px;width:34px;height:34px">&times;</button></div>'
              + '<div id="ced-rows" style="flex:1;overflow-y:auto;padding:6px 10px"></div>'
              + '<div style="flex-shrink:0;border-top:1px solid #e0e0e0;background:#f0faf0;padding:8px 12px;position:relative">'
              +   '<div style="display:flex;gap:6px;align-items:center;position:relative">'
              +     '<input id="ced-add" type="text" placeholder="&#43; Add item — search name or code…" autocomplete="off" style="flex:1;padding:9px 12px;border:1px solid #90caf9;border-radius:6px;font-size:13px;box-sizing:border-box;outline:none"/>'
              +     '<input id="ced-add-qty" type="number" value="1" min="1" style="width:56px;padding:9px;border:1px solid #90caf9;border-radius:6px;font-size:13px;text-align:center;box-sizing:border-box"/>'
              +     '<div id="ced-add-res" style="display:none;position:absolute;bottom:100%;left:0;right:0;z-index:20;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 -4px 16px rgba(0,0,0,0.15);max-height:200px;overflow-y:auto;margin-bottom:4px"></div>'
              +   '</div>'
              + '</div>'
              + '<div style="flex-shrink:0;border-top:1px solid #e0e0e0;padding:10px 12px;background:#fafafa">'
              +   '<div id="ced-totals" style="font-size:13px;color:#333;margin-bottom:8px"></div>'
              +   '<input id="ced-reason" type="text" placeholder="Reason for edit (required)…" style="width:100%;padding:10px;border:1px solid #c8e6c9;border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:8px;outline:none"/>'
              +   '<div style="display:flex;gap:8px">'
              +     '<button id="ced-cancel" style="flex:1;padding:13px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#fff;color:#555">Cancel</button>'
              +     '<button id="ced-save" style="flex:2;padding:13px;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;background:#2e7d32;color:#fff">&#10003; Save changes</button>'
              +   '</div>'
              + '</div>';
            cartEl.appendChild(ed);

            var rowsEl = ed.querySelector('#ced-rows');
            var totalsEl = ed.querySelector('#ced-totals');
            function dirty() {
                for (var i=0;i<work.length;i++){ var w=work[i];
                    if (w.isNew && !w.removed) return true;
                    if (!w.isNew && w.removed) return true;
                    if (!w.isNew && !w.removed && (w.qty!==w.origQty || f2(w.price)!==f2(w.origPrice))) return true;
                }
                return false;
            }
            function renderRows() {
                var h = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
                  + '<thead><tr style="border-bottom:2px solid #ddd;color:#777">'
                  + '<th style="text-align:left;padding:6px 4px;width:22px">#</th>'
                  + '<th style="text-align:left;padding:6px 4px">Item</th>'
                  + '<th style="text-align:right;padding:6px 4px;width:78px">Rate</th>'
                  + '<th style="text-align:center;padding:6px 4px;width:104px">Qty</th>'
                  + '<th style="text-align:right;padding:6px 4px;width:74px">Total</th>'
                  + '<th style="width:30px"></th></tr></thead><tbody>';
                var shown = 0;
                work.forEach(function(w, idx) {
                    var lineTot = w.price * w.qty;
                    if (w.removed) {
                        h += '<tr data-idx="'+idx+'" style="border-bottom:1px solid #f0f0f0;background:#fff5f5;color:#bbb">'
                          + '<td style="padding:6px 4px">&mdash;</td>'
                          + '<td style="padding:6px 4px;text-decoration:line-through">'+w.name+'</td>'
                          + '<td colspan="3" style="padding:6px 4px;text-align:right;font-style:italic;color:#c62828">removed</td>'
                          + '<td style="padding:6px 4px;text-align:center"><button class="ced-undo" data-idx="'+idx+'" title="Undo" style="background:#eee;border:none;border-radius:4px;width:26px;height:26px;cursor:pointer;font-size:14px">&#8634;</button></td></tr>';
                        return;
                    }
                    shown++;
                    var newTag = w.isNew ? ' <span style="background:#2e7d32;color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;vertical-align:middle">NEW</span>' : '';
                    h += '<tr data-idx="'+idx+'" style="border-bottom:1px solid #eee">'
                      + '<td style="padding:6px 4px;color:#999">'+shown+'</td>'
                      + '<td style="padding:6px 4px;font-weight:600">'+w.name+newTag+(w.uom?'<div style="font-size:10px;color:#999;font-weight:400">'+w.uom+'</div>':'')+'</td>'
                      + '<td style="padding:6px 4px;text-align:right"><input class="ced-price" data-idx="'+idx+'" type="number" step="0.01" min="0" value="'+f2(w.price)+'" style="width:70px;padding:5px;border:1px solid #ccc;border-radius:4px;text-align:right;font-size:13px"/></td>'
                      + '<td style="padding:6px 4px;text-align:center;white-space:nowrap">'
                      +   '<button class="ced-dec" data-idx="'+idx+'" style="width:26px;height:28px;border:1px solid #bbb;background:#f5f5f5;border-radius:5px;font-size:16px;cursor:pointer;vertical-align:middle">&minus;</button>'
                      +   '<input class="ced-qty" data-idx="'+idx+'" type="number" step="0.001" min="0" value="'+w.qty+'" style="width:46px;padding:5px 2px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:13px;margin:0 3px;vertical-align:middle"/>'
                      +   '<button class="ced-inc" data-idx="'+idx+'" style="width:26px;height:28px;border:1px solid #bbb;background:#f5f5f5;border-radius:5px;font-size:16px;cursor:pointer;vertical-align:middle">&#43;</button>'
                      + '</td>'
                      + '<td style="padding:6px 4px;text-align:right;font-weight:600">&#8377;'+f2(lineTot)+'</td>'
                      + '<td style="padding:6px 4px;text-align:center"><button class="ced-rm" data-idx="'+idx+'" title="Remove" style="background:#e53935;color:#fff;border:none;border-radius:4px;width:26px;height:26px;cursor:pointer;font-size:15px;line-height:1">&times;</button></td></tr>';
                });
                h += '</tbody></table>';
                if (shown === 0) h += '<div style="text-align:center;color:#c62828;padding:18px;font-size:13px">All items removed — saving will empty this bill.</div>';
                rowsEl.innerHTML = h;
                bindRows();
                renderTotals();
            }
            function renderTotals() {
                var sub = 0, tax = 0, hasNew = false;
                work.forEach(function(w) {
                    if (w.removed) return;
                    var base = w.price * w.qty;
                    sub += base;
                    tax += base * (w.taxRate || 0);
                    if (w.isNew) hasNew = true;
                });
                var est = sub + tax;
                var orig = Number(bill.grand)||0;
                var diff = est - orig;
                var diffStr = diff > 0.005 ? ('<span style="color:#c62828;font-weight:700"> &nbsp;collect ~&#8377;'+f2(diff)+' more</span>')
                            : diff < -0.005 ? ('<span style="color:#1565c0;font-weight:700"> &nbsp;refund ~&#8377;'+f2(-diff)+'</span>')
                            : '';
                totalsEl.innerHTML = 'Est. subtotal &#8377;'+f2(sub)+' &middot; GST ~&#8377;'+f2(tax)
                  + ' &middot; <b>Est. total ~&#8377;'+f2(est)+'</b>'+diffStr
                  + '<div style="font-size:11px;color:#999;margin-top:2px">Was &#8377;'+f2(orig)+'. '
                  + (hasNew ? 'New items priced at default; ' : '') + 'final GST &amp; total are recomputed when you save.</div>';
            }
            function bindRows() {
                rowsEl.querySelectorAll('.ced-price').forEach(function(inp){ inp.addEventListener('change', function(){ var w=work[+inp.dataset.idx]; var v=Number(inp.value); if(!(v>=0)){ inp.value=f2(w.price); return; } w.price=v; renderTotals(); var tot=inp.closest('tr').querySelector('td:nth-child(5)'); if(tot) tot.innerHTML='&#8377;'+f2(w.price*w.qty); }); });
                rowsEl.querySelectorAll('.ced-qty').forEach(function(inp){ inp.addEventListener('change', function(){ var w=work[+inp.dataset.idx]; var v=Number(inp.value); if(!(v>0)){ inp.value=w.qty; return; } w.qty=v; renderTotals(); var tot=inp.closest('tr').querySelector('td:nth-child(5)'); if(tot) tot.innerHTML='&#8377;'+f2(w.price*w.qty); }); });
                rowsEl.querySelectorAll('.ced-inc').forEach(function(b){ b.addEventListener('click', function(){ var w=work[+b.dataset.idx]; w.qty=Math.round((w.qty+1)*1000)/1000; renderRows(); }); });
                rowsEl.querySelectorAll('.ced-dec').forEach(function(b){ b.addEventListener('click', function(){ var w=work[+b.dataset.idx]; var nv=Math.round((w.qty-1)*1000)/1000; if(nv>0){ w.qty=nv; renderRows(); } }); });
                rowsEl.querySelectorAll('.ced-rm').forEach(function(b){ b.addEventListener('click', function(){ var w=work[+b.dataset.idx]; if(w.isNew){ work.splice(+b.dataset.idx,1); } else { w.removed=true; } renderRows(); }); });
                rowsEl.querySelectorAll('.ced-undo').forEach(function(b){ b.addEventListener('click', function(){ work[+b.dataset.idx].removed=false; renderRows(); }); });
            }
            // Add-item search
            var addInp = ed.querySelector('#ced-add'), addRes = ed.querySelector('#ced-add-res'), addTimer=null;
            addInp.addEventListener('input', function(){
                clearTimeout(addTimer);
                var q = addInp.value.trim();
                if (q.length < 1) { addRes.style.display='none'; return; }
                addTimer = setTimeout(function(){
                    historyPost({action:'searchProductsJson', q:q}).then(function(d){
                        if (!d || !d.success || !d.products || !d.products.length) { addRes.innerHTML='<div style="padding:10px;color:#999;font-size:13px">No products found</div>'; addRes.style.display='block'; return; }
                        var rh='';
                        d.products.forEach(function(pr){ rh += '<div class="ced-pi" data-pid="'+pr.pid+'" data-name="'+(pr.name||'').replace(/"/g,'&quot;')+'" data-price="'+pr.price+'" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background=\'#e3f2fd\'" onmouseout="this.style.background=\'#fff\'"><div><div style="font-weight:600;font-size:13px">'+pr.name+'</div><div style="font-size:11px;color:#999">'+pr.pid+'</div></div><span style="font-weight:700;color:#2e7d32">&#8377;'+f2(pr.price)+'</span></div>'; });
                        addRes.innerHTML=rh; addRes.style.display='block';
                        addRes.querySelectorAll('.ced-pi').forEach(function(row){ row.addEventListener('click', function(){
                            var qy = Number(ed.querySelector('#ced-add-qty').value)||1; if(qy<=0) qy=1;
                            work.push({ seq:null, pid:row.dataset.pid, name:row.dataset.name, uom:'', price:Number(row.dataset.price)||0, qty:qy, origPrice:Number(row.dataset.price)||0, origQty:0, taxRate:0, isNew:true, removed:false });
                            addInp.value=''; addRes.style.display='none'; renderRows();
                        }); });
                    });
                }, 300);
            });
            document.addEventListener('click', function ofc(e){ if(!cartEditorEl){ document.removeEventListener('click', ofc); return; } if(addRes && !addRes.contains(e.target) && e.target!==addInp) addRes.style.display='none'; });

            function doCancel() { if (dirty() && !window.confirm('Discard your unsaved changes to Bill #'+bill.billNo+'?')) return; closeCartEditor(); }
            ed.querySelector('#ced-cancel').addEventListener('click', doCancel);
            ed.querySelector('#ced-cancel-x').addEventListener('click', doCancel);

            ed.querySelector('#ced-save').addEventListener('click', function(){
                var reason = ed.querySelector('#ced-reason').value.trim();
                if (!reason) { histToast('Enter a reason for the edit', '#e53935'); ed.querySelector('#ced-reason').focus(); return; }
                // Build the ordered op list: existing-line changes/removes, then new-item adds.
                var ops = [];
                work.forEach(function(w){
                    if (w.isNew || w.removed) return;
                    if (w.qty !== w.origQty) ops.push({type:'QTY_CHANGE', seq:w.seq, newQty:w.qty});
                    if (f2(w.price) !== f2(w.origPrice)) ops.push({type:'PRICE_CHANGE', seq:w.seq, newPrice:w.price});
                });
                work.forEach(function(w){ if (!w.isNew && w.removed) ops.push({type:'ITEM_REMOVED', seq:w.seq}); });
                work.forEach(function(w){ if (w.isNew && !w.removed) ops.push({type:'ITEM_ADDED', pid:w.pid, addQty:w.qty, customPrice:w.price, defPrice:w.origPrice}); });
                if (!ops.length) { histToast('No changes to save', '#ff9800'); return; }
                var saveBtn = ed.querySelector('#ced-save'); saveBtn.disabled=true; saveBtn.textContent='Saving…';
                var lastBill = null;
                var chain = Promise.resolve(null);
                ops.forEach(function(op){
                    chain = chain.then(function(){
                        var params = {action:'amendBill', editTxId:bill.txId, editReason:reason, editType:op.type};
                        if (op.type==='QTY_CHANGE') { params.editItemSeqId=op.seq; params.newQty=op.newQty; }
                        else if (op.type==='PRICE_CHANGE') { params.editItemSeqId=op.seq; params.newPrice=op.newPrice; }
                        else if (op.type==='ITEM_REMOVED') { params.editItemSeqId=op.seq; }
                        else if (op.type==='ITEM_ADDED') { params.addProductId=op.pid; params.addQty=op.addQty; }
                        return historyPost(params).then(function(r){
                            if (!r || !r.success) throw new Error(r && r.error ? r.error : 'Edit failed');
                            lastBill = r.bill;
                            // Honor a custom price on a just-added line: the server returns its new seq directly.
                            if (op.type==='ITEM_ADDED' && r.bill && r.bill.newSeq && Math.abs(Number(op.customPrice)-Number(op.defPrice))>0.005) {
                                return historyPost({action:'amendBill', editTxId:bill.txId, editReason:reason, editType:'PRICE_CHANGE', editItemSeqId:r.bill.newSeq, newPrice:op.customPrice}).then(function(r2){ if(r2&&r2.success) lastBill=r2.bill; });
                            }
                        });
                    });
                });
                chain.then(function(){
                    histToast('✔ Bill #'+(lastBill?lastBill.billNo:bill.billNo)+' updated — printing revised bill', '#2e7d32');
                    if (lastBill) {
                        var rd=Number(lastBill.refundDue)||0, bd=Number(lastBill.balanceDue)||0;
                        if (rd>0.005) setTimeout(function(){ histToast('↩ REFUND ₹'+f2(rd)+' to the customer', '#1565c0'); }, 1200);
                        else if (bd>0.005) setTimeout(function(){ histToast('➕ COLLECT ₹'+f2(bd)+' more from the customer', '#e65100'); }, 1200);
                        printEditedReceipt(lastBill.txId, lastBill.billNo, (Number(lastBill.tax)>0?'Y':'N'));
                    }
                    closeCartEditor();
                }).catch(function(err){
                    histToast(String(err && err.message ? err.message : err), '#e53935');
                    saveBtn.disabled=false; saveBtn.innerHTML='&#10003; Save changes';
                });
            });

            renderRows();
            setTimeout(function(){ var r=ed.querySelector('#ced-reason'); if(r) r.focus(); }, 50);
        }
        window.posOpenCartEditor = openCartEditor;

    window.posOpenHistory = function() {
        console.log('[posterm] posOpenHistory FIRED');
        var af = document.getElementById('cartInlineAddForm');
        var sid = af ? ((af.querySelector('[name=sessionId]')||{}).value || '') : '';
        CTX = { sessionId: sid, terminalId: '' };
        openBillHistory('');
    };
    /* Robust History button: bind via document delegation so the click works even if the inline
       onclick is dropped by the SPA shell or the button is (re)rendered after load. Guard prevents double-binding. */
    if (!window.__posHistDelegated) {
        window.__posHistDelegated = true;
        document.addEventListener('click', function(e) {
            var b = (e.target && e.target.closest) ? e.target.closest('#pos-history-btn, #pos-history-btn-ns') : null;
            if (b) { console.log('[posterm] delegation caught history click'); e.preventDefault(); if (typeof window.posOpenHistory === 'function') window.posOpenHistory(); }
        });
    }

    /* === Credit Bills screen: list outstanding credit bills + settle (partial allowed) === */
    function creditFmt(n) { return Number(n||0).toFixed(2); }
    function renderCreditBills(search) {
        var root = document.getElementById('credit-bills-root');
        if (!root) return;
        root.innerHTML = '<div style="text-align:center;padding:40px;color:#999">Loading credit bills…</div>';
        historyPost({action:'creditBills', search: search||''}).then(function(d) {
            if (!d || !d.success) { root.innerHTML = '<div style="text-align:center;padding:40px;color:#c62828">Error loading credit bills</div>'; return; }
            var h = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'
                + '<input id="credit-search" type="text" placeholder="Search bill no, customer or phone…" value="'+(search||'')+'" style="flex:1;min-width:220px;padding:10px 14px;border:1px solid #ccc;border-radius:8px;font-size:14px;outline:none"/>'
                + '<div style="font-size:14px;font-weight:700;color:#e65100">Total Due: ₹'+creditFmt(d.totalOutstanding)+' &middot; '+d.total+' bill'+(d.total!==1?'s':'')+'</div></div>';
            if (!d.bills || d.bills.length === 0) {
                h += '<div style="text-align:center;padding:40px;color:#999">No outstanding credit bills</div>';
            } else {
                d.bills.forEach(function(b) {
                    h += '<div style="border:1px solid #ffe0b2;background:#fff8f0;border-radius:10px;padding:14px;margin-bottom:10px">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
                        + '<div><span style="font-weight:700;font-size:15px;color:#1565c0">#'+b.billNo+'</span>'
                        + '<span style="font-size:12px;color:#777;margin-left:8px">'+b.date+'</span></div>'
                        + '<span style="font-weight:800;font-size:16px;color:#c62828">Due ₹'+creditFmt(b.outstanding)+'</span></div>'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-top:6px">'
                        + '<div style="font-size:13px;color:#555">'+b.customer+(b.phone?' &middot; '+b.phone:'')+' &middot; '+b.itemCount+' item'+(b.itemCount!==1?'s':'')+'</div>'
                        + '<div style="font-size:12px;color:#777">Total ₹'+creditFmt(b.grand)+' &middot; Paid ₹'+creditFmt(b.paid)+'</div></div>'
                        + '<button class="credit-settle-btn" data-tx="'+b.txId+'" style="margin-top:10px;width:100%;padding:10px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">&#128181; Settle Payment</button>'
                        + '</div>';
                });
            }
            root.innerHTML = h;
            var si = document.getElementById('credit-search');
            if (si) { var t=null; si.addEventListener('input', function(){ clearTimeout(t); t=setTimeout(function(){ renderCreditBills(si.value); }, 400); }); }
            root.querySelectorAll('.credit-settle-btn').forEach(function(btn){
                btn.addEventListener('click', function(){
                    var bill = (d.bills||[]).find(function(x){ return x.txId === btn.dataset.tx; });
                    if (bill) openSettleOverlay(bill);
                });
            });
        });
    }
    function openSettleOverlay(bill) {
        var outstanding = Number(bill.outstanding) || 0;
        var ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
        var tabBtn = 'flex:1;padding:10px;border:none;font-weight:700;font-size:14px;cursor:pointer';
        ov.innerHTML = '<div style="background:#fff;border-radius:16px;width:440px;max-width:92vw;max-height:92vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,0.3)">'
            + '<div style="padding:18px 20px;background:#2e7d32;color:#fff;text-align:center;font-size:17px;font-weight:700">Settle Credit — #'+bill.billNo+'</div>'
            + '<div style="padding:20px 24px">'
            + '<div style="font-size:13px;color:#555;margin-bottom:6px">'+bill.customer+(bill.phone?' · '+bill.phone:'')+'</div>'
            + '<div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:14px"><span>Outstanding</span><span style="font-weight:800;color:#c62828">₹'+creditFmt(outstanding)+'</span></div>'
            // mode toggle
            + '<div style="display:flex;border:2px solid #2e7d32;border-radius:10px;overflow:hidden;margin-bottom:16px">'
            + '<button type="button" id="mode-single" style="'+tabBtn+';background:#2e7d32;color:#fff">Single Method</button>'
            + '<button type="button" id="mode-split" style="'+tabBtn+';background:#fff;color:#2e7d32">Split Payment</button></div>'
            // ----- SINGLE -----
            + '<div id="settle-single">'
            + '<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:4px">Payment Method</label>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
            + '<button type="button" class="sm-opt" data-m="Cash" style="padding:12px;border:2px solid #4caf50;border-radius:8px;background:#4caf50;color:#fff;font-weight:700;cursor:pointer">Cash</button>'
            + '<button type="button" class="sm-opt" data-m="Card" style="padding:12px;border:2px solid #ccc;border-radius:8px;background:#fff;color:#333;font-weight:700;cursor:pointer">Card</button>'
            + '<button type="button" class="sm-opt" data-m="UPI" style="padding:12px;border:2px solid #ccc;border-radius:8px;background:#fff;color:#333;font-weight:700;cursor:pointer">UPI</button></div>'
            + '<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:4px">Amount Received</label>'
            + '<input id="settle-amt" type="number" step="0.01" value="'+creditFmt(outstanding)+'" style="width:100%;padding:12px 14px;border:2px solid #2e7d32;border-radius:8px;font-size:18px;font-weight:700;text-align:center;box-sizing:border-box;outline:none"/>'
            + '<div style="font-size:11px;color:#999;margin-top:6px;text-align:center">Enter less than outstanding for a partial payment</div>'
            + '</div>'
            // ----- SPLIT -----
            + '<div id="settle-split" style="display:none">'
            + '<div style="font-size:12px;color:#666;margin-bottom:10px">Enter how much is paid by each method (any combination).</div>'
            + splitRow('Cash', '#4caf50') + splitRow('Card', '#2196f3') + splitRow('UPI', '#9c27b0')
            + '<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-top:10px;padding-top:8px;border-top:1px solid #eee">'
            + '<span>Entered</span><span id="split-entered">₹0.00</span></div>'
            + '<div id="split-remaining" style="display:flex;justify-content:space-between;font-size:13px;color:#777;margin-top:4px"><span>Remaining</span><span>₹'+creditFmt(outstanding)+'</span></div>'
            + '</div>'
            + '<div style="display:flex;gap:12px;margin-top:18px">'
            + '<button id="settle-cancel" style="flex:1;padding:14px;border:2px solid #ccc;border-radius:10px;font-weight:700;cursor:pointer;background:#fff;color:#555">Cancel</button>'
            + '<button id="settle-confirm" style="flex:1;padding:14px;border:none;border-radius:10px;font-weight:700;cursor:pointer;background:#2e7d32;color:#fff">Confirm Payment</button></div>'
            + '</div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });

        var mode = 'single';
        var method = 'Cash';
        var singleEl = document.getElementById('settle-single');
        var splitEl = document.getElementById('settle-split');
        var mSingle = document.getElementById('mode-single');
        var mSplit = document.getElementById('mode-split');
        function setMode(m) {
            mode = m;
            var on = (m === 'split');
            splitEl.style.display = on ? 'block' : 'none';
            singleEl.style.display = on ? 'none' : 'block';
            mSplit.style.background = on ? '#2e7d32' : '#fff'; mSplit.style.color = on ? '#fff' : '#2e7d32';
            mSingle.style.background = on ? '#fff' : '#2e7d32'; mSingle.style.color = on ? '#2e7d32' : '#fff';
        }
        mSingle.addEventListener('click', function(){ setMode('single'); });
        mSplit.addEventListener('click', function(){ setMode('split'); });

        ov.querySelectorAll('.sm-opt').forEach(function(o){
            o.addEventListener('click', function(){
                method = o.dataset.m;
                ov.querySelectorAll('.sm-opt').forEach(function(x){ x.style.background='#fff'; x.style.color='#333'; x.style.borderColor='#ccc'; });
                var c = method==='Cash' ? '#4caf50' : (method==='Card' ? '#2196f3' : '#9c27b0');
                o.style.background=c; o.style.color='#fff'; o.style.borderColor=c;
            });
        });

        function splitInputs() { return { Cash: Number((document.getElementById('split-Cash')||{}).value || 0), Card: Number((document.getElementById('split-Card')||{}).value || 0), UPI: Number((document.getElementById('split-UPI')||{}).value || 0) }; }
        function refreshSplit() {
            var s = splitInputs();
            var ent = s.Cash + s.Card + s.UPI;
            var rem = outstanding - ent;
            document.getElementById('split-entered').textContent = '₹' + creditFmt(ent);
            var remEl = document.getElementById('split-remaining');
            remEl.innerHTML = '<span>Remaining</span><span style="font-weight:700;color:'+(Math.abs(rem)<0.005?'#2e7d32':(rem<0?'#c62828':'#e65100'))+'">₹'+creditFmt(rem)+(rem<0?' (over)':'')+'</span>';
        }
        ov.querySelectorAll('.split-inp').forEach(function(i){ i.addEventListener('input', refreshSplit); });

        document.getElementById('settle-cancel').addEventListener('click', function(){ ov.remove(); });
        document.getElementById('settle-confirm').addEventListener('click', function(){
            var btn = document.getElementById('settle-confirm');
            var pays = [];
            if (mode === 'single') {
                var amt = Number(document.getElementById('settle-amt').value || 0);
                if (amt <= 0) { histToast('Enter a valid amount', '#e53935'); return; }
                pays.push({ method: method, amount: amt });
            } else {
                var s = splitInputs();
                ['Cash','Card','UPI'].forEach(function(m){ if (s[m] > 0) pays.push({ method: m, amount: s[m] }); });
                if (pays.length === 0) { histToast('Enter at least one amount', '#e53935'); return; }
            }
            var total = pays.reduce(function(a,p){ return a + p.amount; }, 0);
            if (total > outstanding + 0.001) { histToast('Total exceeds outstanding ₹'+creditFmt(outstanding), '#e53935'); return; }
            btn.disabled = true; btn.textContent = 'Processing…';
            // Record each payment sequentially; the service clears credit when fully paid
            var chain = Promise.resolve(null);
            pays.forEach(function(p){
                chain = chain.then(function(prev){
                    if (prev && prev.error) return prev; // stop on first error
                    return historyPost({action:'settleCredit', settleTxId:bill.txId, settleMethod:p.method, settleAmount:String(p.amount)});
                });
            });
            chain.then(function(last){
                if (last && last.success) {
                    ov.remove();
                    if (last.fullyPaid) histToast('✔ Bill fully settled', '#2e7d32');
                    else histToast('✔ Payment recorded — ₹'+creditFmt(last.outstanding)+' remaining', '#e65100');
                    var si = document.getElementById('credit-search');
                    renderCreditBills(si ? si.value : '');
                } else { histToast((last && last.error) || 'Error settling', '#e53935'); btn.disabled = false; btn.textContent = 'Confirm Payment'; }
            });
        });
    }
    function splitRow(label, color) {
        return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
            + '<span style="width:48px;font-size:13px;font-weight:700;color:'+color+'">'+label+'</span>'
            + '<input id="split-'+label+'" class="split-inp" type="number" step="0.01" placeholder="0.00" style="flex:1;padding:10px 12px;border:2px solid '+color+';border-radius:8px;font-size:15px;font-weight:600;text-align:right;box-sizing:border-box;outline:none"/></div>';
    }
    // Auto-render whenever the Credit Bills screen is shown (poll persists across SPA navigation)
    setInterval(function(){
        var root = document.getElementById('credit-bills-root');
        if (root && !root.dataset.rendered) { root.dataset.rendered = '1'; renderCreditBills(''); }
    }, 700);
})();

/* === Fullscreen Toggle === */
window._pfs = window._pfs || {saved: [], active: false};
window.posPayCash = function(form) {
    // Cash tender modal: quick denomination buttons + editable amount + live change.
    // Defensive: any script error must NOT block checkout -> fall through to a normal exact-amount submit.
    try {
        var f = form.querySelector('input[name="amount"]');
        var due = parseFloat(f ? f.value : '0') || 0;
        if (due <= 0) { return true; }
        var old = document.getElementById('posCashTenderOverlay');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var denoms = [10, 20, 50, 100, 200, 500, 2000];
        var ov = document.createElement('div');
        ov.id = 'posCashTenderOverlay';
        ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:12px';
        var denomBtns = denoms.map(function(d) {
            return '<button type="button" data-deno="' + d + '" class="posCashDeno" style="padding:14px 4px;font-size:16px;font-weight:700;border:2px solid #4caf50;background:#e8f5e9;color:#2e7d32;border-radius:10px;cursor:pointer">+' + d + '</button>';
        }).join('');
        ov.innerHTML =
            '<div style="background:#fff;border-radius:14px;max-width:430px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,0.4);font-family:inherit">'
            + '<div style="font-size:18px;font-weight:800;color:#222;margin-bottom:12px">&#128176; Cash Payment</div>'
            + '<div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:8px"><span style="color:#666">Amount due</span><b style="color:#222">&#8377; ' + due.toFixed(2) + '</b></div>'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="color:#666;font-size:15px;min-width:62px">Received</span>'
            + '<input id="posCashRecv" type="number" step="any" min="0" value="' + due.toFixed(2) + '" style="flex:1;padding:12px;font-size:22px;font-weight:800;text-align:right;border:2px solid #4caf50;border-radius:10px;outline:none"/></div>'
            + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px">' + denomBtns
            + '<button type="button" id="posCashExact" style="padding:14px 4px;font-size:13px;font-weight:700;border:2px solid #1565c0;background:#e3f2fd;color:#1565c0;border-radius:10px;cursor:pointer">Exact</button>'
            + '<button type="button" id="posCashClear" style="padding:14px 4px;font-size:13px;font-weight:700;border:2px solid #c62828;background:#ffebee;color:#c62828;border-radius:10px;cursor:pointer">Clear</button></div>'
            + '<div id="posCashChange" style="text-align:center;font-size:18px;font-weight:800;padding:11px;border-radius:10px;margin-bottom:14px"></div>'
            + '<div style="display:flex;gap:10px"><button type="button" id="posCashCancel" style="flex:1;padding:14px;font-size:15px;font-weight:700;border:1px solid #bbb;background:#f5f5f5;color:#444;border-radius:10px;cursor:pointer">Cancel</button>'
            + '<button type="button" id="posCashConfirm" style="flex:2;padding:14px;font-size:16px;font-weight:800;border:none;background:#4caf50;color:#fff;border-radius:10px;cursor:pointer">Confirm &amp; Complete</button></div>'
            + '</div>';
        document.body.appendChild(ov);
        var recvInp = ov.querySelector('#posCashRecv');
        var changeEl = ov.querySelector('#posCashChange');
        var confirmBtn = ov.querySelector('#posCashConfirm');
        function refresh() {
            var r = parseFloat(recvInp.value) || 0;
            if (r < due) {
                changeEl.style.background = '#ffebee'; changeEl.style.color = '#b71c1c';
                changeEl.textContent = 'Short by ₹' + (due - r).toFixed(2);
                confirmBtn.disabled = true; confirmBtn.style.opacity = '0.45'; confirmBtn.style.cursor = 'not-allowed';
            } else {
                changeEl.style.background = '#e8f5e9'; changeEl.style.color = '#1b5e20';
                changeEl.textContent = 'Change to return: ₹' + (r - due).toFixed(2);
                confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.style.cursor = 'pointer';
            }
        }
        var denoEls = ov.querySelectorAll('.posCashDeno');
        for (var i = 0; i < denoEls.length; i++) {
            denoEls[i].addEventListener('click', function() {
                var cur = parseFloat(recvInp.value) || 0;
                recvInp.value = (cur + parseFloat(this.getAttribute('data-deno'))).toFixed(2);
                refresh();
            });
        }
        ov.querySelector('#posCashExact').addEventListener('click', function() { recvInp.value = due.toFixed(2); refresh(); });
        ov.querySelector('#posCashClear').addEventListener('click', function() { recvInp.value = '0'; refresh(); recvInp.focus(); });
        recvInp.addEventListener('input', refresh);
        function closeOv() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
        function doConfirm() {
            var r = parseFloat(recvInp.value) || 0;
            if (r < due) { return; }
            if (f) f.value = r.toFixed(2);
            closeOv();
            form.submit();
        }
        ov.querySelector('#posCashCancel').addEventListener('click', closeOv);
        confirmBtn.addEventListener('click', doConfirm);
        ov.addEventListener('click', function(e) { if (e.target === ov) closeOv(); });
        recvInp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); doConfirm(); }
            else if (e.key === 'Escape') { closeOv(); }
        });
        refresh();
        setTimeout(function() { try { recvInp.focus(); recvInp.select(); } catch (e) {} }, 50);
        return false;
    } catch (e) { return true; }
};

window.posPayDigital = function(form) {
    // Card / UPI confirmation gate. Unlike Cash, these forms submit (and mint the
    // bill) the instant the button is tapped, so a mis-tap or a declined/cancelled
    // payment would still complete the sale. Require the cashier to confirm the
    // payment actually went through first; Cancel aborts with no bill created.
    // Defensive: any error falls through to a normal submit (never blocks checkout).
    try {
        var amtI = form.querySelector('input[name="amount"]');
        var due = parseFloat(amtI ? amtI.value : '0') || 0;
        var methodI = form.querySelector('input[name="paymentMethod"]');
        var method = methodI ? methodI.value : 'Card';
        var isUpi = (method === 'UPI');
        var icon = isUpi ? '&#128241;' : '&#128179;';
        var label = isUpi ? 'UPI Payment' : 'Card Payment';
        var where = isUpi ? 'UPI / QR app' : 'card machine';
        var accent = isUpi ? '#9c27b0' : '#2196f3';
        var old = document.getElementById('posPayConfirmOverlay');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var ov = document.createElement('div');
        ov.id = 'posPayConfirmOverlay';
        ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:12px';
        ov.innerHTML =
            '<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.4);font-family:inherit">'
            + '<div style="font-size:18px;font-weight:800;color:#222;margin-bottom:14px">' + icon + ' ' + label + '</div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;margin-bottom:6px"><span style="color:#666">Amount</span><b style="color:#222;font-size:24px">&#8377; ' + due.toFixed(2) + '</b></div>'
            + '<div style="font-size:14px;color:#5d4037;line-height:1.6;margin:12px 0 18px;padding:11px 13px;background:#fff8e1;border:1px solid #ffe082;border-radius:9px">Take the payment on the <b>' + where + '</b> first. Press <b>Confirm</b> only after it shows <b>approved</b>. If it failed or you tapped by mistake, press <b>Cancel</b> &mdash; no bill is created.</div>'
            + '<div style="display:flex;gap:10px"><button type="button" id="posPayConfCancel" style="flex:1;padding:14px;font-size:15px;font-weight:700;border:1px solid #bbb;background:#f5f5f5;color:#444;border-radius:10px;cursor:pointer">Cancel</button>'
            + '<button type="button" id="posPayConfOk" style="flex:2;padding:14px;font-size:16px;font-weight:800;border:none;background:' + accent + ';color:#fff;border-radius:10px;cursor:pointer">Confirm Payment Received</button></div>'
            + '</div>';
        document.body.appendChild(ov);
        function closeOv() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
        var okBtn = ov.querySelector('#posPayConfOk');
        var doneOnce = false;
        function doConfirm() { if (doneOnce) return; doneOnce = true; closeOv(); form.submit(); }
        ov.querySelector('#posPayConfCancel').addEventListener('click', closeOv);
        okBtn.addEventListener('click', doConfirm);
        ov.addEventListener('click', function(e) { if (e.target === ov) closeOv(); });
        ov.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); doConfirm(); }
            else if (e.key === 'Escape') { e.preventDefault(); closeOv(); }
        });
        setTimeout(function() { try { okBtn.focus(); } catch (e) {} }, 50);
        return false;
    } catch (e) { return true; }
};

(function () {
    // POS keyboard shortcuts (hands-free billing). Bind once. F-keys work even while typing in the
    // scan/search box; '/' (focus scan) only fires when not already typing. The cash modal handles its
    // own keys, so shortcuts are paused while it is open.
    if (window.__posKeysBound) { return; }
    window.__posKeysBound = true;
    document.addEventListener('keydown', function (e) {
        if (document.getElementById('posCashTenderOverlay') || document.getElementById('posPayConfirmOverlay')) { return; }
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        var typing = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
        function clk(id) { var el = document.getElementById(id); if (el) { e.preventDefault(); el.click(); } }
        switch (e.key) {
            case 'F1': e.preventDefault(); clk('pos-pay-cash'); break;
            case 'F2': e.preventDefault(); clk('pos-pay-card'); break;
            case 'F3': e.preventDefault(); clk('pos-pay-upi'); break;
            case 'F4': e.preventDefault(); clk('pos-split'); break;
            case 'F5': e.preventDefault(); clk('pos-recall'); break;
            case 'F6': e.preventDefault(); clk('pos-credit'); break;
            case 'F7': e.preventDefault(); clk('pos-hold'); break;
            case 'F8': e.preventDefault(); clk('pos-void'); break;
            case 'F9': e.preventDefault(); var h = document.getElementById('pos-history-btn') || document.getElementById('pos-history-btn-ns'); if (h) h.click(); break;
            case 'F10': e.preventDefault(); var n = document.querySelector('a[href*="freshSale"]'); if (n) n.click(); break;
            case '/': if (!typing) { e.preventDefault(); var s = document.getElementById('cartInlineSearch') || document.getElementById('pos-search'); if (s) { s.focus(); if (s.select) s.select(); } } break;
            default: break;
        }
    });
})();
(function () {
    // Whole-terminal SPATIAL arrow navigation + fast cart editing + sales-mode shortcuts.
    //  - Arrow keys move a highlight to the nearest control in that direction across the whole
    //    terminal (categories <-> products <-> cart lines <-> pay buttons <-> sales-mode <-> search).
    //  - Tab jumps to the CART; Shift+Tab to Products.
    //  - On a cart line: type 0-9 = quantity (Enter applies), Enter/R = edit rate, +/- nudge qty,
    //    Del remove, and M = cycle THIS line's sales mode (the inline .aj-mode dropdown).
    //  - Anywhere else: M = cycle the GLOBAL sales mode (the header mode chips).
    //  - Enter activates the highlighted control (add product / open category / press pay button /
    //    switch sales mode / focus search).
    // Pure .click()/change on the SAME controls a finger would use; DOM re-queried each keystroke;
    // ignored while the cash modal is open or while typing in an input/textarea/select.
    if (window.__posArrowNav) { return; }
    window.__posArrowNav = true;

    var BLUE = '#1565c0', YELLOW = '#ffeb3b';
    var cur = null;       // { el, type, seq }
    var qtyBuf = '';
    var hintT = null;

    var SELS = [
        ['.pos-cat-strip a', 'cat'],
        ['.pos-header a[href*="changeSalesMode"]', 'mode'],
        ['.pos-product-grid button[type="submit"]', 'prod'],
        ['#pos-pay-cash', 'btn'], ['#pos-pay-card', 'btn'], ['#pos-pay-upi', 'btn'],
        ['#pos-split', 'btn'], ['#pos-credit', 'btn'], ['#pos-hold', 'btn'],
        ['#pos-void', 'btn'], ['#pos-recall', 'btn'],
        ['#pos-history-btn', 'btn'], ['#pos-history-btn-ns', 'btn'],
        ['#cartInlineSearch', 'search']
    ];

    function visible(el) { return !!(el && el.offsetParent !== null && el.getClientRects().length); }
    function seqOf(tr) { var b = tr.querySelector('.aj-q'); return b ? b.getAttribute('data-seq') : null; }

    function collect() {
        var out = [];
        SELS.forEach(function (pair) {
            Array.prototype.forEach.call(document.querySelectorAll(pair[0]), function (el) {
                if (visible(el)) out.push({ el: el, type: pair[1] });
            });
        });
        Array.prototype.forEach.call(document.querySelectorAll('.pos-cart tbody tr'), function (tr) {
            if (tr.querySelector('.aj-q') && visible(tr)) out.push({ el: tr, type: 'cartrow' });
        });
        return out;
    }

    function unhl(el) {
        if (!el) return;
        el.style.outline = ''; el.style.outlineOffset = ''; el.style.boxShadow = '';
        if (el.tagName === 'TR') el.style.background = '';
    }
    function hl(el, type) {
        el.style.outline = '3px solid ' + (type === 'cat' || type === 'mode' ? YELLOW : BLUE);
        el.style.outlineOffset = '-2px';
        if (type !== 'cat' && type !== 'mode') el.style.boxShadow = '0 0 0 3px rgba(21,101,192,0.30)';
        if (type === 'cartrow') el.style.background = '#e3f2fd';
        if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    var HINTS = {
        cat:     'CATEGORY &nbsp; <b>&#8592;&#8593;&#8595;&#8594;</b> move &nbsp; <b>Enter</b> open',
        mode:    'SALES MODE &nbsp; <b>&#8592;&#8594;</b> move &nbsp; <b>Enter</b> apply &nbsp; <b>M</b> cycle',
        prod:    'PRODUCT &nbsp; <b>&#8592;&#8593;&#8595;&#8594;</b> move &nbsp; <b>Enter</b> add &nbsp; <b>M</b> sales mode &nbsp; <b>Tab</b> &#8594; Cart',
        cartrow: 'CART LINE &nbsp; <b>type 0-9</b> = qty &nbsp; <b>Enter</b>/<b>R</b> rate &nbsp; <b>M</b> item mode &nbsp; <b>+ &#8722;</b> nudge &nbsp; <b>Del</b> remove &nbsp; <b>&#8593;&#8595;</b> line',
        btn:     'BUTTON &nbsp; <b>&#8592;&#8593;&#8595;&#8594;</b> move &nbsp; <b>Enter</b> press',
        search:  'SEARCH &nbsp; <b>Enter</b> type here &nbsp; <b>&#8592;&#8593;&#8595;&#8594;</b> move'
    };
    function hintBox() {
        var h = document.getElementById('posZoneHint');
        if (!h) {
            h = document.createElement('div');
            h.id = 'posZoneHint';
            h.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(21,101,192,0.96);color:#fff;padding:7px 16px;border-radius:20px;font-size:12px;font-weight:600;z-index:2147483500;box-shadow:0 4px 16px rgba(0,0,0,0.35);pointer-events:none;white-space:nowrap;font-family:inherit';
            document.body.appendChild(h);
        }
        return h;
    }
    function flash(html, bg, ms) {
        var h = hintBox();
        h.innerHTML = '&#9656; ' + html;
        h.style.display = 'block'; h.style.background = bg || 'rgba(21,101,192,0.96)';
        if (hintT) clearTimeout(hintT);
        hintT = setTimeout(function () { var e = document.getElementById('posZoneHint'); if (e) e.style.display = 'none'; }, ms || 3500);
    }
    function showHint(type) { flash(HINTS[type] || HINTS.prod, 'rgba(21,101,192,0.96)', 3500); }
    function showQtyHint() { flash('SET QTY &nbsp; <b style="font-size:15px">' + (qtyBuf || '0') + '</b> &nbsp; press <b>Enter</b> to apply &nbsp; <b>Esc</b> cancel', 'rgba(230,81,0,0.97)', 4000); }
    function showModeHint(name) { flash('SALES MODE &nbsp; <b style="font-size:14px">' + (name || '') + '</b>', 'rgba(21,101,192,0.96)', 3000); }

    function setCur(o) {
        if (cur && cur.el) unhl(cur.el);
        qtyBuf = '';
        cur = { el: o.el, type: o.type, seq: o.type === 'cartrow' ? seqOf(o.el) : null };
        hl(o.el, o.type);
        showHint(o.type);
    }

    function resolve(list) {
        if (!cur) return null;
        var i;
        if (cur.type === 'cartrow' && cur.seq) {
            for (i = 0; i < list.length; i++) if (list[i].type === 'cartrow' && seqOf(list[i].el) === cur.seq) return list[i];
        }
        for (i = 0; i < list.length; i++) if (list[i].el === cur.el) return list[i];
        return null;
    }

    function rehighlightCart() {
        if (!cur || cur.type !== 'cartrow') return;
        var list = collect(), c = resolve(list);
        if (c) { hl(c.el, 'cartrow'); cur.el = c.el; }
        else {
            var rowsLeft = list.filter(function (o) { return o.type === 'cartrow'; });
            if (rowsLeft.length) setCur(rowsLeft[0]); else cur = null;
        }
    }

    function setQty(rowEl, n) {
        var qb = rowEl.querySelectorAll('.aj-q');
        if (!qb.length) return;
        var btn = qb[qb.length - 1];
        btn.setAttribute('data-q', String(n));
        btn.click();
    }
    function focusRate(rowEl) {
        var pin = rowEl.querySelector('.aj-p');
        if (pin) { pin.focus(); if (pin.select) pin.select(); }
    }
    // cycle THIS cart line's inline sales-mode <select> (.aj-mode) -> fires setItemMode
    function cycleItemMode(rowEl) {
        var sel = rowEl.querySelector('.aj-mode');
        if (!sel || sel.options.length < 2) { flash('This item has no alternate sales mode', 'rgba(120,120,120,0.95)', 2500); return false; }
        sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
        var ev; try { ev = new Event('change', { bubbles: true }); } catch (e) { ev = document.createEvent('HTMLEvents'); ev.initEvent('change', true, false); }
        sel.dispatchEvent(ev);
        showModeHint(sel.options[sel.selectedIndex].text);
        setTimeout(rehighlightCart, 300);
        return true;
    }
    // cycle the GLOBAL sales mode (header chips) -> AJAX switch
    function cycleGlobalMode() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.pos-header a[href*="changeSalesMode"]'));
        if (links.length < 2) { flash('Only one sales mode is configured', 'rgba(120,120,120,0.95)', 2500); return false; }
        var ai = -1;
        for (var i = 0; i < links.length; i++) { var bc = links[i].style.borderColor; if (bc === '#fff' || bc === 'rgb(255, 255, 255)') { ai = i; break; } }
        var nx = links[(ai + 1) % links.length];
        nx.click();
        showModeHint(nx.textContent.trim());
        return true;
    }

    function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

    function move(dir) {
        var list = collect();
        if (!list.length) return;
        var c = resolve(list);
        if (!c) { setCur(list.find(function (o) { return o.type === 'prod'; }) || list[0]); return; }
        var a = center(c.el), best = null, bestScore = Infinity;
        list.forEach(function (o) {
            if (o.el === c.el) return;
            var b = center(o.el), dx = b.x - a.x, dy = b.y - a.y, along, cross;
            if (dir === 'ArrowRight') { if (dx <= 2) return; along = dx; cross = Math.abs(dy); }
            else if (dir === 'ArrowLeft') { if (dx >= -2) return; along = -dx; cross = Math.abs(dy); }
            else if (dir === 'ArrowDown') { if (dy <= 2) return; along = dy; cross = Math.abs(dx); }
            else { if (dy >= -2) return; along = -dy; cross = Math.abs(dx); }
            var score = along + cross * 2;
            if (score < bestScore) { bestScore = score; best = o; }
        });
        if (best) setCur(best);
    }

    function gotoCart() {
        var list = collect(), rows = list.filter(function (o) { return o.type === 'cartrow'; });
        if (!rows.length) { showHint('cartrow'); return; }
        var keep = (cur && cur.type === 'cartrow') ? (resolve(list) || rows[0]) : rows[0];
        setCur(keep);
    }
    function gotoProducts() {
        var list = collect(), p = list.find(function (o) { return o.type === 'prod'; });
        if (p) setCur(p);
    }

    function typing(e) { var t = (e.target && e.target.tagName ? e.target.tagName : '').toUpperCase(); return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'; }

    document.addEventListener('keydown', function (e) {
        if (document.getElementById('posCashTenderOverlay') || document.getElementById('posPayConfirmOverlay')) return;
        if (typing(e)) return;
        var k = e.key;

        if (k === 'Tab') { e.preventDefault(); if (e.shiftKey) gotoProducts(); else gotoCart(); return; }

        var isArrow = (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight');
        if (isArrow) {
            if (cur && cur.type === 'cartrow' && qtyBuf !== '') { var c0 = resolve(collect()); if (c0) { setQty(c0.el, parseFloat(qtyBuf) || 0); } qtyBuf = ''; }
            e.preventDefault(); move(k); return;
        }

        // global utility shortcuts: T tax toggle, F fullscreen, C close session
        if (k === 't' || k === 'T') { e.preventDefault(); var _tb = document.querySelector('.pos-header form[action*="toggleTax"] button'); if (_tb) { _tb.click(); flash('TAX toggled', 'rgba(21,101,192,0.96)', 2000); } return; }
        if (k === 'f' || k === 'F') { e.preventDefault(); var _fb = document.getElementById('posFullscreenBtn'); if (_fb) _fb.click(); else if (window.posToggleFullscreen) window.posToggleFullscreen(); return; }
        if (k === 'c' || k === 'C') { e.preventDefault(); if (window.confirm('Close this POS session?')) { var _cb = document.querySelector('.pos-header form[action*="closeSession"] button'); if (_cb) _cb.click(); } return; }

        // M = sales mode: global unless we're on a cart line (then it's the line's item mode)
        if ((k === 'm' || k === 'M') && !(cur && cur.type === 'cartrow')) { e.preventDefault(); cycleGlobalMode(); return; }

        if (!cur || !cur.el) return;

        if (cur.type === 'cartrow') {
            var list = collect(), c = resolve(list);
            if (!c) { rehighlightCart(); return; }
            var qb = c.el.querySelectorAll('.aj-q');

            if (k === 'm' || k === 'M') { e.preventDefault(); cycleItemMode(c.el); return; }
            if (/^[0-9]$/.test(k) || (k === '.' && qtyBuf.indexOf('.') < 0)) { e.preventDefault(); qtyBuf += k; showQtyHint(); return; }
            if (k === 'Enter') {
                e.preventDefault();
                if (qtyBuf !== '') { var n = parseFloat(qtyBuf); qtyBuf = ''; if (!isNaN(n)) { setQty(c.el, n); setTimeout(rehighlightCart, 280); } return; }
                focusRate(c.el); return;
            }
            if (k === 'r' || k === 'R') { e.preventDefault(); qtyBuf = ''; focusRate(c.el); return; }
            if (k === 'Escape') { if (qtyBuf !== '') { e.preventDefault(); qtyBuf = ''; showHint('cartrow'); } return; }
            if (k === '+' || k === '=') { e.preventDefault(); qtyBuf = ''; if (qb[1]) qb[1].click(); setTimeout(rehighlightCart, 280); return; }
            if (k === '-' || k === '_') { e.preventDefault(); qtyBuf = ''; if (qb[0]) qb[0].click(); setTimeout(rehighlightCart, 280); return; }
            if (k === 'Backspace') { e.preventDefault(); if (qtyBuf !== '') { qtyBuf = qtyBuf.slice(0, -1); showQtyHint(); } else { var _rmb = c.el.querySelector('.aj-rm'); if (_rmb) _rmb.click(); setTimeout(rehighlightCart, 280); } return; }
            if (k === 'Delete') { e.preventDefault(); qtyBuf = ''; var _rmd = c.el.querySelector('.aj-rm'); if (_rmd) _rmd.click(); setTimeout(rehighlightCart, 280); return; }
            return;
        }

        if (k === 'Enter') {
            e.preventDefault();
            var el = cur.el, type = cur.type;
            if (type === 'search') { el.focus(); if (el.select) el.select(); return; }
            el.click();
            if (type === 'prod') { setTimeout(function () { if (document.contains(el)) hl(el, 'prod'); }, 260); }
        }
    });
})();

(function () {
    // Keep the keyboard hints alive after the cart re-renders. pos-terminal.js's buildSummary()
    // rebuilds the whole payment panel from JS templates that have NO F-key badges, NO button
    // ids, and drop the shortcuts legend -> so after any cart change the key names vanish and the
    // F1-F8 / spatial-nav ids break. This pass re-applies them every time .pos-summary changes:
    //  - tags each pay/action button with its stable id (#pos-pay-cash ... #pos-void) + key badge
    //  - re-injects the "KEYBOARD SHORTCUTS" legend (cloned from the server-rendered one)
    // Idempotent + debounced; runs on load and via a MutationObserver.
    if (window.__posDecorate) { return; }
    window.__posDecorate = true;

    var savedLegend = null;

    function payButton(sm, m) { var i = sm.querySelector('input[name="paymentMethod"][value="' + m + '"]'); return i && i.closest('form') ? i.closest('form').querySelector('button') : null; }
    function formButton(sm, act) { var f = sm.querySelector('form[action*="' + act + '"]'); return f ? f.querySelector('button') : null; }

    // [finder, id, key]
    var MAP = [
        [function (sm) { return sm.querySelector('#pos-pay-cash, .pos-cash-btn'); }, 'pos-pay-cash', 'F1'],
        [function (sm) { return payButton(sm, 'Card'); }, 'pos-pay-card', 'F2'],
        [function (sm) { return payButton(sm, 'UPI'); }, 'pos-pay-upi', 'F3'],
        [function (sm) { return sm.querySelector('#pos-split, .pos-split-btn'); }, 'pos-split', 'F4'],
        [function (sm) { return formButton(sm, 'recallSale'); }, 'pos-recall', 'F5'],
        [function (sm) { return sm.querySelector('#pos-credit, [onclick*="posCreditSale"]'); }, 'pos-credit', 'F6'],
        [function (sm) { return formButton(sm, 'holdSale'); }, 'pos-hold', 'F7'],
        [function (sm) { return formButton(sm, 'voidSale'); }, 'pos-void', 'F8']
    ];

    function addBadge(el, key) {
        if (!el) return;
        // already badged? (our span, or the server-rendered one with the same key text)
        var sp = el.querySelectorAll('span');
        for (var i = 0; i < sp.length; i++) { if ((sp[i].textContent || '').trim() === key) return; }
        var s = document.createElement('span');
        s.className = 'kb-badge';
        s.style.cssText = 'margin-left:7px;padding:1px 6px;border:1px solid rgba(255,255,255,0.7);border-radius:4px;font-size:11px;font-weight:700;opacity:0.9';
        s.textContent = key;
        el.appendChild(s);
    }

    // header utility buttons (present even without an active cart) -> key badges
    var HDR = [
        [function () { return document.querySelector('.pos-header form[action*="toggleTax"] button'); }, 'T'],
        [function () { return document.getElementById('posFullscreenBtn'); }, 'F'],
        [function () { return document.querySelector('.pos-header form[action*="closeSession"] button'); }, 'C']
    ];

    function decorate() {
        HDR.forEach(function (h) { var el = h[0](); if (el) addBadge(el, h[1]); });
        var sm = document.querySelector('.pos-summary');
        if (!sm) return;
        MAP.forEach(function (m) {
            var el = m[0](sm);
            if (el) { if (!el.id) el.id = m[1]; addBadge(el, m[2]); }
        });
        var lg = document.getElementById('posKbLegend');
        if (lg) { if (!savedLegend) savedLegend = lg.outerHTML; }
        else if (savedLegend) { sm.insertAdjacentHTML('beforeend', savedLegend); }
    }

    var t = null;
    function schedule() { if (t) return; t = setTimeout(function () { t = null; decorate(); }, 80); }

    if (document.readyState !== 'loading') decorate();
    else document.addEventListener('DOMContentLoaded', decorate);
    try {
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { }
})();

window.posToggleFullscreen = function() {
    var root = document.getElementById('pos-terminal-root');
    if (!root) return;
    var pfs = window._pfs;
    if (pfs.active) {
        pfs.active = false;
        root.style.cssText = '';
        var ml = root.querySelector('.pos-main-layout');
        if (ml) ml.style.height = '';
        document.body.style.overflow = '';
        for (var i = pfs.saved.length - 1; i >= 0; i--) pfs.saved[i].el.style.cssText = pfs.saved[i].css;
        pfs.saved = [];
        try { sessionStorage.removeItem('posFS'); } catch(e) {}
        var ic = document.getElementById('fsBtnIcon');
        if (ic) ic.textContent = '⛶';
    } else {
        pfs.active = true; pfs.saved = [];
        var el = root.parentNode;
        while (el && el !== document) {
            if (el.style) {
                pfs.saved.push({el: el, css: el.style.cssText});
                if (el !== document.body && el !== document.documentElement) {
                    el.style.padding = '0'; el.style.margin = '0'; el.style.maxWidth = 'none';
                    el.style.width = '100%'; el.style.height = '100%'; el.style.border = 'none'; el.style.overflow = 'visible';
                }
            }
            if (el.parentNode && el.parentNode.children) {
                for (var i = 0; i < el.parentNode.children.length; i++) {
                    var sib = el.parentNode.children[i];
                    if (sib !== el && sib.tagName !== 'SCRIPT' && sib.tagName !== 'STYLE' && sib.tagName !== 'LINK') {
                        pfs.saved.push({el: sib, css: sib.style.cssText}); sib.style.display = 'none';
                    }
                }
            }
            el = el.parentNode;
        }
        document.body.style.overflow = 'hidden';
        root.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:#fff';
        var ml = root.querySelector('.pos-main-layout');
        if (ml) ml.style.height = 'calc(100vh - 52px)';
        window.scrollTo(0, 0);
        try { sessionStorage.setItem('posFS', '1'); } catch(e) {}
        var ic = document.getElementById('fsBtnIcon');
        if (ic) ic.textContent = '✖';
    }
};
(function() {
    try { if (sessionStorage.getItem('posFS') === '1') setTimeout(window.posToggleFullscreen, 100); } catch(e) {}
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F11') { e.preventDefault(); window.posToggleFullscreen(); }
        if (e.key === 'Escape' && window._pfs && window._pfs.active) window.posToggleFullscreen();
    });
})();

/* === Core AJAX Engine === */
(function() {
    function init() {
        var af = document.getElementById('cartInlineAddForm');
        if (!af) { setTimeout(init, 300); return; }
        // The /apps SPA re-executes this screen script on soft-navigation, and the
        // no-session load's init() retry-loop stays alive across the open-session swap.
        // Without this guard TWO optimistic engines bind to the same cart+grid: one
        // product tap fires both grid-submit listeners -> two addItem POSTs -> the cart
        // re-renders optimistic + settleA + settleB (the "three states" flicker, and the
        // item could even post twice). The flag lives on the cart FORM element, so it is
        // per-live-DOM: a real DOM swap brings a fresh form (no flag) and re-binds cleanly,
        // while a bare re-exec against the same form is skipped.
        if (af.dataset.posEngineBound) return;   // a cart engine is already wired to this form (guards SPA soft-nav re-exec)
        af.dataset.posEngineBound = '1';

        var TK = (af.querySelector('[name=moquiSessionToken]') || {}).value || '';
        var SI = (af.querySelector('[name=sessionId]') || {}).value || '';
        var TX = (af.querySelector('[name=transactionId]') || {}).value || '';
        var TO = (af.querySelector('[name=taxOn]') || {}).value || 'Y';
        var SM = (af.querySelector('[name=salesModeId]') || {}).value || '';
        var CATID = (af.querySelector('[name=catId]') || {}).value || '';
        var CS = '₹';
        var busy = false;
        var lastTxnNum = '';
        var lastPay = 0;
        var lastCartData = null;
        var heldId = '';
        var heldCount = 0;

        function fmt(n) { return Math.round(Number(n)).toLocaleString('en-IN'); }
        function fmt2(n) { return Number(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }

        function extractHeldInfo(doc) {
            var badge = doc.querySelector('[data-held-id]');
            if (badge) {
                heldId = badge.dataset.heldId || '';
                heldCount = parseInt(badge.dataset.heldCount) || 0;
                return;
            }
            var rf = doc.querySelector('form[action*="recallSale"]');
            if (rf) { var hi = rf.querySelector('input[name="heldId"]'); heldId = hi ? hi.value : ''; }
            var hc = 0;
            doc.querySelectorAll('span').forEach(function(s) { var m = s.textContent.match(/HELD:\s*(\d+)/); if (m) hc = parseInt(m[1]); });
            heldCount = hc;
            if (hc === 0) heldId = '';
        }
        function updateHeldBadge() {
            // The held UI is the server-rendered #pos-held-wrap <details> picker, kept fresh via
            // syncHeldWrap() from each hold/recall/void response. The old JS #pos-held-badge is
            // retired so it can't duplicate the native one on /apps. No-op kept for old callers.
            var stale = document.getElementById('pos-held-badge'); if (stale) stale.remove();
            var dd = document.getElementById('pos-held-dropdown'); if (dd) dd.remove();
        }
        function toggleHeldDropdown() {
            var dd = document.getElementById('pos-held-dropdown');
            if (dd) { dd.remove(); return; }
            post({action:'listHeld', sessionId:SI}).then(function(d) {
                if (!d.success || !d.held || d.held.length === 0) { showToast('No held bills', '#ff9800'); return; }
                var badge = document.getElementById('pos-held-badge');
                if (!badge) return;
                var panel = document.createElement('div');
                panel.id = 'pos-held-dropdown';
                panel.style.cssText = 'position:absolute;top:100%;right:0;z-index:99999;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);min-width:320px;max-height:400px;overflow-y:auto;margin-top:8px;border:1px solid #e0e0e0';
                var h = '<div style="padding:12px 16px;background:#ff9800;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center">'
                    + '<span style="font-weight:700;font-size:15px">' + d.heldCount + ' Held Bill' + (d.heldCount > 1 ? 's' : '') + '</span>'
                    + '<span style="font-size:14px">Total: ₹' + Number(d.heldTotal||0).toFixed(2) + '</span></div>';
                d.held.forEach(function(bill, idx) {
                    var items = (bill.items||[]).slice(0,3).map(function(it) { return it.name + ' x' + it.qty; }).join(', ');
                    if (bill.itemCount > 3) items += ' +' + (bill.itemCount - 3) + ' more';
                    h += '<div class="held-bill-row" data-held-id="' + bill.heldId + '" style="padding:12px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.15s"'
                        + ' onmouseover="this.style.background=\'#fff3e0\'" onmouseout="this.style.background=\'#fff\'">'
                        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                        + '<span style="font-weight:700;font-size:14px;color:#333">#' + (idx+1) + ' — ' + bill.customer + '</span>'
                        + '<span style="font-weight:700;font-size:14px;color:#e65100">₹' + Number(bill.subtotal||0).toFixed(2) + '</span></div>'
                        + '<div style="font-size:12px;color:#777">' + items + '</div>'
                        + '<div style="font-size:11px;color:#999;margin-top:2px">' + bill.holdTime + (bill.reason ? ' — ' + bill.reason : '') + '</div>'
                        + '</div>';
                });
                panel.innerHTML = h;
                badge.appendChild(panel);
                panel.addEventListener('click', function(ev) {
                    var row = ev.target.closest('.held-bill-row');
                    if (!row) return;
                    ev.stopPropagation();
                    var hid = row.dataset.heldId;
                    panel.remove();
                    recallHeldBill(hid);
                });
                var closeOnClick = function(ev) {
                    if (!panel.contains(ev.target) && ev.target !== badge) {
                        panel.remove(); document.removeEventListener('click', closeOnClick);
                    }
                };
                setTimeout(function() { document.addEventListener('click', closeOnClick); }, 50);
            });
        }
        function recallHeldBill(hid) {
            var fd = new URLSearchParams();
            fd.set('heldId', hid); fd.set('sessionId', SI); fd.set('taxOn', TO);
            fd.set('salesModeId', SM); fd.set('moquiSessionToken', TK);
            fetch('Terminal/recallSale', {method:'POST', body:fd, credentials:'same-origin'})
                .then(function(r) { return r.text().then(function(html) { return {html:html, url:r.url||''}; }); })
                .then(function(resp) {
                    var respDoc = new DOMParser().parseFromString(resp.html, 'text/html');
                    var ntx = respDoc.querySelector('input[name="transactionId"]');
                    var newTx = ntx ? (ntx.value||'') : '';
                    if (!newTx && resp.url) { var m = resp.url.match(/transactionId=(\d+)/); if (m) newTx = m[1]; }
                    if (newTx) {
                        TX = newTx;
                        document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
                        var ntk = respDoc.querySelector('input[name="moquiSessionToken"]');
                        if (ntk && ntk.value) TK = ntk.value;
                        extractHeldInfo(respDoc);
                        updateHeldBadge();
                        post({action:'refresh', transactionId:TX}).then(function(d) {
                            renderCart(d);
                            showToast('✔ Held sale recalled', '#e65100');
                        });
                    }
                });
        }
        function recallBtn() {
            return '<form method="post" action="Terminal/recallSale" style="margin:0">'
                + '<input type="hidden" name="heldId" value="'+heldId+'"/>'
                + '<input type="hidden" name="sessionId" value="'+SI+'"/>'
                + '<input type="hidden" name="taxOn" value="'+TO+'"/>'
                + '<input type="hidden" name="salesModeId" value="'+SM+'"/>'
                + '<input type="hidden" name="moquiSessionToken" value="'+TK+'"/>'
                + '<button type="submit" style="width:100%;padding:14px 8px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#e65100;color:#fff">&#128260; RECALL'+(heldCount > 1 ? ' ('+heldCount+')' : '')+'</button></form>';
        }
        function appendRecallIfNeeded() {
            if (heldCount <= 0 || !heldId) return;
            var sm = document.querySelector('.pos-summary');
            if (!sm || sm.querySelector('form[action*="recallSale"]')) return;
            if (sm.textContent.indexOf('Tap products') !== -1) {
                var div = document.createElement('div');
                div.style.marginTop = '8px';
                div.innerHTML = recallBtn();
                sm.appendChild(div);
            }
        }

        /* === Close Session — summary overlay then AJAX close === */
        (function interceptCloseSession() {
            function fmt(n) { return Number(n||0).toFixed(2); }
            function row(label, val, bold, color) {
                return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;'+(bold?'font-weight:700;font-size:16px;':'font-size:14px;')+(color?'color:'+color:'')+'"><span>'+label+'</span><span>₹'+fmt(val)+'</span></div>';
            }
            document.addEventListener('submit', function(ev) {
                var form = ev.target;
                if (!form || !form.action || form.action.indexOf('closeSession') === -1) return;
                ev.preventDefault();
                var ov = document.createElement('div');
                ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
                ov.innerHTML = '<div style="background:#fff;border-radius:16px;width:420px;max-width:90vw;box-shadow:0 12px 48px rgba(0,0,0,0.3);overflow:hidden">'
                    + '<div style="padding:20px;background:#c62828;color:#fff;text-align:center;font-size:18px;font-weight:700">Close Session - Summary</div>'
                    + '<div style="padding:32px;text-align:center;color:#999">Loading summary...</div></div>';
                document.body.appendChild(ov);
                ov.addEventListener('click', function(e) { if (e.target === ov) { ov.remove(); } });
                fetch('Terminal/ajaxCart', {
                    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: new URLSearchParams({action:'sessionSummary', sessionId: SI, moquiSessionToken: TK}),
                    credentials: 'same-origin'
                }).then(function(r) { return r.json(); }).then(function(d) {
                    if (!d || !d.success) { ov.remove(); alert(d ? d.error : 'Error loading summary'); return; }
                    var card = ov.firstElementChild;
                    var body = '<div style="padding:20px 24px">'
                        + '<div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e0e0e0">'
                        + '<div style="font-size:36px;font-weight:800;color:#1565c0">'+d.billCount+'</div>'
                        + '<div style="font-size:13px;color:#777">Bills Completed</div></div>'
                        + row('Total Sales', d.totalSales, true, '#2e7d32')
                        + '<div style="height:8px"></div>'
                        + row('Opening Cash', d.openingCash, false)
                        + row('Cash Received', d.cashReceived, false, '#2e7d32')
                        + row('Card Received', d.cardReceived, false, '#1565c0')
                        + row('UPI Received', d.upiReceived, false, '#7b1fa2')
                        + row('Change Given', d.changeGiven, false, '#e65100')
                        + '<div style="height:4px"></div>'
                        + row('Expected Cash in Drawer', d.expectedCash, true, '#1565c0')
                        + '<div style="margin-top:20px">'
                        + '<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:6px">Actual Cash in Drawer</label>'
                        + '<input id="close-cash-input" type="number" step="0.01" value="'+fmt(d.expectedCash)+'" style="width:100%;padding:12px 14px;border:2px solid #1565c0;border-radius:8px;font-size:18px;font-weight:700;text-align:center;box-sizing:border-box;outline:none"/>'
                        + '<div id="close-cash-diff" style="text-align:center;font-size:13px;margin-top:6px;color:#999">Difference: ₹0.00</div></div>'
                        + '<div style="display:flex;gap:12px;margin-top:20px">'
                        + '<button id="close-cancel-btn" style="flex:1;padding:14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#fff;color:#555">Cancel</button>'
                        + '<button id="close-confirm-btn" style="flex:1;padding:14px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#c62828;color:#fff">Close Session</button></div></div>';
                    card.innerHTML = '<div style="padding:20px;background:#c62828;color:#fff;text-align:center;font-size:18px;font-weight:700">Close Session - Summary</div>' + body;
                    var cashInput = document.getElementById('close-cash-input');
                    var diffEl = document.getElementById('close-cash-diff');
                    cashInput.focus();
                    cashInput.select();
                    cashInput.addEventListener('input', function() {
                        var diff = Number(cashInput.value || 0) - Number(d.expectedCash || 0);
                        var color = diff === 0 ? '#2e7d32' : (diff < 0 ? '#c62828' : '#e65100');
                        var label = diff === 0 ? 'Balanced' : (diff > 0 ? 'Excess: +₹'+fmt(diff) : 'Short: -₹'+fmt(Math.abs(diff)));
                        diffEl.innerHTML = '<span style="color:'+color+';font-weight:600">'+label+'</span>';
                    });
                    document.getElementById('close-cancel-btn').addEventListener('click', function() { ov.remove(); });
                    document.getElementById('close-confirm-btn').addEventListener('click', function() {
                        var closingCash = cashInput.value || '0';
                        var btn = document.getElementById('close-confirm-btn');
                        btn.disabled = true; btn.textContent = 'Closing...';
                        var params = new URLSearchParams();
                        params.append('sessionId', SI);
                        params.append('closingCash', closingCash);
                        params.append('moquiSessionToken', TK);
                        fetch('Terminal/closeSession', {
                            method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                            body: params, credentials: 'same-origin', redirect: 'follow'
                        }).then(function() {
                            card.innerHTML = '<div style="padding:60px 40px;text-align:center">'
                                + '<div style="font-size:56px;margin-bottom:16px">&#9989;</div>'
                                + '<div style="font-size:22px;font-weight:700;color:#2e7d32">Session Closed Successfully</div>'
                                + '<div style="font-size:14px;color:#777;margin-top:8px">Returning to start screen...</div></div>';
                            // Reload the Terminal at its clean URL (no sessionId). Server now renders the
                            // "Open a session" screen for a closed session, ready for the next shift.
                            setTimeout(function() {
                                window.location.href = window.location.pathname.replace(/\/+$/, '');
                            }, 1200);
                        }).catch(function(err) {
                            btn.disabled = false; btn.textContent = 'Close Session';
                            alert('Error: ' + err.message);
                        });
                    });
                });
            }, true);
        })();

        /* === Credit / Pay-Later sale === */
        window.posCreditSale = function() {
            if (!TX) { showToast('Add items to the cart first', '#e53935'); return; }
            var ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
            ov.innerHTML = '<div style="background:#fff;border-radius:16px;width:420px;max-width:90vw;box-shadow:0 12px 48px rgba(0,0,0,0.3);overflow:hidden">'
                + '<div style="padding:18px 20px;background:#e65100;color:#fff;text-align:center;font-size:18px;font-weight:700">&#128196; Credit / Pay Later</div>'
                + '<div style="padding:20px 24px">'
                + '<div style="font-size:13px;color:#666;margin-bottom:14px">The current bill will be completed as <b>CREDIT (unpaid)</b>. Record who owes — settle the payment later from the Credit Bills screen.</div>'
                + '<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:4px">Customer Name *</label>'
                + '<input id="credit-name" type="text" autocomplete="off" style="width:100%;padding:11px 14px;border:2px solid #ffb74d;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;margin-bottom:12px"/>'
                + '<label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:4px">Customer Phone *</label>'
                + '<input id="credit-phone" type="tel" inputmode="numeric" autocomplete="off" style="width:100%;padding:11px 14px;border:2px solid #ffb74d;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none"/>'
                + '<div style="display:flex;gap:12px;margin-top:20px">'
                + '<button id="credit-cancel" style="flex:1;padding:14px;border:2px solid #ccc;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#fff;color:#555">Cancel</button>'
                + '<button id="credit-confirm" style="flex:1;padding:14px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#e65100;color:#fff">Complete Credit Sale</button>'
                + '</div></div></div>';
            document.body.appendChild(ov);
            ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
            var nameInp = document.getElementById('credit-name');
            nameInp.focus();
            document.getElementById('credit-cancel').addEventListener('click', function() { ov.remove(); });
            document.getElementById('credit-confirm').addEventListener('click', function() {
                var nm = (document.getElementById('credit-name').value || '').trim();
                var ph = (document.getElementById('credit-phone').value || '').trim();
                if (!nm) { showToast('Enter the customer name', '#e53935'); document.getElementById('credit-name').focus(); return; }
                if (!ph) { showToast('Enter the customer phone', '#e53935'); document.getElementById('credit-phone').focus(); return; }
                var btn = document.getElementById('credit-confirm');
                btn.disabled = true; btn.textContent = 'Completing...';
                // Submit a real form POST so the SPA navigates to the receipt/confirmation screen
                var f = document.createElement('form');
                f.method = 'post'; f.action = 'Terminal/completeCredit'; f.style.display = 'none';
                function hid(n, v) { var i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); }
                hid('transactionId', TX); hid('sessionId', SI); hid('salesModeId', SM);
                hid('customerName', nm); hid('customerPhone', ph); hid('moquiSessionToken', TK);
                document.body.appendChild(f);
                f.submit();
            });
        };

        function showToast(msg, bg) {
            var t = document.createElement('div');
            t.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:999999;padding:18px 36px;border-radius:12px;font-size:20px;font-weight:700;color:#fff;background:'+(bg||'#2e7d32')+';box-shadow:0 6px 32px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s;white-space:nowrap;letter-spacing:0.5px';
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(function() { t.style.opacity = '1'; }, 30);
            setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 400); }, 3500);
        }

        function showBanner(billNum, method) {
            var old = document.querySelector('.pos-print-banner');
            if (old) old.remove();
            var b = document.createElement('div');
            b.className = 'pos-print-banner';
            var label = method === 'qz' ? 'printed silently' : 'sent to printer';
            b.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:999998;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:#fff;padding:18px 30px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:18px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.3);transform:translateY(-100%);transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);letter-spacing:0.5px';
            b.innerHTML = '<span style="font-size:28px">&#128424;</span> BILL-' + (billNum || '') + ' ' + label + ' <span style="font-size:22px">&#10004;</span>';
            document.body.appendChild(b);
            setTimeout(function() { b.style.transform = 'translateY(0)'; }, 30);
            setTimeout(function() { b.style.transform = 'translateY(-100%)'; setTimeout(function() { b.remove(); }, 500); }, 4000);
        }

        /* === QZ Tray - Silent Thermal Printing === */
        var qzReady = false;
        var qzConnectFailed = false; // set once a connect attempt fails so we never stall waiting on it again
        var qzPrinter = '';
        try { qzPrinter = localStorage.getItem('posPrinter') || ''; } catch(e) {}

        function qzConnect() {
            if (typeof qz === 'undefined') { qzConnectFailed = true; return Promise.reject('QZ Tray library not loaded'); }
            if (qz.websocket.isActive()) { qzReady = true; qzConnectFailed = false; return Promise.resolve(); }
            // Race the connect against a short timeout — a missing/closed QZ Tray must never delay the receipt.
            var timer;
            var attempt = qz.websocket.connect({ retries: 0, delay: 0 });
            var guard = new Promise(function(_, rej) { timer = setTimeout(function() { rej('qz-timeout'); }, 1200); });
            return Promise.race([attempt, guard]).then(function() {
                clearTimeout(timer); qzReady = true; qzConnectFailed = false;
            }).catch(function(err) {
                clearTimeout(timer); qzConnectFailed = true; throw err;
            });
        }

        function qzShowSetup() {
            return qzConnect().then(function() {
                return qz.printers.find();
            }).then(function(printers) {
                return new Promise(function(resolve, reject) {
                    var old = document.querySelector('.pos-printer-overlay');
                    if (old) old.remove();
                    var ov = document.createElement('div');
                    ov.className = 'pos-printer-overlay';
                    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center';
                    var card = '<div style="background:#fff;border-radius:16px;padding:28px;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4)">'
                        + '<div style="font-size:20px;font-weight:700;color:#1565c0;margin-bottom:6px">&#128424; Printer Setup</div>'
                        + '<div style="font-size:13px;color:#666;margin-bottom:16px">Select your thermal receipt printer for silent printing via QZ Tray</div>';
                    if (printers.length === 0) {
                        card += '<div style="padding:20px;text-align:center;color:#e53935;font-size:15px">No printers found. Make sure your thermal printer is connected and drivers are installed.</div>';
                    } else {
                        printers.forEach(function(p) {
                            var sel = (p === qzPrinter) ? 'background:#e8f5e9;border-color:#4caf50;' : '';
                            card += '<div class="qz-printer-opt" data-name="'+p.replace(/"/g,'&quot;')+'" style="padding:12px 16px;border:2px solid #ddd;border-radius:10px;margin-bottom:8px;cursor:pointer;font-size:15px;font-weight:600;'+sel+'transition:all 0.15s">'
                                + p + '</div>';
                        });
                    }
                    card += '<div style="display:flex;gap:10px;margin-top:16px">'
                        + '<button class="qz-cancel" style="flex:1;padding:12px;border:2px solid #ccc;border-radius:10px;background:#f5f5f5;font-size:14px;font-weight:600;cursor:pointer;color:#666">Cancel</button>'
                        + '<button class="qz-save" style="flex:1;padding:12px;border:none;border-radius:10px;background:#1565c0;color:#fff;font-size:14px;font-weight:700;cursor:pointer;opacity:' + (qzPrinter ? '1' : '0.5') + '"' + (qzPrinter ? '' : ' disabled') + '>Save & Print</button>'
                        + '</div></div>';
                    ov.innerHTML = card;
                    document.body.appendChild(ov);
                    var selected = qzPrinter;
                    ov.addEventListener('click', function(e) {
                        var opt = e.target.closest('.qz-printer-opt');
                        if (opt) {
                            selected = opt.dataset.name;
                            ov.querySelectorAll('.qz-printer-opt').forEach(function(o) {
                                o.style.background = ''; o.style.borderColor = '#ddd';
                            });
                            opt.style.background = '#e8f5e9'; opt.style.borderColor = '#4caf50';
                            var sv = ov.querySelector('.qz-save');
                            if (sv) { sv.disabled = false; sv.style.opacity = '1'; }
                        }
                        if (e.target.closest('.qz-cancel')) { ov.remove(); reject('cancelled'); }
                        if (e.target.closest('.qz-save') && selected) {
                            qzPrinter = selected;
                            try { localStorage.setItem('posPrinter', qzPrinter); } catch(e2) {}
                            ov.remove();
                            resolve(qzPrinter);
                        }
                    });
                });
            });
        }

        function qzPrint(html, billNum) {
            return qzConnect().then(function() {
                if (!qzPrinter) return qzShowSetup();
                return qzPrinter;
            }).then(function(printer) {
                var cfg = qz.configs.create(printer, {
                    size: {width: 80}, units: 'mm', colorType: 'grayscale',
                    margins: {top: 0, right: 0, bottom: 0, left: 0}, scaleContent: false
                });
                var data = [{type: 'pixel', format: 'html', data: html,
                    options: {pageWidth: 80, pageHeight: null}}];
                return qz.print(cfg, data);
            }).then(function() {
                showBanner(billNum, 'qz');
            });
        }

        // Probe QZ Tray in the background right after load so the very first sale already
        // knows whether silent printing is available (qzConnectFailed) — no per-receipt stall.
        setTimeout(function() {
            qzConnect().then(function() {
                console.log('QZ Tray connected — silent printing enabled');
                showToast('Printer connected — silent printing active', '#1565c0');
            }).catch(function() {});
        }, 400);

        function buildReceiptHtml(d, isTax, edited) {
            var s = d.store || {}, bi = d.bill || {}, sm2 = d.summary || {};
            var cs2 = '₹';
            function f2(n) { return Number(n||0).toFixed(2); }
            var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>'
                + '<style>'
                + '@page{size:80mm auto;margin:0}'
                + 'body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000}'
                + '.rcpt{width:72mm;margin:0 auto;padding:2mm 3mm;box-sizing:border-box}'
                + '.c{text-align:center} .r{text-align:right} .b{font-weight:bold}'
                + '.sep{border-bottom:1px dashed #000;margin:4px 0}'
                + '.sep2{border-bottom:2px solid #000;margin:4px 0}'
                + 'table{width:100%;border-collapse:collapse}'
                + 'th,td{padding:2px 1px;font-size:11px}'
                + 'th{border-bottom:1px solid #000}'
                + '.hdr{font-size:8px;color:#666}'
                + '.tot{font-size:15px;font-weight:bold}'
                + '@media print{body{margin:0;padding:0}}'
                + '</style></head><body><div class="rcpt">';
            if (s.headerText) html += '<div class="c hdr">' + s.headerText + '</div>';
            html += '<div class="c b" style="font-size:16px;margin:2px 0">' + (s.name||'Store') + '</div>';
            if (s.address) html += '<div class="c hdr">' + s.address + '</div>';
            if (s.phone) html += '<div class="c hdr">Ph: ' + s.phone + '</div>';
            if (s.email) html += '<div class="c hdr">' + s.email + '</div>';
            if (isTax && s.taxReg) html += '<div class="c hdr">GSTIN: ' + s.taxReg + '</div>';
            html += '<div class="sep"></div>';
            if (isTax) {
                html += '<div class="c b" style="font-size:13px;margin:3px 0">TAX INVOICE</div>';
            } else {
                html += '<div class="c b" style="font-size:13px;margin:3px 0">RECEIPT</div>';
            }
            if (edited) {
                html += '<div class="c b" style="font-size:12px;margin:3px 0;border:1px dashed #000;padding:3px 2px">** EDITED / REVISED BILL **</div>';
                html += '<div class="c hdr" style="margin-bottom:2px">Reprinted after modification</div>';
            }
            html += '<table><tr><td class="hdr" style="width:30%">' + (isTax ? 'Invoice No:' : 'Bill No:') + '</td><td class="b">' + (bi.number||'') + '</td></tr>';
            html += '<tr><td class="hdr">Date:</td><td>' + (bi.date||'') + '</td></tr>';
            if (bi.cashier) html += '<tr><td class="hdr">Cashier:</td><td>' + bi.cashier + '</td></tr>';
            html += '<tr><td class="hdr">Customer:</td><td>' + (bi.customer||'Walk-In') + '</td></tr>';
            if (bi.customerPhone) html += '<tr><td class="hdr">Mobile:</td><td>' + bi.customerPhone + '</td></tr>';
            html += '</table>';
            html += '<div class="sep2"></div>';
            html += '<table><thead><tr><th style="text-align:center;width:16px">#</th><th style="text-align:left">Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Total</th></tr></thead><tbody>';
            (d.items||[]).forEach(function(it, idx) {
                var nm = (it.name||'') + (it.mode && it.mode !== 'Retail' ? ' <span style="font-size:8px;color:#555">['+it.mode+']</span>' : '');
                html += '<tr><td class="c">' + (idx+1) + '</td><td>' + nm + '</td><td class="c">' + (it.qty + (it.uom ? ' ' + it.uom : '')) + '</td><td class="r">' + f2(it.rate) + '</td><td class="r">' + f2(it.total) + '</td></tr>';
                if (Number(it.discount||0) > 0) html += '<tr><td colspan="5" style="font-size:9px;color:#666;padding-left:6px">' + (it.mode && it.mode !== 'Retail' ? it.mode + ' disc' : 'Disc') + ': -' + cs2 + f2(it.discount) + '</td></tr>';
            });
            html += '</tbody></table>';
            html += '<div class="sep"></div>';
            html += '<div style="font-size:10px;margin:2px 0">Total Qty: ' + sm2.totalQty + ' | Items: ' + sm2.itemCount + '</div>';
            html += '<table>';
            html += '<tr><td>Subtotal</td><td class="r">' + cs2 + f2(sm2.subtotal) + '</td></tr>';
            if (Number(sm2.discount||0) > 0) html += '<tr><td>Discount</td><td class="r">-' + cs2 + f2(sm2.discount) + '</td></tr>';
            if (isTax && Number(sm2.tax||0) > 0) {
                var halfTax = Number(sm2.tax) / 2;
                html += '<tr><td>CGST</td><td class="r">' + cs2 + f2(halfTax) + '</td></tr>';
                html += '<tr><td>SGST</td><td class="r">' + cs2 + f2(halfTax) + '</td></tr>';
            }
            if (Number(sm2.roundOff||0) !== 0) html += '<tr><td class="hdr">Round Off</td><td class="r hdr">' + f2(sm2.roundOff) + '</td></tr>';
            html += '</table>';
            html += '<div class="sep2"></div>';
            html += '<table><tr><td class="tot">' + (isTax ? 'GRAND TOTAL' : 'TOTAL') + '</td><td class="r tot">' + cs2 + f2(sm2.total) + '</td></tr></table>';
            if (isTax) html += '<div style="font-size:8px;color:#666;text-align:right;margin-top:1px">(Incl. of all taxes)</div>';
            html += '<div class="sep2"></div>';
            html += '<table>';
            (d.payments||[]).forEach(function(p) { html += '<tr><td>' + (p.method||'') + '</td><td class="r">' + cs2 + f2(p.amount) + '</td></tr>'; });
            if (Number(d.change||0) > 0) html += '<tr><td class="b">Change</td><td class="r b">' + cs2 + f2(d.change) + '</td></tr>';
            html += '</table>';
            if (d.isCredit) {
                html += '<div class="sep2"></div>';
                html += '<div class="c b" style="font-size:13px;border:1px dashed #000;padding:3px 2px">** CREDIT — UNPAID **</div>';
                html += '<table><tr><td class="b">Outstanding</td><td class="r b">' + cs2 + f2(d.outstanding) + '</td></tr></table>';
            }
            if (Number(d.saving||0) > 0) {
                html += '<div class="sep"></div>';
                html += '<div class="c b" style="font-size:12px">You Saved: ' + cs2 + f2(d.saving) + '</div>';
            }
            if (s.footerText) { html += '<div class="sep"></div><div class="c hdr" style="white-space:pre-line">' + String(s.footerText).replace(/\\r/g,'').replace(/\\n/g,'<br>').replace(/\n/g,'<br>') + '</div>'; }
            html += '<div class="c b" style="font-size:13px;margin-top:6px">Thank You !!</div>';
            html += '<div class="c" style="margin-top:6px;font-size:7px;color:#666">Powered by ZetaERP &middot; visit www.zetaclantech.com</div>';
            html += '</div>';
            return html;
        }

        function iframePrint(html, billNum) {
            html += '</body></html>';
            // Use a fresh iframe each time — Safari can hold stale state on a reused print frame
            var old = document.getElementById('pos-receipt-frame');
            if (old) { try { old.remove(); } catch(e) {} }
            var iframe = document.createElement('iframe');
            iframe.id = 'pos-receipt-frame';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
            document.body.appendChild(iframe);
            var iDoc = iframe.contentDocument || iframe.contentWindow.document;
            iDoc.open(); iDoc.write(html); iDoc.close();
            var bannerShown = false;
            function triggerBanner() { if (bannerShown) return; bannerShown = true; showBanner(billNum, 'iframe'); }
            try { iframe.contentWindow.onafterprint = triggerBanner; } catch(e) {}
            var printed = false;
            function doPrint() {
                if (printed) return; printed = true;
                try {
                    iframe.contentWindow.focus(); // Safari requires focusing the frame before print()
                    iframe.contentWindow.print();
                } catch(e) { try { window.print(); } catch(e2) {} }
            }
            // Parent-driven print works across Chrome + Safari (in-iframe window.print() is unreliable in Safari)
            iframe.onload = function() { setTimeout(doPrint, 90); };
            setTimeout(doPrint, 380); // fallback if onload doesn't fire after document.write
            setTimeout(triggerBanner, 6000);
        }

        function printReceipt(txId, billNum, taxOn, edited, preData) {
            if (!txId) return;
            var isTax = (taxOn === 'Y');
            function render(d) {
                if (!d || !d.success) return;
                var html = buildReceiptHtml(d, isTax, edited);
                if (qzReady || (typeof qz !== 'undefined' && !qzConnectFailed)) {
                    qzPrint(html + '</body></html>', billNum).catch(function(err) {
                        if (err === 'cancelled') return;
                        console.warn('QZ Tray print failed, falling back to browser print:', err);
                        iframePrint(html, billNum);
                    });
                } else {
                    iframePrint(html, billNum);
                }
            }
            // Live sale passes the receipt data straight from the payment response — no extra fetch.
            if (preData && preData.success) { render(preData); return; }
            fetch('Terminal/ajaxCart', {
                method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: new URLSearchParams({action:'receiptData', transactionId: txId, sessionId: SI, taxOn: TO, salesModeId: SM, moquiSessionToken: TK}),
                credentials: 'same-origin'
            }).then(function(r) { return r.json(); }).then(render).catch(function(e) { console.error('Receipt print error:', e); });
        }
        // Expose so the (top-level) bill-history module can reprint an edited bill
        // using the same QZ/iframe pipeline when a session is active.
        window._posPrintReceipt = printReceipt;

        /* --- Cart AJAX --- */
        function post(params) {
            if (busy) return Promise.resolve(null);
            busy = true;
            params.sessionId = SI; params.taxOn = TO; params.salesModeId = SM; params.moquiSessionToken = TK;
            return fetch('Terminal/ajaxCart', {
                method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: new URLSearchParams(params), credentials: 'same-origin'
            }).then(function(r) { return r.json(); }).finally(function() { busy = false; });
        }

        function payBtn(method, label, bg) {
            return '<form method="post" action="Terminal/payAndComplete" class="pos-pay-form" style="margin:0">'
                + '<input type="hidden" name="transactionId" value="'+TX+'"/>'
                + '<input type="hidden" name="sessionId" value="'+SI+'"/>'
                + '<input type="hidden" name="paymentMethod" value="'+method+'"/>'
                + '<input type="hidden" name="amount" value="0"/>'
                + '<input type="hidden" name="salesModeId" value="'+SM+'"/>'
                + '<input type="hidden" name="customerPhone" value=""/>'
                + '<input type="hidden" name="moquiSessionToken" value="'+TK+'"/>'
                + '<button type="submit" style="width:100%;padding:16px 8px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:'+bg+';color:#fff">'+label+'</button></form>';
        }
        function actionBtn(action, label, bg, conf) {
            return '<form method="post" action="Terminal/'+action+'" style="margin:0">'
                + '<input type="hidden" name="transactionId" value="'+TX+'"/>'
                + '<input type="hidden" name="sessionId" value="'+SI+'"/>'
                + '<input type="hidden" name="taxOn" value="'+TO+'"/>'
                + '<input type="hidden" name="salesModeId" value="'+SM+'"/>'
                + '<input type="hidden" name="moquiSessionToken" value="'+TK+'"/>'
                + '<button type="submit" style="width:100%;padding:14px 8px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:'+bg+';color:#fff"'
                + (conf ? ' onclick="return confirm(\''+conf+'\')"' : '') + '>'+label+'</button></form>';
        }
        function buildSummary(d) {
            extractHeldInfo(document); // keep held count/id in sync with the live header badge
            var modeLabel = SM ? (SM.charAt(0).toUpperCase() + SM.slice(1).toLowerCase()) : 'Retail';
            var sh = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
                + '<div style="font-size:13px;color:#777">Last: - / 0</div>'
                + '<div style="display:flex;gap:16px;font-size:14px">'
                + '<span style="color:#555">Qty: <b id="posSumQty">'+fmt(d.tQty)+'</b></span>'
                + '<span style="color:#555">Tax: <b id="posSumTax">'+fmt(d.tax)+'</b></span>'
                + '<span style="color:#555">Disc: <b id="posSumDisc">'+fmt(d.disc)+'</b></span>'
                + '</div></div>'
                + '<div style="background:#1976d2;color:#fff;padding:14px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
                + '<span style="font-size:16px;font-weight:600">'+modeLabel+' TOTAL</span>'
                + '<span id="posSumTotal" style="font-size:28px;font-weight:800;letter-spacing:1px">'+CS+fmt(d.pay)+'</span></div>';
            if (d.items.length > 0) {
                sh += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">'
                    + '<button type="button" class="pos-cash-btn" style="width:100%;padding:16px 8px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#4caf50;color:#fff">&#128176; CASH</button>'
                    + payBtn('Card','&#128179; CARD','#2196f3')
                    + payBtn('UPI','&#128241; UPI','#9c27b0') + '</div>'
                    + '<button type="button" class="pos-split-btn" style="display:block;width:100%;padding:14px 8px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#1565c0;color:#fff;border:none;text-align:center;margin-bottom:8px;box-sizing:border-box">&#8596; SPLIT PAYMENT</button>'
                    + '<button type="button" onclick="posCreditSale()" style="display:block;width:100%;padding:14px 8px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;background:#e65100;color:#fff;border:none;text-align:center;margin-bottom:8px;box-sizing:border-box">&#128196; CREDIT / PAY LATER</button>'
                    + '<div style="display:grid;grid-template-columns:'+(heldCount > 0 ? '1fr 1fr 1fr' : '1fr 1fr')+';gap:8px">'
                    + actionBtn('holdSale','HOLD','#ff9800')
                    + actionBtn('voidSale','VOID / CANCEL','#f44336','Void this sale?')
                    + (heldCount > 0 && heldId ? recallBtn() : '')
                    + '</div>';
            } else {
                sh += '<div style="text-align:center;padding:16px;color:#aaa;font-size:16px">Tap products to add items</div>';
                if (heldCount > 0 && heldId) sh += '<div style="margin-top:8px">' + recallBtn() + '</div>';
            }
            return sh;
        }

        function buildSplitPanel() {
            var modeLabel = SM ? (SM.charAt(0).toUpperCase() + SM.slice(1).toLowerCase()) : 'Retail';
            return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
                + '<div style="font-size:13px;color:#777">Last: - / 0</div>'
                + '<div style="display:flex;gap:16px;font-size:14px">'
                + '<span style="color:#555">Qty: <b>'+(lastCartData ? fmt(lastCartData.tQty) : '0')+'</b></span>'
                + '<span style="color:#555">Tax: <b>'+(lastCartData ? fmt(lastCartData.tax) : '0')+'</b></span>'
                + '<span style="color:#555">Disc: <b>'+(lastCartData ? fmt(lastCartData.disc) : '0')+'</b></span>'
                + '</div></div>'
                + '<div style="background:#1976d2;color:#fff;padding:14px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
                + '<span style="font-size:16px;font-weight:600">'+modeLabel+' TOTAL</span>'
                + '<span style="font-size:28px;font-weight:800;letter-spacing:1px">'+CS+fmt(lastPay)+'</span></div>'
                + '<div class="pos-split-panel" style="border:2px solid #1565c0;border-radius:10px;padding:14px;background:#e3f2fd">'
                + '<div style="text-align:center;font-size:17px;font-weight:700;color:#1565c0;margin-bottom:6px">SPLIT PAYMENT</div>'
                + '<div style="text-align:center;font-size:24px;font-weight:800;color:#333;margin-bottom:14px">Total: '+CS+fmt(lastPay)+'</div>'
                + '<form method="post" action="Terminal/splitPayAndComplete" class="pos-split-form" style="margin:0">'
                + '<input type="hidden" name="transactionId" value="'+TX+'"/>'
                + '<input type="hidden" name="sessionId" value="'+SI+'"/>'
                + '<input type="hidden" name="taxOn" value="'+TO+'"/>'
                + '<input type="hidden" name="salesModeId" value="'+SM+'"/>'
                + '<input type="hidden" name="customerPhone" value=""/>'
                + '<input type="hidden" name="moquiSessionToken" value="'+TK+'"/>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
                + '<span style="min-width:55px;font-size:14px;font-weight:700;color:#2e7d32;text-align:right">&#128176; Cash</span>'
                + '<input type="number" name="cashAmount" value="0" step="any" min="0" onfocus="this.select()" style="flex:1;padding:12px 10px;border:2px solid #4caf50;border-radius:8px;font-size:18px;text-align:right;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
                + '<span style="min-width:55px;font-size:14px;font-weight:700;color:#1565c0;text-align:right">&#128179; Card</span>'
                + '<input type="number" name="cardAmount" value="0" step="any" min="0" onfocus="this.select()" style="flex:1;padding:12px 10px;border:2px solid #2196f3;border-radius:8px;font-size:18px;text-align:right;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-left:65px">'
                + '<input type="text" name="cardRef" placeholder="Card reference #" style="flex:1;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
                + '<span style="min-width:55px;font-size:14px;font-weight:700;color:#7b1fa2;text-align:right">&#128241; UPI</span>'
                + '<input type="number" name="upiAmount" value="0" step="any" min="0" onfocus="this.select()" style="flex:1;padding:12px 10px;border:2px solid #9c27b0;border-radius:8px;font-size:18px;text-align:right;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-left:65px">'
                + '<input type="text" name="upiRef" placeholder="UPI reference #" style="flex:1;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<button type="submit" style="width:100%;padding:16px;background:#1565c0;color:#fff;border:none;border-radius:10px;font-size:17px;font-weight:700;cursor:pointer;margin-bottom:8px">&#10003; CONFIRM SPLIT</button>'
                + '</form>'
                + '<button type="button" class="pos-split-cancel" style="display:block;width:100%;text-align:center;padding:12px;background:#f5f5f5;border:none;border-radius:8px;color:#666;font-size:14px;font-weight:600;cursor:pointer">&#10006; CANCEL</button>'
                + '</div>';
        }

        function cashQuickBtns(total) {
            var seen = {}, amounts = [], steps = [1, 10, 50, 100, 500, 1000];
            amounts.push(total); seen[total] = true;
            for (var i = 0; i < steps.length; i++) {
                var r = Math.ceil(total / steps[i]) * steps[i];
                if (r > total && !seen[r]) { amounts.push(r); seen[r] = true; }
                if (amounts.length >= 5) break;
            }
            var h = '';
            for (var i = 0; i < amounts.length; i++) {
                h += '<button type="button" class="pos-cash-quick" data-amt="'+amounts[i]+'" style="padding:10px 16px;border:1px solid #4caf50;border-radius:8px;background:#fff;color:#2e7d32;font-size:15px;font-weight:700;cursor:pointer">'
                    + CS + fmt(amounts[i]) + '</button>';
            }
            return h;
        }

        function buildCashPanel() {
            var modeLabel = SM ? (SM.charAt(0).toUpperCase() + SM.slice(1).toLowerCase()) : 'Retail';
            return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
                + '<div style="font-size:13px;color:#777">Last: - / 0</div>'
                + '<div style="display:flex;gap:16px;font-size:14px">'
                + '<span style="color:#555">Qty: <b>'+(lastCartData ? fmt(lastCartData.tQty) : '0')+'</b></span>'
                + '<span style="color:#555">Tax: <b>'+(lastCartData ? fmt(lastCartData.tax) : '0')+'</b></span>'
                + '<span style="color:#555">Disc: <b>'+(lastCartData ? fmt(lastCartData.disc) : '0')+'</b></span>'
                + '</div></div>'
                + '<div style="background:#1976d2;color:#fff;padding:14px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
                + '<span style="font-size:16px;font-weight:600">'+modeLabel+' TOTAL</span>'
                + '<span style="font-size:28px;font-weight:800;letter-spacing:1px">'+CS+fmt(lastPay)+'</span></div>'
                + '<div class="pos-cash-panel" style="border:2px solid #4caf50;border-radius:10px;padding:14px;background:#e8f5e9">'
                + '<div style="text-align:center;font-size:17px;font-weight:700;color:#2e7d32;margin-bottom:6px">CASH PAYMENT</div>'
                + '<div style="text-align:center;font-size:24px;font-weight:800;color:#333;margin-bottom:14px">Bill: '+CS+fmt(lastPay)+'</div>'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
                + '<span style="min-width:80px;font-size:14px;font-weight:700;color:#2e7d32;text-align:right">Received</span>'
                + '<input type="number" class="pos-cash-input" value="" placeholder="Enter amount" step="any" min="0" onfocus="this.select()" autofocus style="flex:1;padding:14px 10px;border:2px solid #4caf50;border-radius:8px;font-size:22px;text-align:right;box-sizing:border-box;outline:none"/>'
                + '</div>'
                + '<div class="pos-cash-change" style="text-align:center;font-size:20px;font-weight:700;margin-bottom:12px;min-height:32px"></div>'
                + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;justify-content:center">'
                + cashQuickBtns(lastPay) + '</div>'
                + '<button type="button" class="pos-cash-confirm" disabled style="width:100%;padding:16px;background:#4caf50;color:#fff;border:none;border-radius:10px;font-size:17px;font-weight:700;cursor:pointer;margin-bottom:8px;opacity:0.5">&#128176; CONFIRM PAYMENT</button>'
                + '<button type="button" class="pos-cash-cancel" style="display:block;width:100%;text-align:center;padding:12px;background:#f5f5f5;border:none;border-radius:8px;color:#666;font-size:14px;font-weight:600;cursor:pointer">&#10006; CANCEL</button>'
                + '</div>';
        }

        function renderCart(d) {
            if (!d || !d.success) { if (d && d.error) alert(d.error); return; }
            TX = d.transactionId || '';
            document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
            var tb = document.querySelector('.pos-cart tbody');
            if (!tb) return;
            var h = '';
            if (d.items.length === 0) {
                h = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#aaa;font-size:16px">Tap products to add items</td></tr>';
            }
            d.items.forEach(function(it, idx) {
                h += '<tr style="border-bottom:1px solid #e0e0e0">';
                h += '<td style="padding:3px 10px;text-align:center;font-size:13px;font-weight:700;color:#777;vertical-align:middle;width:30px">'+(idx+1)+'</td>';
                var modeSel = '';
                if (d.modes && d.modes.length > 1) {
                    var mo = '';
                    d.modes.forEach(function(m){ mo += '<option value="'+m.id+'"'+(it.mode===m.id?' selected':'')+'>'+m.name+(Number(m.disc)>0?(' −'+Number(m.disc)+'%'):'')+'</option>'; });
                    modeSel = '<select class="aj-mode" data-seq="'+it.seq+'" title="Sale mode for this item" style="flex-shrink:0;font-size:11px;padding:3px 4px;border:1px solid #90caf9;border-radius:4px;color:#1565c0;font-weight:700;max-width:120px;background:#f5f8ff;cursor:pointer">'+mo+'</select>';
                }
                h += '<td style="padding:3px 10px"><div style="display:flex;align-items:center;gap:8px"><div style="font-size:14px;font-weight:600;color:#000;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+it.name+'</div>'+modeSel+'</div><div style="font-size:11px;color:#555">'+it.pid+'</div></td>';
                h += '<td style="padding:4px 4px;text-align:right;vertical-align:middle"><div style="display:flex;align-items:center;gap:3px;justify-content:flex-end">';
                h += '<input type="text" value="'+Number(it.price)+'" data-seq="'+it.seq+'" class="aj-p" style="width:65px;padding:8px 6px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:right;background:#fff;color:#000;box-sizing:border-box"/>';
                h += '<button data-seq="'+it.seq+'" class="aj-pb" style="width:32px;height:32px;border:none;background:#1565c0;color:#fff;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0">&#10003;</button>';
                h += '</div></td>';
                h += '<td style="padding:4px;text-align:center;vertical-align:middle"><div style="display:flex;align-items:center;justify-content:center;gap:0">';
                h += '<button data-seq="'+it.seq+'" data-q="'+(Number(it.qty)-1)+'" class="aj-q" style="width:34px;height:34px;border:2px solid #e53935;background:#fff;font-size:19px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;border-radius:8px 0 0 8px;color:#e53935">-</button>';
                h += '<input type="number" step="any" value="'+Number(it.qty)+'" data-seq="'+it.seq+'" class="aj-qi" style="width:58px;text-align:center;font-weight:bold;font-size:16px;border-top:2px solid #ccc;border-bottom:2px solid #ccc;border-left:none;border-right:none;height:34px;background:#fff;color:#000;outline:none;box-sizing:border-box"/>';
                h += '<button data-seq="'+it.seq+'" data-q="'+(Number(it.qty)+1)+'" class="aj-q" style="width:34px;height:34px;border:2px solid #2e7d32;background:#fff;font-size:19px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;border-radius:0 8px 8px 0;color:#2e7d32">+</button>';
                h += '</div>';
                if (it.uom) h += '<div style="font-size:11px;color:#e65100;font-weight:700;margin-top:2px">'+it.uom+'</div>';
                h += '</td>';
                h += '<td style="padding:3px 10px;text-align:right;font-size:15px;font-weight:700;color:#000;vertical-align:middle">'+fmt2(it.total)+'</td>';
                h += '<td style="padding:4px 6px;text-align:center;vertical-align:middle"><button data-seq="'+it.seq+'" class="aj-rm" style="width:32px;height:32px;border:none;background:#e53935;color:#fff;border-radius:6px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;padding:0" title="Remove item">&#10005;</button></td>';
                h += '</tr>';
            });
            var _cs = document.getElementById('cartScroll'); var _ps = _cs ? _cs.scrollTop : 0; var _pc = (lastCartData && lastCartData.items) ? lastCartData.items.length : 0;
            tb.innerHTML = h;
            if (_cs) { if (d.items.length > _pc) _cs.scrollTop = _cs.scrollHeight; else _cs.scrollTop = _ps; }
            var sm = document.querySelector('.pos-summary');
            if (sm) {
                extractHeldInfo(document);
                var _sig = (d.items.length > 0 ? '1' : '0') + ':' + heldCount + ':' + (heldId ? '1' : '0');
                var _q = sm.querySelector('#posSumQty');
                if (_q && sm.getAttribute('data-sig') === _sig) {
                    _q.innerHTML = fmt(d.tQty);
                    var _tx = sm.querySelector('#posSumTax'); if (_tx) _tx.innerHTML = fmt(d.tax);
                    var _dc = sm.querySelector('#posSumDisc'); if (_dc) _dc.innerHTML = fmt(d.disc);
                    var _tt = sm.querySelector('#posSumTotal'); if (_tt) _tt.innerHTML = CS + fmt(d.pay);
                } else {
                    sm.innerHTML = buildSummary(d);
                    sm.setAttribute('data-sig', _sig);
                }
            }
            document.querySelectorAll('.pos-pay-form input[name="amount"]').forEach(function(el) { el.value = d.pay; });
            document.querySelectorAll('.pos-pay-form input[name="transactionId"]').forEach(function(el) { el.value = TX; });
            var bn = document.querySelector('.pos-header [style*="background:#e65100"]') || document.querySelector('.pos-header [style*="background: rgb(230, 81, 0)"]');
            if (bn) bn.textContent = 'BILL- ' + (d.txnNum || '0');
            lastTxnNum = d.txnNum || '';
            lastPay = d.pay || 0;
            lastCartData = d;
        }

        /* ============================================================
           Optimistic cart engine — instant local echo + coalesced,
           never-dropped background sync. Makes the terminal feel offline:
           every tap updates the cart immediately, the server call happens
           in the background. The server still recomputes payableAmount from
           the DB line items and refuses to complete an underpaid bill
           (complete#PosTransaction), so optimistic numbers can NEVER change
           what is charged — they only hide the ~0.8s round-trip. Any per-op
           error falls back to a plain server-authoritative post()->renderCart().
           Money model (matches recalculate#TransactionTotals):
             grand = Σ(line.total) + taxK·Σ(line.tax);  pay = round(grand)
           taxK self-calibrates from each authoritative reply (=1 when the
           server keeps tax separate, 0 when line totals are tax-inclusive).
           ============================================================ */
        var OPT = (function () {
            var COALESCE = true;    // strict FIFO is provably order-safe; coalescing reorders absolute/relative ops
            var taxK = 1, tmp = 0;
            var q = [];               // pending server ops (FIFO; qty/price/add coalesced)
            var inflight = false;
            var tmpMeta = {};         // tmpSeq -> {pid, mode}  (lines not yet saved server-side)
            var realByTmp = {};       // tmpSeq -> real itemSeqId (filled when its add completes)
            var claimed = {};         // real itemSeqId -> true (already assigned to a temp line)

            function n(x) { return Number(x) || 0; }
            function isTmp(s) { return String(s).indexOf('t#') === 0; }
            function lc() { return lastCartData; }
            function bySeq(s) { var L = lc(); if (!L) return null; for (var i = 0; i < L.items.length; i++) if (String(L.items[i].seq) === String(s)) return L.items[i]; return null; }
            function byPid(pid, mode) { var L = lc(); if (!L) return null; for (var i = 0; i < L.items.length; i++) { var it = L.items[i]; if (String(it.pid) === String(pid) && String(it.mode || '') === String(mode || '')) return it; } return null; }

            function recompute() {
                var L = lc(); if (!L) return;
                var st = 0, sx = 0, tq = 0;
                L.items.forEach(function (it) { st += n(it.total); sx += n(it.tax); tq += n(it.qty); });
                L.sub = st; L.tax = sx; L.tQty = tq; L.grand = st + taxK * sx; L.pay = Math.round(L.grand);
            }
            function calibrate(d) {
                var st = 0, sx = 0; (d.items || []).forEach(function (it) { st += n(it.total); sx += n(it.tax); });
                var g = (d.grand != null) ? n(d.grand) : n(d.pay);
                if (sx > 0) { var k = (g - st) / sx; if (k > -0.05 && k < 2) taxK = k; }
            }
            function inputFocused() {
                var a = document.activeElement;
                return !!(a && a.classList && (a.classList.contains('aj-qi') || a.classList.contains('aj-p')));
            }
            // Resolve a just-completed addItem's temp line to the real itemSeqId it
            // created. Matching by product alone is AMBIGUOUS when the same product
            // was removed and re-added (the old, now-deleted seq still matches), so
            // we claim the response line for this product+mode whose seq we have not
            // already assigned to another temp line. Tying the mapping to THIS add's
            // completion (FIFO single-flight => its removeItem already ran) makes it
            // unambiguous.
            function mapAdd(op, d) {
                if (!op.ts || realByTmp[op.ts]) return;
                var meta = tmpMeta[op.ts]; if (!meta) return;
                for (var i = 0; i < d.items.length; i++) {
                    var s = d.items[i];
                    if (String(s.pid) === String(meta.pid) && String(s.mode || '') === String(meta.mode || '') && !claimed[s.seq]) {
                        realByTmp[op.ts] = s.seq; claimed[s.seq] = true; return;
                    }
                }
            }
            // Propagate every known temp->real seq to the live cart and queued ops.
            function applyRealSeqs() {
                var L = lc();
                if (L) L.items.forEach(function (it) { if (isTmp(it.seq) && realByTmp[it.seq]) it.seq = realByTmp[it.seq]; });
                q.forEach(function (op) { if (op.seq && isTmp(op.seq) && realByTmp[op.seq]) op.seq = realByTmp[op.seq]; });
            }

            function paramsFor(op) {
                var b = { action: op.action, transactionId: TX, sessionId: SI, taxOn: TO, salesModeId: SM, moquiSessionToken: TK };
                if (op.action === 'addItem') { b.productId = op.pid; b.unitPrice = op.price; b.addQty = op.addQty || 1; }
                else if (op.action === 'updateQty') { b.itemSeqId = op.seq; b.newQty = op.newQty; }
                else if (op.action === 'updatePrice') { b.itemSeqId = op.seq; b.newPrice = op.newPrice; }
                else if (op.action === 'removeItem') { b.itemSeqId = op.seq; }
                else if (op.action === 'setItemMode') { b.itemSeqId = op.seq; b.itemMode = op.mode; }
                else if (op.action === 'scanAdd') { b.cartSearch = op.code; }
                return b;
            }
            function drain() {
                if (inflight || !q.length) return;
                var op = q[0];
                if (op.needSeq) {
                    if (isTmp(op.seq) && realByTmp[op.seq]) op.seq = realByTmp[op.seq];
                    if (isTmp(op.seq)) return;   // its addItem is still in flight — retry after that reconciles
                }
                inflight = true;
                fetch('Terminal/ajaxCart', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramsFor(op)), credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        inflight = false; var done = q.shift();
                        if (d && d.success) {
                            if (d.transactionId) { TX = d.transactionId; document.querySelectorAll('input[name="transactionId"]').forEach(function (el) { el.value = TX; }); }
                            calibrate(d);
                            if (done.action === 'addItem') mapAdd(done, d);
                            applyRealSeqs();
                            if (q.length === 0 && !inputFocused()) renderCart(d);   // settle to authoritative
                        } else {
                            // server rejected this op (e.g. product has no price in the active sales
                            // mode): undo the purely-optimistic line so the cart can't drift from server.
                            if (done.action === 'addItem' && done.ts) {
                                var L0 = lc();
                                if (L0) { for (var ri = L0.items.length - 1; ri >= 0; ri--) { if (String(L0.items[ri].seq) === String(done.ts)) L0.items.splice(ri, 1); } delete tmpMeta[done.ts]; }
                                for (var rj = q.length - 1; rj >= 0; rj--) { if (q[rj].lineKey === done.lineKey) q.splice(rj, 1); }
                                recompute(); renderCart(lc());
                            }
                            if (d && d.error) { try { var _et = document.createElement('div'); _et.textContent = '⚠ ' + d.error; _et.style.cssText = 'position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:9999999;background:#c62828;color:#fff;padding:13px 24px;border-radius:10px;font-weight:700;box-shadow:0 6px 24px rgba(0,0,0,0.3);max-width:90vw;text-align:center'; document.body.appendChild(_et); setTimeout(function () { _et.remove(); }, 3500); } catch (e) {} }
                        }
                        drain();
                    })
                    .catch(function () { inflight = false; q.shift(); drain(); });
            }
            function mergeable(i) { return !(i === 0 && inflight); }
            // Coalesce ONLY with the most-recent pending op on the same line, and
            // only when it is the same action. addItem is a relative delta and
            // updateQty an absolute set, so merging across an intervening op of the
            // other type would reorder them (set-then-add must stay set-then-add).
            // Looking only at the line's latest queued op preserves that order while
            // still collapsing the common case of mashing one control.
            function lastIdxForLine(key) { for (var i = q.length - 1; i >= 0; i--) if (q[i].lineKey === key) return i; return -1; }
            function enqueue(op) {
                if (COALESCE) {
                    var i = lastIdxForLine(op.lineKey);
                    if (i >= 0 && mergeable(i) && q[i].action === op.action) {
                        if (op.action === 'addItem') { q[i].addQty = (q[i].addQty || 1) + (op.addQty || 1); drain(); return; }
                        if (op.action === 'updateQty' || op.action === 'updatePrice') { op.needSeq = q[i].needSeq; q[i] = op; drain(); return; }
                    }
                }
                q.push(op); drain();
            }

            function doAdd(pid, price, name, uom) {
                var L = lc();
                // First item of a fresh bill: no cart/transaction yet. Start a local cart
                // and render instantly; the addItem goes out with an empty transactionId,
                // the server CREATES the transaction and returns its id, and single-flight
                // FIFO makes every later op wait and adopt it.
                if (!L) { L = { success: true, transactionId: TX || '', items: [], disc: 0 }; lastCartData = L; }
                var ln = byPid(pid, SM || ''); var newTs = null;
                if (ln && n(ln.qty) > 0) { var f = (n(ln.qty) + 1) / n(ln.qty); ln.qty = n(ln.qty) + 1; ln.total = n(ln.total) * f; ln.tax = n(ln.tax) * f; }
                else { newTs = 't#' + (++tmp); tmpMeta[newTs] = { pid: pid, mode: SM || '' }; ln = { seq: newTs, pid: pid, name: name || pid, price: n(price), qty: 1, total: n(price), tax: 0, disc: 0, mode: SM || '', uom: uom || '' }; L.items.push(ln); }
                recompute(); renderCart(L);
                enqueue({ action: 'addItem', pid: pid, price: price, mode: SM || '', addQty: 1, ts: newTs, lineKey: pid + '|' + (SM || '') });
            }
            function doQty(seq, newQty) {
                newQty = Number(newQty);
                var ln = bySeq(seq); if (!ln) return;
                // A quantity edit must NEVER delete the line — a decimal/cleared/0 value that
                // resolved while typing would silently drop the item. Revert to the authoritative
                // cart instead; removal is only via the explicit × (remove) button.
                if (!(newQty > 0)) { renderCart(lc()); return; }
                var f = newQty / n(ln.qty); ln.qty = newQty; ln.total = n(ln.total) * f; ln.tax = n(ln.tax) * f;
                recompute(); renderCart(lc());
                enqueue({ action: 'updateQty', seq: ln.seq, newQty: newQty, needSeq: true, lineKey: ln.pid + '|' + (ln.mode || '') });
            }
            function doPrice(seq, newPrice) {
                newPrice = Number(newPrice);
                var ln = bySeq(seq); if (!ln) return;
                var f = n(ln.price) > 0 ? newPrice / n(ln.price) : 0;
                ln.price = newPrice;
                if (f > 0) { ln.total = n(ln.total) * f; ln.tax = n(ln.tax) * f; } else { ln.total = newPrice * n(ln.qty); ln.tax = 0; }
                recompute(); renderCart(lc());
                enqueue({ action: 'updatePrice', seq: ln.seq, newPrice: newPrice, needSeq: true, lineKey: ln.pid + '|' + (ln.mode || '') });
            }
            function doRemove(seq) {
                var L = lc(); if (!L) return;
                var ln = bySeq(seq); var key = ln ? (ln.pid + '|' + (ln.mode || '')) : ('rm#' + seq);
                L.items = L.items.filter(function (it) { return String(it.seq) !== String(seq); });
                recompute(); renderCart(L);
                enqueue({ action: 'removeItem', seq: seq, needSeq: true, lineKey: key });
            }
            function doMode(seq, mode) {
                // per-item sales-mode reprices server-side by discount rules -> no safe optimistic value
                var ln = bySeq(seq); var key = ln ? (ln.pid + '|' + (ln.mode || '')) : ('mode#' + seq);
                enqueue({ action: 'setItemMode', seq: seq, mode: mode, needSeq: true, lineKey: key });
            }
            var scanN = 0;
            function doScan(code) { enqueue({ action: 'scanAdd', code: code, lineKey: 'scan#' + (++scanN) }); }

            return {
                add: function (pid, price, name, uom) { try { doAdd(pid, price, name, uom); } catch (e) { post({ action: 'addItem', transactionId: TX, productId: pid, unitPrice: price, addQty: 1 }).then(renderCart); } },
                qty: function (seq, q2) { try { doQty(seq, q2); } catch (e) { post({ action: Number(q2) <= 0 ? 'removeItem' : 'updateQty', transactionId: TX, itemSeqId: seq, newQty: q2 }).then(renderCart); } },
                price: function (seq, p2) { try { doPrice(seq, p2); } catch (e) { post({ action: 'updatePrice', transactionId: TX, itemSeqId: seq, newPrice: p2 }).then(renderCart); } },
                remove: function (seq) { try { doRemove(seq); } catch (e) { post({ action: 'removeItem', transactionId: TX, itemSeqId: seq }).then(renderCart); } },
                mode: function (seq, m) { try { doMode(seq, m); } catch (e) { post({ action: 'setItemMode', transactionId: TX, itemSeqId: seq, itemMode: m }).then(renderCart); } },
                scan: function (code) { try { doScan(code); } catch (e) { post({ action: 'scanAdd', transactionId: TX, cartSearch: code }).then(function (d) { if (d && !d.success && d.error) alert(d.error); else renderCart(d); }); } },
                _drainPending: function () { return q.length + (inflight ? 1 : 0); }
            };
        })();

        window._posAjax = function(pid, price) {
            if (!navigator.onLine && window._posOffline) { window._posOffline.add(pid, price); return; }
            OPT.add(pid, price);
        };
        window._posScan = function(code) {
            if (!navigator.onLine && window._posOffline) { window._posOffline.scan(code); return; }
            OPT.scan(code);
        };

        /* --- Screen content fetcher (for grid/category/mode swaps) --- */
        function fetchScreen(params) {
            var base = window.location.pathname + '.qvt';
            var p = {sessionId: SI, taxOn: TO, salesModeId: SM};
            if (TX) p.transactionId = TX;
            if (CATID) p.catId = CATID;
            for (var k in params) { if (params[k] !== undefined && params[k] !== null && params[k] !== '') p[k] = params[k]; else delete p[k]; }
            var qs = Object.keys(p).filter(function(k) { return p[k] !== '' && p[k] !== undefined; }).map(function(k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
            return fetch(base + '?' + qs, {credentials: 'same-origin'})
                .then(function(r) { return r.text(); })
                .then(function(html) { return new DOMParser().parseFromString(html, 'text/html'); });
        }

        function swapGrid(doc) {
            var ng = doc.querySelector('.pos-product-grid');
            var grid = document.querySelector('.pos-product-grid');
            if (ng && grid) {
                grid.style.opacity = '0';
                grid.innerHTML = ng.innerHTML;
                grid.style.transition = 'opacity 0.15s ease-in';
                grid.style.opacity = '1';
                setTimeout(function() { grid.style.transition = ''; }, 200);
            }
        }

        /* --- Cart event delegation --- */
        var cart = document.querySelector('.pos-cart');
        if (cart) {
            cart.addEventListener('click', function(e) {
                var t = e.target;
                if (t.classList.contains('aj-q')) {
                    e.preventDefault(); e.stopPropagation();
                    var nq = Number(t.dataset.q);
                    if (!(nq > 0)) return;   // − stops at the floor; it never deletes (× removes)
                    t.style.opacity = '0.5';
                    OPT.qty(t.dataset.seq, nq);
                }
                if (t.classList.contains('aj-pb')) {
                    e.preventDefault(); e.stopPropagation();
                    var inp = t.previousElementSibling;
                    if (!inp) return;
                    t.style.opacity = '0.5';
                    OPT.price(t.dataset.seq, inp.value);
                }
                if (t.classList.contains('aj-rm')) {
                    e.preventDefault(); e.stopPropagation();
                    t.style.opacity = '0.5';
                    OPT.remove(t.dataset.seq);
                }
            });
            cart.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.target.classList.contains('aj-p')) { e.preventDefault(); var btn = e.target.nextElementSibling; if (btn) btn.click(); }
                if (e.key === 'Enter' && e.target.classList.contains('aj-qi')) { e.preventDefault(); e.target.blur(); }
            });
            // Typeable quantity (decimals for loose/weighed goods); price auto-recalculates server-side
            cart.addEventListener('change', function(e) {
                if (e.target.classList.contains('aj-qi')) {
                    var nq = Number(e.target.value);
                    // Empty/0/NaN (e.g. the box was cleared to retype a decimal) must not delete
                    // the line — revert to the last good qty. Any value > 0 (incl. decimals like
                    // 0.5) keeps the line and recomputes its amount (qty × rate).
                    if (!(nq > 0)) { renderCart(lastCartData); return; }
                    OPT.qty(e.target.dataset.seq, nq);
                }
                if (e.target.classList.contains('aj-mode')) {
                    OPT.mode(e.target.dataset.seq, e.target.value);
                }
            });
            cart.addEventListener('submit', function(e) {
                var form = e.target;
                if (!form || !form.action) return;
                if (form.action.indexOf('updateItemQty') !== -1) {
                    e.preventDefault();
                    var fd = new FormData(form); var nq = Number(fd.get('newQty'));
                    if (nq < 0) return;
                    OPT.qty(fd.get('itemSeqId'), nq);
                }
                if (form.action.indexOf('updateItemPrice') !== -1) {
                    e.preventDefault();
                    var fd2 = new FormData(form);
                    OPT.price(fd2.get('itemSeqId'), fd2.get('newPrice'));
                }
                if (form.action.indexOf('removeItem') !== -1) {
                    e.preventDefault();
                    var fd3 = new FormData(form);
                    OPT.remove(fd3.get('itemSeqId'));
                }
            }, true);
        }

        /* --- Product grid: intercept addItem --- */
        var gridRoot = document.querySelector('.pos-product-grid');
        if (gridRoot) gridRoot.addEventListener('submit', function(e) {
            var form = e.target.closest('form');
            if (!form || form.action.indexOf('addItem') === -1) return;
            e.preventDefault();
            var fd = new FormData(form);
            if (!navigator.onLine && window._posOffline) {
                window._posOffline.add(fd.get('productId'), fd.get('unitPrice'));
                var obtn = form.querySelector('button');
                if (obtn) { obtn.style.transform = 'scale(0.92)'; obtn.style.boxShadow = '0 0 0 3px #c62828'; setTimeout(function(){ obtn.style.transform=''; obtn.style.boxShadow=''; }, 250); }
                return;
            }
            OPT.add(fd.get('productId'), fd.get('unitPrice'), (function(){var b=form.querySelector('button div');return b?b.textContent:'';})());
            var btn = form.querySelector('button');
            if (btn) {
                btn.style.transform = 'scale(0.92)'; btn.style.boxShadow = '0 0 0 3px #4caf50';
                setTimeout(function() { btn.style.transform = ''; btn.style.boxShadow = ''; }, 250);
            }
        }, true);

        /* --- Product Grid Search: AJAX --- */
        var sf = document.querySelector('.pos-search-bar form');
        var gridSearchTimer;
        window._gridSearch = function(term) {
            var grid = document.querySelector('.pos-product-grid');
            if (grid) { grid.style.opacity = '0.4'; grid.style.pointerEvents = 'none'; }
            fetchScreen(term ? {searchTerm: term, catId: ''} : {catId: CATID || ''}).then(function(doc) {
                swapGrid(doc);
                var grid = document.querySelector('.pos-product-grid');
                if (grid) grid.style.pointerEvents = '';
            });
        };
        if (sf) {
            var si = sf.querySelector('input[name="searchTerm"]');
            if (si) {
                function doSearch() { window._gridSearch(si.value.trim()); }
                sf.addEventListener('submit', function(e) { e.preventDefault(); clearTimeout(gridSearchTimer); doSearch(); });
                si.addEventListener('input', function() {
                    clearTimeout(gridSearchTimer);
                    gridSearchTimer = setTimeout(doSearch, 600);
                    if (si.dataset.syncing) return;
                    var cartInput = document.getElementById('cartInlineSearch');
                    if (cartInput && cartInput.value !== si.value) {
                        cartInput.dataset.syncing = '1';
                        cartInput.value = si.value;
                        cartInput.dispatchEvent(new Event('input', {bubbles: true}));
                        setTimeout(function() { delete cartInput.dataset.syncing; }, 50);
                    }
                });
            }
        }

        /* --- Category strip: AJAX --- */
        document.querySelectorAll('.pos-cat-strip a').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var linkUrl = new URL(this.href);
                var newCatId = linkUrl.searchParams.get('catId') || '';
                CATID = newCatId;
                document.querySelectorAll('.pos-cat-strip a').forEach(function(a) { a.style.background = '#455a64'; });
                this.style.background = '#1565c0';
                var grid = document.querySelector('.pos-product-grid');
                if (grid) { grid.style.opacity = '0.4'; grid.style.pointerEvents = 'none'; }
                var searchInput = document.querySelector('.pos-search-bar input[name="searchTerm"]');
                if (searchInput) searchInput.value = '';
                fetchScreen({catId: newCatId, searchTerm: ''}).then(function(doc) {
                    swapGrid(doc);
                    var grid = document.querySelector('.pos-product-grid');
                    if (grid) grid.style.pointerEvents = '';
                });
            });
        });

        /* --- Sales mode switching: AJAX --- */
        document.querySelectorAll('.pos-header a[href*="changeSalesMode"]').forEach(function(link) {
            var u = new URL(link.href);
            var mid = u.searchParams.get('salesModeId') || '';
            var isActive = link.style.borderColor === '#fff' || link.style.borderColor === 'rgb(255, 255, 255)';
            if (isActive) link.dataset.color = link.style.background || '#2e7d32';
        });
        document.querySelectorAll('.pos-header a[href*="changeSalesMode"]').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var linkUrl = new URL(this.href);
                var newSM = linkUrl.searchParams.get('salesModeId') || '';
                SM = newSM;
                af.querySelector('[name=salesModeId]').value = SM;
                var clicked = this;
                document.querySelectorAll('.pos-header a[href*="changeSalesMode"]').forEach(function(a) {
                    a.style.background = 'rgba(255,255,255,0.15)'; a.style.borderColor = 'rgba(255,255,255,0.3)';
                });
                fetchScreen({salesModeId: newSM}).then(function(doc) {
                    swapGrid(doc);
                    var newLinks = doc.querySelectorAll('.pos-header a[href*="changeSalesMode"]');
                    newLinks.forEach(function(nl) {
                        var nid = new URL(nl.href).searchParams.get('salesModeId') || '';
                        if (nid === newSM) {
                            clicked.style.background = nl.style.background || '#2e7d32';
                            clicked.style.borderColor = '#fff';
                            clicked.dataset.color = nl.style.background || '#2e7d32';
                        }
                    });
                    if (TX) {
                        post({action:'refresh', transactionId: TX}).then(function(d) {
                            if (d) renderCart(d);
                        });
                    } else {
                        var ns = doc.querySelector('.pos-summary');
                        if (ns) { var os = document.querySelector('.pos-summary'); if (os) os.innerHTML = ns.innerHTML; }
                        appendRecallIfNeeded();
                    }
                });
            });
        });

        /* --- Tax toggle: AJAX --- */
        var taxForm = document.querySelector('.pos-header form[action*="toggleTax"]');
        if (taxForm) taxForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var newTax = (TO === 'Y') ? 'N' : 'Y';
            var btn = taxForm.querySelector('button');
            if (btn) {
                btn.style.background = (newTax === 'Y') ? '#4caf50' : '#f44336';
                btn.textContent = 'TAX: ' + (newTax === 'Y' ? 'ON' : 'OFF');
            }
            var hi = taxForm.querySelector('input[name="taxOn"]');
            if (hi) hi.value = (newTax === 'Y') ? 'N' : 'Y';
            TO = newTax;
            if (TX) {
                var fd = new FormData(taxForm);
                fd.set('transactionId', TX);
                fd.set('sessionId', SI);
                fd.set('taxOn', newTax);
                fd.set('salesModeId', SM);
                fd.set('moquiSessionToken', TK);
                fetch(taxForm.action, {method: 'POST', body: new URLSearchParams(fd), credentials: 'same-origin'})
                    .then(function() {
                        return post({action:'refresh', transactionId: TX});
                    }).then(function(d) {
                        if (d) renderCart(d);
                    });
            }
        });

        /* --- Close Session: AJAX dialog --- */
        var closeForm = document.querySelector('.pos-header form[action*="closeSession"]');
        if (closeForm) {
            closeForm.removeAttribute('onsubmit');
            closeForm.addEventListener('submit', function(e) {
                e.preventDefault();
                if (document.querySelector('.pos-close-overlay')) return;
                fetch('Terminal/ajaxCart', {
                    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: new URLSearchParams({action:'sessionSummary', sessionId: SI, taxOn: TO, salesModeId: SM, moquiSessionToken: TK}),
                    credentials: 'same-origin'
                }).then(function(r) { return r.json(); }).then(function(d) {
                    if (!d || !d.success) { alert(d ? d.error : 'Failed to load session summary'); return; }
                    var ov = document.createElement('div');
                    ov.className = 'pos-close-overlay';
                    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center';
                    var row = function(label, val, color) {
                        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee">'
                            + '<span style="color:#555;font-size:15px">'+label+'</span>'
                            + '<span style="font-weight:700;font-size:15px;color:'+(color||'#333')+'">'+CS+fmt2(val)+'</span></div>';
                    };
                    var html = '<div style="background:#fff;border-radius:16px;padding:28px 32px;width:420px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,0.3)">'
                        + '<div style="text-align:center;font-size:22px;font-weight:800;color:#1a237e;margin-bottom:4px">Close Session</div>'
                        + '<div style="text-align:center;font-size:13px;color:#888;margin-bottom:18px">Session #'+SI+'</div>'
                        + '<div style="background:#f5f5f5;border-radius:10px;padding:14px 16px;margin-bottom:16px">'
                        + '<div style="font-size:13px;font-weight:700;color:#777;text-transform:uppercase;margin-bottom:8px">Session Summary</div>'
                        + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee">'
                        + '<span style="color:#555;font-size:15px">Bills Completed</span>'
                        + '<span style="font-weight:700;font-size:15px;color:#1565c0">'+d.billCount+'</span></div>'
                        + row('Total Sales', d.totalSales, '#2e7d32')
                        + '</div>'
                        + '<div style="background:#f5f5f5;border-radius:10px;padding:14px 16px;margin-bottom:16px">'
                        + '<div style="font-size:13px;font-weight:700;color:#777;text-transform:uppercase;margin-bottom:8px">Cash Breakdown</div>'
                        + row('Opening Cash', d.openingCash)
                        + row('Cash Received', d.cashReceived, '#2e7d32')
                        + row('Change Given', d.changeGiven, '#e65100')
                        + '<div style="display:flex;justify-content:space-between;padding:10px 0 4px;border-top:2px solid #1a237e;margin-top:6px">'
                        + '<span style="font-weight:800;font-size:17px;color:#1a237e">Expected Cash</span>'
                        + '<span style="font-weight:800;font-size:17px;color:#1a237e">'+CS+fmt2(d.expectedCash)+'</span></div>'
                        + '</div>'
                        + (d.cardReceived > 0 || d.upiReceived > 0 ? '<div style="background:#f5f5f5;border-radius:10px;padding:14px 16px;margin-bottom:16px">'
                            + '<div style="font-size:13px;font-weight:700;color:#777;text-transform:uppercase;margin-bottom:8px">Other Payments</div>'
                            + (d.cardReceived > 0 ? row('Card', d.cardReceived, '#1565c0') : '')
                            + (d.upiReceived > 0 ? row('UPI', d.upiReceived, '#7b1fa2') : '')
                            + '</div>' : '')
                        + '<div style="margin-bottom:16px">'
                        + '<label style="font-size:14px;font-weight:700;color:#333;display:block;margin-bottom:6px">Enter Closing Cash Amount</label>'
                        + '<input type="number" class="pos-close-cash" step="any" min="0" value="'+Math.round(d.expectedCash)+'" style="width:100%;padding:14px 16px;border:2px solid #1a237e;border-radius:10px;font-size:22px;font-weight:700;text-align:right;box-sizing:border-box;outline:none;color:#1a237e" onfocus="this.select()"/>'
                        + '<div class="pos-close-diff" style="text-align:right;margin-top:6px;font-size:14px;font-weight:600"></div>'
                        + '</div>'
                        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
                        + '<button type="button" class="pos-close-cancel" style="padding:14px;border:2px solid #999;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#fff;color:#666">Cancel</button>'
                        + '<button type="button" class="pos-close-confirm" style="padding:14px;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;background:#c62828;color:#fff">&#9724; CLOSE SESSION</button>'
                        + '</div></div>';
                    ov.innerHTML = html;
                    document.body.appendChild(ov);
                    var inp = ov.querySelector('.pos-close-cash');
                    var diffEl = ov.querySelector('.pos-close-diff');
                    var expected = d.expectedCash;
                    function updateDiff() {
                        var v = parseFloat(inp.value) || 0;
                        var diff = v - expected;
                        if (Math.abs(diff) < 0.01) {
                            diffEl.textContent = '✓ Exact match';
                            diffEl.style.color = '#2e7d32';
                        } else if (diff > 0) {
                            diffEl.textContent = 'Excess: +' + CS + fmt2(diff);
                            diffEl.style.color = '#e65100';
                        } else {
                            diffEl.textContent = 'Short: ' + CS + fmt2(diff);
                            diffEl.style.color = '#c62828';
                        }
                    }
                    updateDiff();
                    inp.addEventListener('input', updateDiff);
                    ov.querySelector('.pos-close-cancel').addEventListener('click', function() { ov.remove(); });
                    ov.addEventListener('click', function(ev) { if (ev.target === ov) ov.remove(); });
                    ov.querySelector('.pos-close-confirm').addEventListener('click', function() {
                        var closingCash = parseFloat(inp.value) || 0;
                        var fd = new FormData(closeForm);
                        fd.set('closingCash', closingCash);
                        fd.set('moquiSessionToken', TK);
                        this.disabled = true;
                        this.textContent = 'Closing...';
                        fetch(closeForm.action, {method:'POST', body: new URLSearchParams(fd), credentials:'same-origin'})
                            .then(function() {
                                ov.remove();
                                showToast('Session closed successfully');
                                setTimeout(function() { window.location.href = '/qapps/zenith/pos/Dashboard'; }, 1500);
                            });
                    });
                    inp.focus();
                });
            });
        }

        /* --- Replace server-rendered <a> tags with buttons so SPA router can't intercept --- */
        var smRoot = document.querySelector('.pos-summary');
        if (smRoot) {
            var _splitLink = smRoot.querySelector('a[href*="showSplitPay"]');
            if (_splitLink) {
                var _sb = document.createElement('button');
                _sb.type = 'button'; _sb.className = 'pos-split-btn';
                _sb.style.cssText = _splitLink.style.cssText + 'border:none;';
                _sb.innerHTML = _splitLink.innerHTML;
                _splitLink.replaceWith(_sb);
            }
            var _cancelLink = smRoot.querySelector('a[href*="cancelSplitPay"]');
            if (_cancelLink) {
                var _cb = document.createElement('button');
                _cb.type = 'button'; _cb.className = 'pos-split-cancel';
                _cb.style.cssText = _cancelLink.style.cssText + 'border:none;cursor:pointer;';
                _cb.innerHTML = _cancelLink.innerHTML;
                _cancelLink.replaceWith(_cb);
            }
        }

        /* --- Init: extract held info from server-rendered page --- */
        extractHeldInfo(document);

        // Refresh the server-rendered held-bills picker (#pos-held-wrap <details>) from a full
        // terminal render, so HOLD/RECALL/VOID keep the badge correct with no page reload.
        function syncHeldWrap(doc) {
            try { var s = doc.querySelector('#pos-held-wrap'); var d = document.getElementById('pos-held-wrap'); if (s && d) d.innerHTML = s.innerHTML; } catch (e) {}
        }
        function reconcileTerminal(doc) {
            var ntk = doc.querySelector('input[name="moquiSessionToken"]'); if (ntk && ntk.value) TK = ntk.value;
            swapGrid(doc);
            var nb = doc.querySelector('.pos-cart tbody'); var ct = document.querySelector('.pos-cart tbody'); if (nb && ct) ct.innerHTML = nb.innerHTML;
            var ns = doc.querySelector('.pos-summary'); var sd = document.querySelector('.pos-summary'); if (ns && sd) sd.innerHTML = ns.innerHTML;
            syncHeldWrap(doc);
        }

        /* --- Hold / Void / Recall: delegated on DOCUMENT so the header held-picker forms are
               caught too (they live outside .pos-summary). HOLD/VOID clear the cart optimistically
               (instant), then the single holdSale/voidSale response — itself a full terminal
               render (url=".") with the updated HELD badge — reconciles the authoritative state.
               No second round-trip, and the badge can't go stale. --- */
        document.addEventListener('submit', function(e) {
            var form = e.target.closest ? e.target.closest('form') : null;
            if (!form) return;
            var act = form.getAttribute('action') || '';
            if (act.indexOf('holdSale') !== -1 || act.indexOf('voidSale') !== -1 || act.indexOf('recallSale') !== -1) {
                e.preventDefault();
                var isHold = act.indexOf('holdSale') !== -1;
                var isRecall = act.indexOf('recallSale') !== -1;
                var fd = new FormData(form);
                fd.set('transactionId', TX); fd.set('sessionId', SI); fd.set('taxOn', TO);
                fd.set('salesModeId', SM); fd.set('moquiSessionToken', TK);
                if (isRecall) {
                    showToast('Recalling held sale…', '#e65100');
                } else {
                    // OPTIMISTIC: empty the cart instantly so HOLD/VOID feel snappy.
                    renderCart({ success: true, transactionId: '', items: [], sub: 0, tax: 0, disc: 0, tQty: 0, grand: 0, pay: 0 });
                    TX = ''; lastCartData = null; lastPay = 0;
                    showToast(isHold ? 'Sale held — tap RECALL to restore' : 'Sale voided', isHold ? '#ff9800' : '#e53935');
                }
                fetch(form.action, { method: 'POST', body: new URLSearchParams(fd), credentials: 'same-origin' })
                    .then(function(r) { var u = r.url || ''; return r.text().then(function(html) { return { html: html, url: u }; }); })
                    .then(function(resp) {
                        var doc = new DOMParser().parseFromString(resp.html, 'text/html');
                        var ntx = doc.querySelector('input[name="transactionId"]');
                        var newTx = ntx ? (ntx.value || '') : '';
                        if (!newTx && resp.url) { var m = resp.url.match(/transactionId=(\d+)/); if (m) newTx = m[1]; }
                        TX = newTx;
                        document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
                        if (isRecall) {
                            // Show the recalled cart immediately (server HTML), then load the JSON
                            // model so optimistic edits work on the recalled lines.
                            reconcileTerminal(doc);
                            post({ action: 'refresh', transactionId: TX }).then(function(d) { renderCart(d); showToast('✔ Held sale recalled', '#e65100'); });
                        } else {
                            // HOLD/VOID: keep the optimistic empty cart (total ₹0). The response's
                            // cart/summary reflect the just-held bill, not the fresh empty cart, so only
                            // adopt the new token + refresh the held badge — never swap cart/summary.
                            var ntk = doc.querySelector('input[name="moquiSessionToken"]'); if (ntk && ntk.value) TK = ntk.value;
                            syncHeldWrap(doc);
                            var bn = document.querySelector('.pos-header [style*="background:#e65100"]') || document.querySelector('.pos-header [style*="background: rgb(230, 81, 0)"]');
                            if (bn) bn.textContent = 'BILL- 0';
                        }
                    })
                    .catch(function() { try { location.reload(); } catch (e) {} });
            }
            if (act.indexOf('payAndComplete') !== -1 && act.indexOf('splitPayAndComplete') === -1) {
                e.preventDefault();
                var fd = new FormData(form);
                fd.set('transactionId', TX); fd.set('sessionId', SI);
                fd.set('salesModeId', SM); fd.set('moquiSessionToken', TK);
                fd.set('wantJson', '1'); // get the print-receipt data back in the same response
                var method = fd.get('paymentMethod') || 'Cash';
                var paidAmt = fd.get('amount') || '0';
                var billNum = lastTxnNum || '';
                var savedTx = TX;
                var btn = form.querySelector('button');
                if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
                fetch(form.action, {method: 'POST', body: new URLSearchParams(fd), credentials: 'same-origin'})
                    .then(function(r) { return r.json().catch(function() { return {success:false, error:'Payment failed'}; }); })
                    .then(function(d) {
                        if (!d || !d.success) throw new Error((d && d.error) || 'Payment failed');
                        showToast('✔ Sale Complete — BILL-' + billNum + ' — ' + CS + fmt(paidAmt) + ' ' + method.toUpperCase());
                        printReceipt(savedTx, billNum, TO, false, d.receiptUnavailable ? null : d);
                        TX = '';
                        lastTxnNum = '';
                        return fetchScreen({});
                    })
                    .then(function(doc) {
                        if (!doc) return;
                        extractHeldInfo(doc);
                        updateHeldBadge();
                        var ntx = doc.querySelector('input[name="transactionId"]');
                        TX = ntx ? (ntx.value || '') : '';
                        document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
                        var ntk = doc.querySelector('input[name="moquiSessionToken"]');
                        if (ntk && ntk.value) TK = ntk.value;
                        swapGrid(doc);
                        var nb = doc.querySelector('.pos-cart tbody');
                        if (nb) document.querySelector('.pos-cart tbody').innerHTML = nb.innerHTML;
                        var ns = doc.querySelector('.pos-summary');
                        if (ns) document.querySelector('.pos-summary').innerHTML = ns.innerHTML;
                        appendRecallIfNeeded();
                        var bn = document.querySelector('.pos-header [style*="background:#e65100"]') || document.querySelector('.pos-header [style*="background: rgb(230, 81, 0)"]');
                        if (bn) bn.textContent = 'BILL- 0';
                    })
                    .catch(function(err) {
                        alert('Payment error: ' + err.message);
                        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
                    });
            }
            if (act.indexOf('splitPayAndComplete') !== -1) {
                e.preventDefault();
                var fd = new FormData(form);
                fd.set('transactionId', TX); fd.set('sessionId', SI);
                fd.set('salesModeId', SM); fd.set('moquiSessionToken', TK);
                fd.set('wantJson', '1'); // get the print-receipt data back in the same response
                var cAmt = Number(fd.get('cashAmount') || 0);
                var dAmt = Number(fd.get('cardAmount') || 0);
                var uAmt = Number(fd.get('upiAmount') || 0);
                var splitTotal = cAmt + dAmt + uAmt;
                if (splitTotal < lastPay) {
                    alert('Split total (' + CS + fmt(splitTotal) + ') is less than the payable amount (' + CS + fmt(lastPay) + '). Please adjust.');
                    return;
                }
                var splitParts = [];
                if (cAmt > 0) splitParts.push(CS + fmt(cAmt) + ' Cash');
                if (dAmt > 0) splitParts.push(CS + fmt(dAmt) + ' Card');
                if (uAmt > 0) splitParts.push(CS + fmt(uAmt) + ' UPI');
                var billNum = lastTxnNum || '';
                var savedTx = TX;
                var btn = form.querySelector('button[type="submit"]');
                if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Processing...'; }
                fetch(form.action, {method: 'POST', body: new URLSearchParams(fd), credentials: 'same-origin'})
                    .then(function(r) { return r.json().catch(function() { return {success:false, error:'Split payment failed'}; }); })
                    .then(function(d) {
                        if (!d || !d.success) throw new Error((d && d.error) || 'Split payment failed');
                        showToast('✔ Sale Complete — BILL-' + billNum + ' — ' + splitParts.join(' + '));
                        printReceipt(savedTx, billNum, TO, false, d.receiptUnavailable ? null : d);
                        TX = '';
                        lastTxnNum = '';
                        lastPay = 0;
                        lastCartData = null;
                        return fetchScreen({});
                    })
                    .then(function(doc) {
                        if (!doc) return;
                        extractHeldInfo(doc);
                        updateHeldBadge();
                        var ntx = doc.querySelector('input[name="transactionId"]');
                        TX = ntx ? (ntx.value || '') : '';
                        document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
                        var ntk = doc.querySelector('input[name="moquiSessionToken"]');
                        if (ntk && ntk.value) TK = ntk.value;
                        swapGrid(doc);
                        var nb = doc.querySelector('.pos-cart tbody');
                        if (nb) document.querySelector('.pos-cart tbody').innerHTML = nb.innerHTML;
                        var ns = doc.querySelector('.pos-summary');
                        if (ns) document.querySelector('.pos-summary').innerHTML = ns.innerHTML;
                        appendRecallIfNeeded();
                        var bn = document.querySelector('.pos-header [style*="background:#e65100"]') || document.querySelector('.pos-header [style*="background: rgb(230, 81, 0)"]');
                        if (bn) bn.textContent = 'BILL- 0';
                    })
                    .catch(function(err) {
                        alert('Split payment error: ' + err.message);
                        if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '✓ CONFIRM SPLIT'; }
                    });
            }
        }, true);

        /* --- Split Payment / Cancel: click delegation on .pos-summary --- */
        if (smRoot) smRoot.addEventListener('click', function(e) {
            var link = e.target.closest('a');
            if (e.target.closest('.pos-split-btn') || (link && link.href && link.href.indexOf('showSplitPay') !== -1)) {
                e.preventDefault();
                e.stopPropagation();
                if (!lastCartData) {
                    var rows = document.querySelectorAll('.pos-cart tbody tr');
                    lastCartData = {items: Array.from(rows).filter(function(r) { return !r.textContent.includes('Tap products'); }),
                        tQty: 0, tax: 0, disc: 0, pay: 0, grand: 0, sub: 0, round: 0, cnt: 0, transactionId: TX, txnNum: lastTxnNum};
                    var totalEl = smRoot.querySelector('[style*="font-size:28px"], [style*="font-size: 28px"]');
                    if (totalEl) { var m = totalEl.textContent.replace(/[^\d.]/g, ''); lastPay = Number(m) || 0; lastCartData.pay = lastPay; }
                }
                smRoot.innerHTML = buildSplitPanel();
            }
            if (e.target.closest('.pos-split-cancel') || (link && link.href && link.href.indexOf('cancelSplitPay') !== -1)) {
                e.preventDefault();
                e.stopPropagation();
                if (lastCartData) {
                    smRoot.innerHTML = buildSummary(lastCartData);
                } else {
                    fetchScreen({}).then(function(doc) {
                        var ns = doc.querySelector('.pos-summary');
                        if (ns) smRoot.innerHTML = ns.innerHTML;
                    });
                }
            }
            /* --- Cash payment panel --- */
            if (e.target.closest('.pos-cash-btn')) {
                e.preventDefault();
                e.stopPropagation();
                if (!lastCartData) {
                    var rows = document.querySelectorAll('.pos-cart tbody tr');
                    lastCartData = {items: Array.from(rows).filter(function(r) { return !r.textContent.includes('Tap products'); }),
                        tQty: 0, tax: 0, disc: 0, pay: 0, grand: 0, sub: 0, round: 0, cnt: 0, transactionId: TX, txnNum: lastTxnNum};
                    var totalEl = smRoot.querySelector('[style*="font-size:28px"], [style*="font-size: 28px"]');
                    if (totalEl) { var m = totalEl.textContent.replace(/[^\d.]/g, ''); lastPay = Number(m) || 0; lastCartData.pay = lastPay; }
                }
                smRoot.innerHTML = buildCashPanel();
                var ci = smRoot.querySelector('.pos-cash-input');
                if (ci) ci.focus();
            }
            if (e.target.closest('.pos-cash-cancel')) {
                e.preventDefault();
                e.stopPropagation();
                if (lastCartData) smRoot.innerHTML = buildSummary(lastCartData);
            }
            if (e.target.closest('.pos-cash-quick')) {
                var amt = e.target.closest('.pos-cash-quick').dataset.amt;
                var ci = smRoot.querySelector('.pos-cash-input');
                if (ci) { ci.value = amt; ci.dispatchEvent(new Event('input', {bubbles: true})); }
            }
            if (e.target.closest('.pos-cash-confirm')) {
                var ci = smRoot.querySelector('.pos-cash-input');
                var received = Number(ci ? ci.value : 0);
                if (received < lastPay) return;
                var change = received - lastPay;
                var billNum = lastTxnNum || '';
                var savedTx = TX;
                var btn = e.target.closest('.pos-cash-confirm');
                btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Processing...';
                var params = new URLSearchParams();
                params.set('transactionId', TX); params.set('sessionId', SI);
                params.set('paymentMethod', 'Cash'); params.set('amount', String(lastPay));
                params.set('salesModeId', SM); params.set('customerPhone', '');
                params.set('moquiSessionToken', TK);
                params.set('wantJson', '1'); // get the print-receipt data back in the same response
                fetch('Terminal/payAndComplete', {method: 'POST', body: params, credentials: 'same-origin'})
                    .then(function(r) { return r.json().catch(function() { return {success:false, error:'Payment failed'}; }); })
                    .then(function(d) {
                        if (!d || !d.success) throw new Error((d && d.error) || 'Payment failed');
                        var toastMsg = '✔ Sale Complete — BILL-' + billNum + ' — ' + CS + fmt(lastPay) + ' CASH';
                        if (change > 0) toastMsg += ' (Change: ' + CS + fmt(change) + ')';
                        showToast(toastMsg);
                        printReceipt(savedTx, billNum, TO, false, d.receiptUnavailable ? null : d);
                        TX = ''; lastTxnNum = ''; lastPay = 0; lastCartData = null;
                        return fetchScreen({});
                    })
                    .then(function(doc) {
                        if (!doc) return;
                        extractHeldInfo(doc);
                        updateHeldBadge();
                        var ntx = doc.querySelector('input[name="transactionId"]');
                        TX = ntx ? (ntx.value || '') : '';
                        document.querySelectorAll('input[name="transactionId"]').forEach(function(el) { el.value = TX; });
                        var ntk = doc.querySelector('input[name="moquiSessionToken"]');
                        if (ntk && ntk.value) TK = ntk.value;
                        swapGrid(doc);
                        var nb = doc.querySelector('.pos-cart tbody');
                        if (nb) document.querySelector('.pos-cart tbody').innerHTML = nb.innerHTML;
                        var ns = doc.querySelector('.pos-summary');
                        if (ns) document.querySelector('.pos-summary').innerHTML = ns.innerHTML;
                        appendRecallIfNeeded();
                        var bn = document.querySelector('.pos-header [style*="background:#e65100"]') || document.querySelector('.pos-header [style*="background: rgb(230, 81, 0)"]');
                        if (bn) bn.textContent = 'BILL- 0';
                    })
                    .catch(function(err) {
                        alert('Payment error: ' + err.message);
                        if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '💰 CONFIRM PAYMENT'; }
                    });
            }
        });

        /* --- Cash input: live change calculation --- */
        if (smRoot) smRoot.addEventListener('input', function(e) {
            if (!e.target.classList.contains('pos-cash-input')) return;
            var received = Number(e.target.value) || 0;
            var changeDiv = smRoot.querySelector('.pos-cash-change');
            var confirmBtn = smRoot.querySelector('.pos-cash-confirm');
            if (!changeDiv || !confirmBtn) return;
            var diff = received - lastPay;
            if (e.target.value === '' || received === 0) {
                changeDiv.innerHTML = '';
                confirmBtn.disabled = true; confirmBtn.style.opacity = '0.5';
            } else if (diff < 0) {
                changeDiv.innerHTML = '<span style="color:#e53935;font-size:20px">⚠ Short: ' + CS + fmt(Math.abs(diff)) + ' more needed</span>';
                confirmBtn.disabled = true; confirmBtn.style.opacity = '0.5';
            } else if (diff === 0) {
                changeDiv.innerHTML = '<span style="color:#2e7d32;font-size:22px">✔ Exact Amount</span>';
                confirmBtn.disabled = false; confirmBtn.style.opacity = '1';
            } else {
                changeDiv.innerHTML = '<span style="color:#1565c0;font-size:26px;letter-spacing:0.5px">Change: ' + CS + fmt(diff) + '</span>';
                confirmBtn.disabled = false; confirmBtn.style.opacity = '1';
            }
        });
    }
    init();
})();

/* === Cart Inline Search === */
(function() {
    function initCartSearch() {
        var si = document.getElementById('cartInlineSearch');
        var dd = document.getElementById('cartSearchDropdown');
        if (!si || !dd) { setTimeout(initCartSearch, 300); return; }
        var dt, aidx = -1;
        function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
        si.addEventListener('input', function() {
            var t = this.value.trim(); clearTimeout(dt); aidx = -1;
            if (!si.dataset.syncing) {
                var gridInput = document.querySelector('.pos-search-bar input[name="searchTerm"]');
                if (gridInput && gridInput.value !== si.value) {
                    gridInput.dataset.syncing = '1';
                    gridInput.value = si.value;
                    setTimeout(function() { delete gridInput.dataset.syncing; }, 50);
                    if (window._gridSearch) {
                        clearTimeout(window._gridSyncTimer);
                        window._gridSyncTimer = setTimeout(function() { window._gridSearch(si.value.trim()); }, 600);
                    }
                }
            }
            if (t.length < 1) { dd.style.display = 'none'; return; }
            dt = setTimeout(function() {
                var tk = (document.querySelector('#cartInlineAddForm [name=moquiSessionToken]') || {}).value || '';
                fetch('Terminal/lookupProducts', {
                    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: 'term=' + encodeURIComponent(t) + '&moquiSessionToken=' + encodeURIComponent(tk), credentials: 'same-origin'
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (!data || data.length === 0) {
                        dd.innerHTML = '<div style="padding:10px;color:#999;font-size:13px;text-align:center">No products found</div>';
                        dd.style.display = 'block'; return;
                    }
                    var h = '';
                    for (var i = 0; i < data.length; i++) {
                        var p = data[i];
                        h += '<div class="cart-dd-item" data-pid="' + esc(p.productId) + '" data-price="' + p.mrpAmount + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;font-size:14px;background:#fff">';
                        h += '<span class="dd-price" style="float:right;color:#e53935;font-weight:bold;font-size:14px">' + esc('' + p.mrpAmount) + '</span>';
                        h += '<span class="dd-name" style="font-weight:600;color:#000;font-size:14px">' + esc(p.productName || '') + '</span>';
                        h += '<div class="dd-code" style="font-size:12px;color:#555;margin-top:2px">' + esc(p.pseudoId || '') + '</div></div>';
                    }
                    dd.innerHTML = h; dd.style.display = 'block'; aidx = -1;
                });
            }, 250);
        });
        si.addEventListener('keydown', function(e) {
            var items = dd.querySelectorAll('.cart-dd-item');
            if (e.key === 'ArrowDown') { e.preventDefault(); aidx = Math.min(aidx + 1, items.length - 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); aidx = Math.max(aidx - 1, 0); }
            else if (e.key === 'Enter') {
                e.preventDefault(); var v = si.value.trim(); if (!v) return;
                if (items.length > 0) {
                    var el = (aidx >= 0 && items[aidx]) ? items[aidx] : items[0];
                    if (window._posAjax) { window._posAjax(el.dataset.pid, el.dataset.price); dd.style.display = 'none'; si.value = ''; si.focus();
                        var gi = document.querySelector('.pos-search-bar input[name="searchTerm"]');
                        if (gi) { gi.value = ''; } if (window._gridSearch) window._gridSearch('');
                        return; }
                }
                dd.style.display = 'none'; si.value = '';
                var gi2 = document.querySelector('.pos-search-bar input[name="searchTerm"]');
                if (gi2) gi2.value = '';
                if (window._gridSearch) window._gridSearch('');
            }
            else if (e.key === 'Escape') { dd.style.display = 'none'; }
            for (var i = 0; i < items.length; i++) items[i].style.background = (i === aidx) ? '#e8f5e9' : '#fff';
        });
        dd.addEventListener('click', function(e) {
            var item = e.target.closest('.cart-dd-item');
            if (!item) return;
            if (window._posAjax) {
                window._posAjax(item.dataset.pid, item.dataset.price);
                dd.style.display = 'none'; si.value = ''; si.focus();
                var gi = document.querySelector('.pos-search-bar input[name="searchTerm"]');
                if (gi) gi.value = '';
                if (window._gridSearch) window._gridSearch('');
                return;
            }
        });
        document.addEventListener('click', function(e) { if (!si.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none'; });
    }
    initCartSearch();
})();

/* === Horizontal Resize Splitter (robust: document delegation, survives SPA re-renders) === */
(function() {
    var dragging = false, startX = 0, startLeftW = 0, totalW = 0;
    var layout, left, cart, splitter;
    function panels() {
        layout = document.querySelector('.pos-main-layout');
        left = document.querySelector('.pos-left-panel');
        cart = document.querySelector('.pos-cart');
        splitter = document.querySelector('.pos-splitter');
        return !!(layout && left && cart && splitter);
    }
    function applySaved() {
        if (!panels()) return;
        var saved = localStorage.getItem('posSplitRatio');
        if (saved) {
            var r = parseFloat(saved);
            if (r > 0.2 && r < 0.85) {
                left.style.flex = 'none';
                left.style.width = (r * 100) + '%';
                cart.style.width = ((1 - r) * 100 - 1) + '%';
            }
        }
    }
    function onStart(x) {
        if (!panels()) return;
        dragging = true; startX = x;
        startLeftW = left.offsetWidth;
        totalW = layout.offsetWidth - splitter.offsetWidth;
        splitter.style.background = '#7986cb';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }
    function onMove(x) {
        if (!dragging) return;
        var dx = x - startX;
        var newLeft = Math.max(250, Math.min(startLeftW + dx, totalW - 300));
        left.style.flex = 'none';
        left.style.width = newLeft + 'px';
        cart.style.width = (totalW - newLeft) + 'px';
    }
    function onEnd() {
        if (!dragging) return;
        dragging = false;
        if (splitter) splitter.style.background = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (layout && left && splitter) {
            var ratio = left.offsetWidth / (layout.offsetWidth - splitter.offsetWidth);
            try { localStorage.setItem('posSplitRatio', ratio.toFixed(4)); } catch (e) {}
        }
    }
    function inSplitter(t) { return t && t.closest ? t.closest('.pos-splitter') : null; }
    document.addEventListener('mousedown', function(e) { if (inSplitter(e.target)) { e.preventDefault(); onStart(e.clientX); } });
    document.addEventListener('mousemove', function(e) { if (dragging) { e.preventDefault(); onMove(e.clientX); } });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchstart', function(e) { if (inSplitter(e.target)) { e.preventDefault(); onStart(e.touches[0].clientX); } }, {passive: false});
    document.addEventListener('touchmove', function(e) { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX); } }, {passive: false});
    document.addEventListener('touchend', onEnd);
    document.addEventListener('dblclick', function(e) {
        if (inSplitter(e.target) && panels()) {
            left.style.flex = '1'; left.style.width = '';
            cart.style.width = '55%';
            try { localStorage.removeItem('posSplitRatio'); } catch (e2) {}
        }
    });
    applySaved();
    setTimeout(applySaved, 250);
})();

console.log('[posterm] script END reached');
