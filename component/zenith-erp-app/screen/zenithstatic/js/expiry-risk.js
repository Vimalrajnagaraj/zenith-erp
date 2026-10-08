/* Scoped native-control enhancements for both Bootstrap and Quasar expiry reports. */
(function () {
  'use strict';
  var scheduled = false;
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function enhance(root) {
    root.querySelectorAll('.er-kebab-menu a').forEach(function (link) {if(location.pathname.startsWith('/qapps/') && link.pathname.startsWith('/apps/')) link.href=link.href.replace('/apps/','/qapps/');});
    root.querySelectorAll('button,a.btn').forEach(function (button) {
      var label=button.querySelector('.block'), title=(label ? label.textContent : button.textContent).trim().replace(/^\s*[^A-Za-z]+/,'');
      var icons={'Alert Settings':'notifications_none','Add Expiring Stock':'add','Save View':'bookmark_border','Manage Views':'settings','Columns':'grid_view','Edit':'edit'};
      if(!icons[title]) return;
      if(!button.classList.contains('er-button')) button.classList.add('er-button');
      if(title==='Add Expiring Stock'||title==='Edit') button.classList.add('er-primary');
      if(title==='Alert Settings') button.classList.add('er-outline');
      if(title==='Edit') button.classList.add('er-edit');
      var icon=button.querySelector('.material-icons');if(icon && icon.textContent!==icons[title])icon.textContent=icons[title];
    });
    if (!root.__expiryBound) {
      root.__expiryBound = true;
      root.addEventListener('submit', function (e) {
        if (!e.target.matches('.er-filter-form')) return;
        e.preventDefault();
        var url=new URL(location.pathname,location.origin);
        new FormData(e.target).forEach(function(value,key){url.searchParams.set(key,value);});
        location.assign(url.href);
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('.er-refresh')) location.reload();
        if (e.target.closest('.er-clear')) { root.querySelectorAll('.er-select').forEach(function (c) { c.checked = false; }); selection(root); }
        if (e.target.closest('.er-export-selected')) {
          var csv = Array.from(root.querySelectorAll('a')).find(function (a) { return a.href.includes('/exportCsv?'); });
          if (!csv) return;
          var url = new URL(csv.href), ids = Array.from(root.querySelectorAll('.er-select:checked')).map(function (c) { return c.value; });
          if (!ids.length) return;
          url.searchParams.set('selIds', ids.join(',')); location.assign(url.href);
        }
      });
      root.addEventListener('change', function (e) {
        if (e.target.matches('.er-page-size')) { var url = new URL(location.href); url.searchParams.set('pageSize', e.target.value); url.searchParams.set('pageIndex','0'); location.assign(url.href); }
        if (e.target.matches('.er-select-all')) root.querySelectorAll('.er-select').forEach(function (c) { c.checked = e.target.checked; });
        if (e.target.matches('.er-select,.er-select-all')) selection(root);
      });
    }
    var table = root.querySelector('#ExpiringAssetsForm_table');
    if (!table || table.__expiryEnhanced) return;
    table.__expiryEnhanced = true;
    var headers = table.querySelectorAll('thead tr,.thead>.tr'), rows = table.querySelectorAll('tbody>tr:not(.form-list-nav-row),.tbody>.tr');
    headers.forEach(function (row) {
      if (row.querySelectorAll('th,.th').length < 10) return;
      var target=row.querySelector(':scope>form')||row;
      var cell = node(row.tagName === 'TR' ? 'th' : 'div','th er-selection'), cb = node('input','er-select-all'); cb.type='checkbox'; cb.setAttribute('aria-label','Select all visible lots'); cell.appendChild(cb); target.prepend(cell);
      markColumns(target.querySelectorAll(':scope>th,:scope>.th'));
    });
    rows.forEach(function (row) {
      var cells = row.querySelectorAll(':scope>td,:scope>.td'); if (cells.length < 10) return;
      var id = cells[0].textContent.trim(), cell = node(row.tagName === 'TR' ? 'td' : 'div','td er-selection'), cb = node('input','er-select'); cb.type='checkbox'; cb.value=id; cb.setAttribute('aria-label','Select lot '+id); cell.appendChild(cb); row.prepend(cell);
      var edit = cells[10].querySelector('button,a');
      if (edit && !cells[0].querySelector('a,button')) { var link = node('button','er-asset-link',id); link.type='button'; link.setAttribute('aria-label','Open lot '+id); link.addEventListener('click',function () {edit.click();}); cells[0].replaceChildren(link); }
      markColumns(row.querySelectorAll(':scope>td,:scope>.td'));
    });
    var parent=table.parentNode;
    if (!parent.classList.contains('er-table-scroll')) { var scroll=node('div','er-table-scroll'); scroll.setAttribute('role','region'); scroll.setAttribute('aria-label','Expiry stock table'); scroll.tabIndex=0; parent.insertBefore(scroll,table); scroll.appendChild(table); }
    if (!rows.length && !root.querySelector('.er-empty')) table.parentNode.after(node('p','er-empty','No lots match these filters. Reset the filters or add expiry-tracked stock.'));
    selection(root);
  }
  function markColumns(cells) {var columns=['selection','asset','product','sku','batch','supplier','expiry','days','quantity','value','status','action','menu'];cells.forEach(function(cell,index){cell.dataset.erColumn=columns[index];});}
  function selection(root) {
    var boxes=Array.from(root.querySelectorAll('.er-select')), count=boxes.filter(function (c) {return c.checked;}).length;
    var all=root.querySelector('.er-select-all'); if(all) {all.checked=boxes.length>0 && count===boxes.length;all.indeterminate=count>0 && count<boxes.length;}
    var status=root.querySelector('.er-selected'), exportButton=root.querySelector('.er-export-selected'); if(status) status.textContent=count ? count+' selected' : ''; if(exportButton) exportButton.hidden=!count;
  }
  function scan() { scheduled=false; var root=document.getElementById('expiryRisk'); if(root) enhance(root); }
  function schedule() { if(!scheduled) { scheduled=true;requestAnimationFrame(scan); } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule); else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
