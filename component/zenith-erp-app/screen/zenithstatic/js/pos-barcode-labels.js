/* Barcode Labels screen logic. Loaded as an EXTERNAL script (via an <img onload> that appends it),
   because the /qapps SPA strips inline <script> bodies from screen content. Being an external file,
   bare '<' in comparisons/loops is fine here (raw-JS fetch, no markup parsing).
   Label DRAWING lives server-side in the barcode-module renderLabels transition (template-aware, any
   format + QR); this screen collects the product selection + copies + template and delegates to it in
   an iframe. Also owns the copies stepper, select-all, client-side sort, and pagination. */
(function(){
    var RENDER = '/apps/zenith/barcode/renderLabels';
    var state = { page: 1, perPage: 20, sort: 'name-asc' };

    // ---------- label preview / print (unchanged contract) ----------
    function picked(){ return Array.prototype.slice.call(document.querySelectorAll('.bl-pick:checked')); }
    function token(){ var e=document.getElementById('bl-token'); return e ? (e.getAttribute('data-t')||'') : ''; }
    function opts(){
        var copies=Math.max(1,Math.min(200,parseInt((document.getElementById('bl-copies')||{}).value||'1',10)||1));
        var tsel=document.getElementById('bl-template');
        if(tsel && tsel.value){ return { copies:copies, labelId:tsel.value }; }
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
        else { p+='&w='+o.w+'&h='+o.h+'&showName=Y&showSku=N&showPrice='+(o.price?'Y':'N'); }
        return RENDER+'?'+p;
    }
    function frame(){ return document.getElementById('bl-frame'); }
    function show(){ var a=document.getElementById('bl-preview-area'); if(a) a.style.display='block'; }
    function loading(on){
        var l=document.getElementById('bl-loading'); if(l) l.style.display=on?'block':'none';
        var f=frame(); if(f) f.style.display=on?'none':'block';
    }
    function doPreview(){
        var url=buildUrl(); if(!url){ alert('Tick at least one product first.'); return; }
        var f=frame(); if(!f) return;
        show(); loading(true);
        f.onload=function(){ loading(false); };
        f.src=url;
        var a=document.getElementById('bl-preview-area'); if(a) a.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    function doPrint(){
        var url=buildUrl(); if(!url){ alert('Tick at least one product first.'); return; }
        var f=frame(); if(!f) return;
        show(); loading(true);
        f.onload=function(){ loading(false); setTimeout(function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} }, 500); };
        f.src=url;
    }

    // ---------- select-all / sort / pagination ----------
    function rows(){ return Array.prototype.slice.call(document.querySelectorAll('#bl-tbody .bl-row')); }
    function syncSelectAll(){
        var sa=document.getElementById('bl-selectall'); if(!sa) return;
        var all=document.querySelectorAll('.bl-pick'), chk=document.querySelectorAll('.bl-pick:checked');
        sa.checked = (all.length>0 && chk.length===all.length);
    }
    function pageList(cur, tp){
        var out=[], i;
        if(tp<=7){ for(i=1;i<=tp;i++) out.push(i); return out; }
        out.push(1);
        var lo=Math.max(2,cur-1), hi=Math.min(tp-1,cur+1);
        if(cur<=3){ lo=2; hi=5; }
        if(cur>=tp-2){ lo=tp-4; hi=tp-1; }
        if(lo>2) out.push('...');
        for(i=lo;i<=hi;i++) out.push(i);
        if(hi<tp-1) out.push('...');
        out.push(tp);
        return out;
    }
    function paginate(){
        var rs=rows(); var total=rs.length; var pp=state.perPage;
        var tp=Math.max(1,Math.ceil(total/pp)); if(state.page>tp) state.page=tp;
        var start=(state.page-1)*pp, end=Math.min(total,start+pp);
        rs.forEach(function(tr,i){ tr.style.display=(i>=start&&i<end)?'':'none'; });
        var sh=document.getElementById('bl-showing');
        if(sh) sh.innerHTML = total===0 ? 'No products' :
            ('Showing '+(start+1)+' &ndash; '+end+' of <b style="color:#111827">'+total+'</b> products');
        var pager=document.getElementById('bl-pager'); if(!pager) return;
        pager.innerHTML='';
        function btn(html,dis,act,go){
            var b=document.createElement('button'); b.innerHTML=html;
            b.style.cssText='min-width:32px;height:32px;padding:0 8px;border-radius:8px;font-size:12.5px;cursor:pointer;'
                +(act?'background:#7C3AED;color:#fff;border:1px solid #7C3AED;':'background:#fff;color:#6B7280;border:1px solid #E5E7EB;')
                +(dis?'opacity:.4;cursor:default;':'');
            if(!dis&&!act&&go!=null) b.addEventListener('click',function(){ state.page=go; paginate(); });
            return b;
        }
        pager.appendChild(btn('<span class="material-icons" style="font-size:16px;vertical-align:middle">chevron_left</span>', state.page<=1, false, state.page-1));
        pageList(state.page,tp).forEach(function(p){
            if(p==='...'){ var s=document.createElement('span'); s.textContent='…'; s.style.cssText='color:#9CA3AF;padding:0 4px'; pager.appendChild(s); }
            else pager.appendChild(btn(String(p),false,p===state.page,p));
        });
        pager.appendChild(btn('<span class="material-icons" style="font-size:16px;vertical-align:middle">chevron_right</span>', state.page>=tp, false, state.page+1));
    }
    function applySort(){
        var tb=document.getElementById('bl-tbody'); if(!tb) return;
        var rs=rows(); var s=state.sort;
        rs.sort(function(a,b){
            if(s.indexOf('price')===0){
                var pa=parseFloat(a.getAttribute('data-sortprice')||'0')||0, pb=parseFloat(b.getAttribute('data-sortprice')||'0')||0;
                return s==='price-asc' ? pa-pb : pb-pa;
            }
            var na=a.getAttribute('data-sortname')||'', nb=b.getAttribute('data-sortname')||'';
            var c = na<nb ? -1 : (na>nb ? 1 : 0);
            return s==='name-desc' ? -c : c;
        });
        rs.forEach(function(tr){ tb.appendChild(tr); });
    }
    function init(){
        var tb=document.getElementById('bl-tbody'); if(!tb) return;
        var ps=document.getElementById('bl-perpage'); if(ps) state.perPage=parseInt(ps.value,10)||20;
        var ss=document.getElementById('bl-sort'); if(ss) state.sort=ss.value||'name-asc';
        state.page=1;
        applySort(); paginate(); syncSelectAll();
    }

    // ---------- document-level delegation (bind once; survives dynamic mounts) ----------
    if(!window.__blDelegated){
        window.__blDelegated=1;
        document.addEventListener('click', function(ev){
            var t=ev.target && ev.target.closest ? ev.target.closest('button') : null;
            if(t){
                if(t.id==='bl-preview'){ doPreview(); return; }
                if(t.id==='bl-print'){ doPrint(); return; }
                if(t.id==='bl-none'){ document.querySelectorAll('.bl-pick').forEach(function(c){c.checked=false;}); syncSelectAll(); return; }
                if(t.id==='bl-copies-dec' || t.id==='bl-copies-inc'){
                    var ci=document.getElementById('bl-copies');
                    if(ci){ var v=parseInt(ci.value,10)||1; v += (t.id==='bl-copies-inc'?1:-1); ci.value=Math.max(1,Math.min(200,v)); }
                    return;
                }
            }
            if(ev.target && ev.target.classList && ev.target.classList.contains('bl-pick')) syncSelectAll();
        });
        document.addEventListener('change', function(ev){
            var t=ev.target; if(!t) return;
            if(t.id==='bl-template'){ var custom=!t.value;
                var sw=document.getElementById('bl-size-wrap'); if(sw) sw.style.display=custom?'':'none';
                var pw=document.getElementById('bl-price-wrap'); if(pw) pw.style.display=custom?'flex':'none'; return; }
            if(t.id==='bl-selectall'){ var on=t.checked; document.querySelectorAll('.bl-pick').forEach(function(c){c.checked=on;}); return; }
            if(t.id==='bl-sort'){ state.sort=t.value; state.page=1; applySort(); paginate(); return; }
            if(t.id==='bl-perpage'){ state.perPage=parseInt(t.value,10)||20; state.page=1; paginate(); return; }
        });
    }

    window.__blInit = init;
    init();
    window.blPreview=doPreview; window.blPrint=doPrint; window.blBuildUrl=buildUrl;
})();
