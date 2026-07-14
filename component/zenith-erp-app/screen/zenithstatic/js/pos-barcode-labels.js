/* Barcode Labels screen logic. Loaded as an EXTERNAL script because the /qapps SPA
   strips inline <script> bodies from screen content (external src scripts still run).
   Self-contained Code 128-B encoder -> SVG; any scanner reads it. */
(function(){
    if (window.__blInit) return; window.__blInit = 1;

    // Code 128 pattern table (107 entries: 0-102 symbols, 103-105 starts, 106 stop).
    var P=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

    function barcodeSVG(text, module, height){
        module = module || 1.5; height = height || 40; var quiet = 10 * module;
        var data = []; for (var i=0;i<text.length;i++){ var v=text.charCodeAt(i)-32; if(v<0||v>94) v=0; data.push(v); }
        var sum = 104; for (var i=0;i<data.length;i++) sum += data[i]*(i+1);
        var seq = [104].concat(data).concat([sum%103, 106]);
        var x = quiet, rects = '';
        for (var s=0;s<seq.length;s++){ var pat=P[seq[s]]; for (var j=0;j<pat.length;j++){ var w=parseInt(pat[j],10)*module; if(j%2===0){ rects+='<rect x="'+x.toFixed(2)+'" y="0" width="'+w.toFixed(2)+'" height="'+height+'"/>'; } x+=w; } }
        var total = x + quiet;
        return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 '+total.toFixed(1)+' '+height+'" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"><rect width="'+total.toFixed(1)+'" height="'+height+'" fill="#fff"/><g fill="#000">'+rects+'</g></svg>';
    }
    function esc(s){ return (s||'').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function picked(){ return Array.prototype.slice.call(document.querySelectorAll('.bl-pick:checked')); }
    // A selected Label template drives size + Show/Hide (Name/Price/SKU); "Custom size" (no template)
    // keeps the manual size dropdown + Show-price checkbox and shows name/sku, as before.
    function opts(){
        var copies=Math.max(1,Math.min(200,parseInt(document.getElementById('bl-copies').value||'1',10)||1));
        var tsel=document.getElementById('bl-template');
        var topt=(tsel && tsel.value)? tsel.options[tsel.selectedIndex] : null;
        if(topt){ return { w:parseFloat(topt.getAttribute('data-w'))||50, h:parseFloat(topt.getAttribute('data-h'))||30, copies:copies,
            showName:topt.getAttribute('data-showname')!=='N', price:topt.getAttribute('data-showprice')!=='N', showSku:topt.getAttribute('data-showsku')==='Y' }; }
        var sz=(document.getElementById('bl-size').value||'50,25').split(',');
        return { w:parseFloat(sz[0]), h:parseFloat(sz[1]), copies:copies,
            showName:true, price:document.getElementById('bl-showprice').checked, showSku:true };
    }
    function labelHtml(name, code, price, o){
        var mod = o.w>=65?1.7:(o.w>=50?1.4:1.1);
        var bh = Math.round(o.h*1.4);
        return '<div class="bl-label" style="width:'+o.w+'mm;height:'+o.h+'mm;box-sizing:border-box;border:1px solid #eee;padding:1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;page-break-inside:avoid">'
            + (o.showName?'<div style="font-size:2.6mm;font-weight:600;line-height:1.1;text-align:center;max-height:3mm;overflow:hidden;width:100%">'+esc(name)+'</div>':'')
            + '<div style="width:100%;flex:1;display:flex;align-items:center;min-height:0">'+barcodeSVG(code,mod,bh)+'</div>'
            + (o.showSku?'<div style="font-size:2.4mm;letter-spacing:0.3mm">'+esc(code)+'</div>':'')
            + (o.price&&price?'<div style="font-size:2.8mm;font-weight:800">₹'+esc(price)+'</div>':'')
            + '</div>';
    }
    function build(){
        var o=opts(), items=picked(), html='', n=0;
        items.forEach(function(cb){ for(var i=0;i<o.copies;i++){ html+=labelHtml(cb.getAttribute('data-name'),cb.getAttribute('data-code'),cb.getAttribute('data-price'),o); n++; } });
        return { html:html, n:n, items:items.length };
    }
    function doPreview(){
        var b=build(); if(!b.items){ alert('Tick at least one product first.'); return; }
        document.getElementById('bl-sheet').innerHTML = b.html;
        document.getElementById('bl-count').textContent = b.n;
        document.getElementById('bl-preview-area').style.display = 'block';
        document.getElementById('bl-preview-area').scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    function doPrint(){
        var b=build(); if(!b.items){ alert('Tick at least one product first.'); return; }
        var doc='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode Labels</title>'
            + '<style>@page{margin:5mm}body{margin:0;font-family:Arial,sans-serif}#s{display:flex;flex-wrap:wrap;gap:2mm}.bl-label{border:1px solid #eee !important}</style></head>'
            + '<body><div id="s">'+b.html+'</div>'
            + '<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},250);};</scr'+'ipt></body></html>';
        var ifr=document.getElementById('bl-print-frame');
        if(ifr) ifr.parentNode.removeChild(ifr);
        ifr=document.createElement('iframe'); ifr.id='bl-print-frame';
        ifr.style.position='fixed'; ifr.style.right='0'; ifr.style.bottom='0'; ifr.style.width='0'; ifr.style.height='0'; ifr.style.border='0';
        document.body.appendChild(ifr);
        var d=ifr.contentWindow.document; d.open(); d.write(doc); d.close();
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
    // expose for inline onclick fallback / debugging
    window.blPreview = doPreview; window.blPrint = doPrint; window.blBarcodeSVG = barcodeSVG;
})();
