/* Home dashboard lifecycle: shared by the server renderer and the Quasar SPA. */
(function () {
  'use strict';
  var initialized = new WeakSet();
  function boot() {
    var root = document.getElementById('homeDashboard');
    if (!root || initialized.has(root)) return;
    var chart = root.querySelector('#homeActivityChart');
    var status = root.querySelector('#homeLayoutStatus');
    if (!status || !chart) return; // Wait for the complete SPA fragment.
    initialized.add(root);
    var config;
    try { config = JSON.parse(root.dataset.config); } catch (error) { status.textContent = 'Dashboard settings could not be loaded.'; return; }
    if (config.redirect && /^\/apps\/zenith\//.test(config.redirect)) {
      window.location.replace(config.redirect.replace('/apps/', location.pathname.startsWith('/qapps/') ? '/qapps/' : '/apps/'));
      return;
    }
    var money = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
    var svgNS = 'http://www.w3.org/2000/svg';
    function svgNode(tag, attributes, text) {
      var element = document.createElementNS(svgNS, tag);
      Object.keys(attributes).forEach(function (key) { element.setAttribute(key, attributes[key]); });
      if (text !== undefined) element.textContent = text;
      return element;
    }
    function draw(view) {
      var data = config[view], hourly = view === 'hourly';
      if (!data) return;
      var values = data.series.map(Number), max = Math.max.apply(null, values.concat([1]));
      var step = Math.pow(10, Math.floor(Math.log10(max))), ceiling = Math.ceil(max / step) * step;
      var svg = svgNode('svg', { viewBox: '0 0 680 240', role: 'img', 'aria-label': (hourly ? "Today's hourly sales" : 'Sales Analyst') + ': ₹' + money.format(data.total) });
      svg.appendChild(svgNode('title', {}, data.cats.map(function (label, i) { return label + ': ₹' + money.format(values[i]); }).join('; ')));
      for (var i = 0; i <= 4; i++) {
        var y = 20 + i * 45, amount = ceiling * (4 - i) / 4;
        svg.appendChild(svgNode('line', { x1: 52, y1: y, x2: 666, y2: y, stroke: '#E5E7EB', 'stroke-dasharray': '4,4' }));
        svg.appendChild(svgNode('text', { x: 44, y: y + 4, 'text-anchor': 'end', fill: '#9CA3AF', 'font-size': 11 }, amount >= 1000 ? money.format(amount / 1000) + 'K' : money.format(amount)));
      }
      var points = [], slot = 610 / Math.max(values.length, 1);
      values.forEach(function (value, index) {
        var x = 55 + slot * (index + 0.5), y = 200 - value / ceiling * 180;
        points.push([x, y]);
        if (hourly) svg.appendChild(svgNode('rect', { x: x - slot * 0.3, y: y, width: slot * 0.6, height: 200 - y, rx: 4, fill: '#6DD4C8' }));
        if (index % Math.max(1, Math.ceil(values.length / 8)) === 0 || index === values.length - 1) {
          svg.appendChild(svgNode('text', { x: x, y: 224, 'text-anchor': 'middle', fill: '#6B7280', 'font-size': 11 }, data.cats[index]));
        }
      });
      if (!hourly && points.length) {
        var path = points.map(function (p, index) { return (index ? 'L' : 'M') + p.join(','); }).join(' ');
        svg.appendChild(svgNode('path', { d: path + ' L' + points[points.length - 1][0] + ',200 L' + points[0][0] + ',200 Z', fill: '#3B82F6', 'fill-opacity': 0.08 }));
        svg.appendChild(svgNode('path', { d: path, fill: 'none', stroke: '#2563EB', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
        points.forEach(function (p) { svg.appendChild(svgNode('circle', { cx: p[0], cy: p[1], r: 4, fill: '#2563EB', stroke: 'white', 'stroke-width': 2.5 })); });
      }
      chart.replaceChildren(svg);
      chart.setAttribute('aria-label', svg.getAttribute('aria-label'));
      root.querySelector('#baHead').textContent = '₹' + money.format(data.total);
      root.querySelector('#baSub').textContent = data.sub + ' · ' + (Number(data.total) === 0 ? 'No sales recorded' : '₹' + money.format(data.total) + ' in sales');
      var heading = root.querySelector('[data-chart-title]');
      if (heading) heading.textContent = hourly ? "Today's Hourly Sales" : 'Sales Analyst';
      root.querySelectorAll('.ba-seg-btn').forEach(function (button) { var active = button.dataset.t === view; button.classList.toggle('on', active); button.setAttribute('aria-pressed', String(active)); });
    }
    root.querySelectorAll('.ba-seg-btn').forEach(function (button) { button.addEventListener('click', function () { draw(button.dataset.t); }); });
    draw('weekly');
    // Keep raw HTML links on the current mount; the POS terminal intentionally uses /apps.
    if (location.pathname.startsWith('/qapps/')) root.querySelectorAll('a[href^="/apps/"]').forEach(function (link) {
      if (!link.pathname.endsWith('/pos/Terminal')) link.setAttribute('href', link.getAttribute('href').replace('/apps/', '/qapps/'));
    });
    var widgets = Array.from(root.querySelectorAll('.dash-widget'));
    var wrap = document.createElement('div'); wrap.className = 'home-widgets';
    if (widgets.length) widgets[0].before(wrap);
    var order = (config.order || 'kpis,activity,snapshot,insights,modules').split(',');
    order.concat(widgets.map(function (widget) { return widget.dataset.wkey; })).forEach(function (key) {
      var widget = widgets.find(function (w) { return w.dataset.wkey === key; });
      if (widget && widget.parentNode !== wrap) wrap.appendChild(widget);
    });
    var sizes = {};
    (config.sizes || '').split(',').forEach(function (pair) { var parts = pair.split(':'); sizes[parts[0]] = parts[1]; });
    widgets.forEach(function (widget) { if (/^(half|third)$/.test(sizes[widget.dataset.wkey])) widget.dataset.size = sizes[widget.dataset.wkey]; });
    var timer, saveQueue = Promise.resolve();
    function save() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!root.isConnected) return;
        var ordered = Array.from(wrap.children);
        var body = new URLSearchParams({ order: ordered.map(function (w) { return w.dataset.wkey; }).join(','), sizes: ordered.filter(function (w) { return w.dataset.size; }).map(function (w) { return w.dataset.wkey + ':' + w.dataset.size; }).join(','), moquiSessionToken: config.token });
        status.textContent = 'Saving layout…';
        saveQueue = saveQueue.then(function () {
          return fetch(config.saveUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' })
            .then(function (response) { if (!response.ok) throw new Error('Save failed'); return response.json(); })
            .then(function (result) { if (!result.saved) throw new Error('Save failed'); status.textContent = 'Layout saved.'; })
            .catch(function () { status.textContent = 'Layout could not be saved. Reload and try again.'; });
        });
      }, 250);
    }
    root.classList.toggle('home-customizing', Boolean(config.customize));
    widgets.forEach(function (widget) {
      var handle = widget.querySelector('.dash-handle');
      if (handle) handle.remove();
      if (!config.customize) return;
      var controls = document.createElement('div'); controls.className = 'home-widget-controls';
      [['Move up', -1], ['Move down', 1], ['Resize', 0]].forEach(function (action) {
        var button = document.createElement('button'); button.type = 'button'; button.textContent = action[0];
        button.setAttribute('aria-label', action[0] + ' ' + widget.dataset.wkey);
        button.addEventListener('click', function () {
          if (action[1] < 0 && widget.previousElementSibling) wrap.insertBefore(widget, widget.previousElementSibling);
          if (action[1] > 0 && widget.nextElementSibling) wrap.insertBefore(widget.nextElementSibling, widget);
          if (!action[1]) { var next = { full: 'half', half: 'third', third: 'full' }[widget.dataset.size || 'full']; if (next === 'full') delete widget.dataset.size; else widget.dataset.size = next; }
          save(); button.focus();
        });
        controls.appendChild(button);
      });
      widget.prepend(controls);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true });
})();
