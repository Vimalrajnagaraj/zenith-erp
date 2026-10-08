/* Tax content only. Native POST forms retain Moqui CSRF, redirects and validation messages. */
(function () {
  function init() {
    var meta = document.querySelector('.zc-tax-meta');
    if (!meta) return;
    var screen = meta.dataset.screen;
    var prefix = screen.indexOf('Edit') === 0 ? 'tx' : (screen.indexOf('Registration') >= 0 ? 'nr' : 'te');
    var shell = location.pathname.split('/zenith/')[0];
    var base = shell + '/zenith/tax/' + screen;
    document.querySelectorAll('[data-tax-open]').forEach(function (button) {
      if (button.dataset.modalReady) return;
      button.dataset.modalReady = 'true';
      var overlay = document.getElementById(button.dataset.taxOpen);
      if (!overlay) return;
      function close() { overlay.style.display = 'none'; button.focus(); }
      button.addEventListener('click', function () {
        overlay.style.display = 'flex';
        var first = overlay.querySelector('select,input:not([type=hidden]),textarea,button');
        if (first) first.focus();
      });
      overlay.querySelector('[data-tax-close]').addEventListener('click', close);
      overlay.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        var controls = Array.from(overlay.querySelectorAll('button,input:not([type=hidden]),select,textarea,[tabindex="0"]'))
          .filter(function (control) { return !control.disabled && control.getClientRects().length; });
        var first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    });
    document.querySelectorAll('.zc-tax-page a[href^="/apps/zenith/tax/"]').forEach(function (link) {
      link.setAttribute('href', shell + link.getAttribute('href').slice('/apps'.length));
    });
    document.querySelectorAll('.zc-tax-form').forEach(function (form) {
      form.action = base + '/' + form.getAttribute('action').split('/').pop();
      if (form.dataset.ready) return;
      form.dataset.ready = 'true';
      form.addEventListener('submit', function (event) {
        if (form.dataset.submitting) { event.preventDefault(); return; }
        var party = form.elements.partyId, product = form.elements.productId;
        if (product && !product.value && !party.value) {
          event.preventDefault(); party.setCustomValidity('Select a Party or a Product.'); party.reportValidity(); return;
        }
        if (party) party.setCustomValidity('');
        form.dataset.submitting = 'true';
        form.querySelectorAll('button[type=submit]').forEach(function (button) { button.disabled = true; });
      });
      form.addEventListener('input', function () { if (form.elements.partyId) form.elements.partyId.setCustomValidity(''); });
    });
    var country = document.getElementById(prefix + '-country');
    var region = document.getElementById(prefix + '-region');
    if (country && region && !country.dataset.ready) {
      country.dataset.ready = 'true';
      var request = 0;
      country.addEventListener('change', function () {
        var current = ++request;
        region.replaceChildren(new Option('Select region', '')); region.disabled = true;
        if (!country.value) { region.disabled = false; return; }
        fetch(base + '/getRegionsForCountry?countryGeoId=' + encodeURIComponent(country.value), { credentials: 'same-origin' })
          .then(function (response) { if (!response.ok) throw Error('Region lookup failed'); return response.json(); })
          .then(function (data) {
            if (current !== request || !region.isConnected) return;
            (Array.isArray(data) ? data : (data.resultList || [])).forEach(function (item) {
              region.add(new Option(item.label || item.geoName || item.geoId, item.geoId || item.value));
            });
            region.disabled = false;
          }).catch(function () {
            if (current !== request || !region.isConnected) return;
            region.replaceChildren(new Option('Regions unavailable — change Country to retry', ''));
            region.disabled = false;
          });
      });
    }
    document.querySelectorAll('.nr-clear,.te-clear,.tx-clear').forEach(function (clear) {
      var select = document.getElementById(clear.dataset.for);
      if (!select || clear.dataset.ready) return;
      clear.dataset.ready = 'true';
      var label = document.querySelector('label[for="' + select.id + '"]');
      clear.setAttribute('aria-label', 'Clear ' + (label ? label.textContent.replace('*', '').trim() : 'selection'));
      function update() { clear.style.display = select.value ? 'flex' : 'none'; }
      select.addEventListener('change', update); update();
      clear.addEventListener('click', function () {
        select.value = ''; select.dispatchEvent(new Event('change', { bubbles: true }));
        select.focus();
      });
    });
    var search = document.getElementById('te-search');
    if (search && !search.dataset.ready) {
      search.dataset.ready='true';
      var status=document.getElementById('te-status'), perPage=document.getElementById('te-perpage'), page=1;
      var previous=document.getElementById('te-prev'), next=document.getElementById('te-next');
      function paginate() {
        var query=search.value.trim().toLowerCase(), rows=Array.from(document.querySelectorAll('tr.te-trow'));
        var matches=rows.filter(function (row) {return row.textContent.toLowerCase().includes(query) && (!status.value || row.dataset.status===status.value);});
        var size=Number(perPage.value), pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages);
        rows.forEach(function (row) {row.hidden=true;});
        matches.slice((page-1)*size,page*size).forEach(function (row) {row.hidden=false;});
        var empty = document.getElementById('te-no-matches');
        if (empty) empty.hidden = matches.length > 0 || rows.length === 0;
        document.getElementById('te-count').textContent='Showing '+(matches.length ? ((page-1)*size+1) : 0)+'–'+Math.min(page*size,matches.length)+' of '+matches.length+' matching rules';
        document.getElementById('te-page').textContent=page+' / '+pages;
        previous.disabled=page===1;next.disabled=page===pages;
      }
      search.addEventListener('input',function () {page=1;paginate();});
      status.addEventListener('change',function () {page=1;paginate();});
      perPage.addEventListener('change',function () {page=1;paginate();});
      previous.addEventListener('click',function () {page--;paginate();});
      next.addEventListener('click',function () {page++;paginate();});paginate();
    }
    document.querySelectorAll('.te-del').forEach(function (button) {
      if (button.dataset.ready) return;
      button.dataset.ready = 'true';
      button.addEventListener('click', function () {
        if (!confirm('Delete this tax exemption? This cannot be undone.')) return;
        var form = document.createElement('form'); form.method = 'post'; form.action = base + '/deleteTaxExemption';
        var token = document.querySelector('.zc-tax-form [name=moquiSessionToken]');
        if (!token) return;
        [['exemptionId', button.dataset.id], ['moquiSessionToken', token.value]].forEach(function (pair) {
          var field = document.createElement('input'); field.type = 'hidden'; field.name = pair[0]; field.value = pair[1]; form.appendChild(field);
        });
        document.body.appendChild(form); form.submit();
      });
    });
  }
  window.zcTaxInit = init;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else { init(); }
})();
