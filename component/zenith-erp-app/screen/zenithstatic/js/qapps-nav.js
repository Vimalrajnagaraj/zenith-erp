/*
 * qapps-nav.js — ZE-NAV: port the /apps categorised sidebar + light Owner-View top bar to the
 * Quasar SPA (/qapps). /qapps strips inline <style>/<script>, so this ships as a footer_script
 * (added in ZenithApp.xml) and its CSS lives in zenith-theme-v4.css (loaded on /qapps). It hides
 * the framework tree-drawer, injects a fixed categorised sidebar, and restyles the q-header light
 * with the Owner-View pill / shop switcher / global search — mirroring the /apps redesign. The
 * config it reads (#zenith-saas-cfg, #z-shopdata) is already rendered on /qapps (type="html,qvt").
 *
 * SPA note: the q-header / q-drawer / page-container layout is PERSISTENT across client-side
 * navigations (only the page content swaps), so the chrome is injected once; only the active
 * highlight is re-applied on route change (polled — robust against whichever router the shell uses).
 */
(function () {
    if (location.pathname.indexOf('/qapps/') !== 0) return;   // Quasar shell only
    if (window.__zqNav) return; window.__zqNav = 1;

    // module → sidebar entry. hrefs stay on /qapps (stay in the SPA); the billing Terminal is /apps-only.
    var CATS = [
        { cat: '', items: [
            { match: '/Dashboard', icon: 'dashboard', label: 'Dashboard', href: '/qapps/zenith' },
            { mod: 'contacts', match: '/Contacts', icon: 'groups', label: 'Contacts', href: '/qapps/zenith/Contacts/ContactsDashboard' }
        ], head: 'OVERVIEW' },
        { head: 'SALES & CRM', items: [
            { mod: 'sales', match: '/sales', icon: 'trending_up', label: 'Sales', href: '/qapps/zenith/sales/SalesDashboard' },
            { mod: 'purchase', match: '/Purchase', icon: 'shopping_cart', label: 'Purchase', href: '/qapps/zenith/Purchase/RfqList' },
            { mod: 'crm', match: '/Crm', icon: 'campaign', label: 'CRM', href: '/qapps/zenith/Crm/Leads' },
            { mod: 'pos', match: '/pos', icon: 'point_of_sale', label: 'POS', href: '/qapps/zenith/pos/Dashboard' },
            { mod: 'pos', match: '/pos/Terminal', icon: 'receipt_long', label: 'POS Billing', href: '/apps/zenith/pos/Terminal' }
        ] },
        { head: 'OPERATIONS', items: [
            { mod: 'inventory', match: '/Inventory', icon: 'inventory_2', label: 'Inventory', href: '/qapps/zenith/Inventory/InventoryDashboard' },
            { mod: 'manufacturing', match: '/manufacturing', icon: 'precision_manufacturing', label: 'Manufacturing', href: '/qapps/zenith/manufacturing/WorkOrders' },
            { mod: 'project', match: '/project', icon: 'folder_open', label: 'Projects', href: '/qapps/zenith/project' }
        ] },
        { head: 'FINANCE', items: [
            { mod: 'accounting', match: '/Accounting', icon: 'account_balance', label: 'Accounting', href: '/qapps/zenith/Accounting/AcctgDashboard' },
            { mod: 'payroll', match: '/payroll', icon: 'payments', label: 'Payroll', href: '/qapps/zenith/payroll/PayrollRuns' },
            { mod: 'expenses', match: '/expenses', icon: 'savings', label: 'Expenses', href: '/qapps/zenith/expenses/MyExpenses' }
        ] },
        { head: 'OTHER', items: [
            { match: '/__more', icon: 'more_horiz', label: 'More Modules', href: '/qapps/zenith' }
        ] }
    ];

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function mi(name) { var s = el('span', 'material-icons', name); return s; }
    var allLinks = [];

    function buildSidebar() {
        var side = el('aside'); side.id = 'zq-sidebar';
        var brand = el('div', 'zqs-brand');
        var img = el('img'); img.src = '/zenithstatic/img/zetaerp-icon-zc.svg'; img.alt = 'ZC'; brand.appendChild(img);
        brand.appendChild(el('span', null, 'ZcERP'));
        side.appendChild(brand);
        var scroll = el('div', 'zqs-scroll');
        CATS.forEach(function (grp) {
            if (grp.head) { var h = el('div', 'zqs-cat', grp.head); scroll.appendChild(h); }
            grp.items.forEach(function (it) {
                var a = el('a', 'zqs-link'); a.href = it.href;
                if (it.mod) a.setAttribute('data-mod', it.mod);
                a.setAttribute('data-match', it.match);
                a.appendChild(mi(it.icon));
                a.appendChild(el('span', 't', it.label));
                scroll.appendChild(a);
                allLinks.push(a);
            });
        });
        side.appendChild(scroll);
        var tgl = el('button', 'zqs-collapse'); tgl.id = 'zq-side-toggle'; tgl.title = 'Collapse / expand'; tgl.innerHTML = '&#10094;';
        side.appendChild(tgl);
        return side;
    }

    // longest data-match prefix of the /qapps-relative path
    function applyActive() {
        var rel = location.pathname.replace(/^\/qapps\/zenith/, '') || '/';
        var best = null, bestLen = -1;
        allLinks.forEach(function (a) {
            a.classList.remove('on');
            var m = a.getAttribute('data-match') || '';
            if (m && m !== '/__more' && rel.indexOf(m) === 0 && m.length > bestLen) { best = a; bestLen = m.length; }
        });
        if (!best) best = allLinks[0];
        if (best) best.classList.add('on');
    }

    function applyRbac(side) {
        try {
            var cfg = document.getElementById('zenith-saas-cfg');
            if (cfg && cfg.getAttribute('data-tenant') === 'true' && cfg.getAttribute('data-all') !== 'true') {
                var mods = []; try { mods = JSON.parse(cfg.getAttribute('data-modules') || '[]'); } catch (_e) {}
                if (mods.length) {
                    allLinks.forEach(function (a) { var k = a.getAttribute('data-mod'); if (k && mods.indexOf(k) < 0) a.style.display = 'none'; });
                    [].slice.call(side.querySelectorAll('.zqs-cat')).forEach(function (h) {
                        var n = h.nextElementSibling, any = false;
                        while (n && !n.classList.contains('zqs-cat')) { if (n.classList && n.classList.contains('zqs-link') && n.style.display !== 'none') { any = true; break; } n = n.nextElementSibling; }
                        if (!any) h.style.display = 'none';
                    });
                }
            }
        } catch (_e) {}
    }

    // ---- top bar: Owner View pill / shop switcher / global search, injected into the q-header ----
    function buildTopbar(header) {
        var cfg = document.getElementById('zenith-saas-cfg');
        var shopData = document.getElementById('z-shopdata');
        var orgName = (cfg && cfg.getAttribute('data-org-name')) || '';
        var posOnly = cfg && cfg.getAttribute('data-pos-only') === 'true';
        var canSwitch = false, shops = [], activeShop = '', shopTok = '';
        if (shopData) {
            canSwitch = shopData.getAttribute('data-multishop') === 'true' && !posOnly;
            activeShop = shopData.getAttribute('data-active') || '';
            shopTok = shopData.getAttribute('data-token') || '';
            [].slice.call(shopData.querySelectorAll('i')).forEach(function (n) { shops.push({ id: n.getAttribute('data-id'), name: n.getAttribute('data-name') }); });
        }
        var wrap = el('div'); wrap.id = 'zq-topextra';
        // Owner View pill / switcher
        var ov = el('div'); ov.id = 'zq-ownerview';
        ov.appendChild(mi('verified_user'));
        ov.appendChild(el('span', null, 'Owner View'));
        if (canSwitch) {
            ov.classList.add('zqov-switch');
            ov.appendChild(el('span', 'zqov-sep', '·'));
            var cur = el('span', 'zqov-org'); var act = shops.filter(function (s) { return s.id === activeShop; })[0];
            cur.textContent = act ? act.name : 'All Shops'; ov.appendChild(cur);
            ov.appendChild(mi('expand_more')).classList.add('zqov-caret');
            var menu = el('div'); menu.id = 'zq-shopmenu';
            menu.appendChild(el('div', 'zqsm-head', 'View shop'));
            var submit = function (id) { var f = el('form'); f.method = 'POST'; f.action = '/apps/zenith/setActiveShop'; f.style.display = 'none';
                var add = function (n, v) { var i = el('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
                add('facilityId', id || ''); add('moquiSessionToken', shopTok); add('returnUrl', location.pathname + location.search);
                document.body.appendChild(f); f.submit(); };
            var item = function (id, name, on) { var a = el('a', 'zqsm-item' + (on ? ' on' : '')); a.href = '#';
                a.appendChild(mi(on ? 'check' : (id ? 'storefront' : 'apps'))); a.appendChild(el('span', null, name));
                a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); submit(id); }); return a; };
            menu.appendChild(item('', 'All Shops (combined)', !activeShop));
            shops.forEach(function (s) { menu.appendChild(item(s.id, s.name, s.id === activeShop)); });
            ov.appendChild(menu);
            ov.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('show'); });
            document.addEventListener('click', function () { menu.classList.remove('show'); });
        } else if (orgName) {
            ov.appendChild(el('span', 'zqov-sep', '·'));
            ov.appendChild(el('span', 'zqov-org', orgName));
        }
        wrap.appendChild(ov);
        // search
        var sc = el('div'); sc.id = 'zq-search';
        var box = el('div', 'zqsr-box'); box.appendChild(mi('search'));
        var inp = el('input'); inp.type = 'text'; inp.id = 'zq-search-input'; inp.placeholder = 'Search modules…'; inp.setAttribute('autocomplete', 'off'); box.appendChild(inp);
        sc.appendChild(box);
        var res = el('div'); res.id = 'zq-search-results'; sc.appendChild(res);
        wrap.appendChild(sc);
        var idx = []; CATS.forEach(function (g) { g.items.forEach(function (it) { if (it.match !== '/__more') idx.push({ label: it.label, href: it.href }); }); });
        function draw(q) { q = (q || '').trim().toLowerCase(); res.innerHTML = '';
            if (!q) { res.classList.remove('show'); return; }
            var out = idx.filter(function (it) { return it.label.toLowerCase().indexOf(q) >= 0; }).slice(0, 10);
            if (!out.length) { var em = el('div', 'zqsr-empty', 'No matches'); res.appendChild(em); res.classList.add('show'); return; }
            out.forEach(function (it) { var a = el('a'); a.href = it.href; a.appendChild(mi('arrow_forward')); a.appendChild(el('span', null, it.label)); res.appendChild(a); });
            res.classList.add('show'); }
        inp.addEventListener('input', function () { draw(inp.value); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = res.querySelector('a'); if (f) { e.preventDefault(); location.href = f.getAttribute('href'); } } else if (e.key === 'Escape') { inp.value = ''; res.classList.remove('show'); } });
        document.addEventListener('click', function (e) { if (!sc.contains(e.target)) res.classList.remove('show'); });
        // insert INTO the toolbar row, right after the menu burger, so it stays a single row
        var toolbar = header.querySelector('.q-toolbar') || header;
        var burger = toolbar.querySelector('button');
        if (burger) toolbar.insertBefore(wrap, burger.nextSibling); else toolbar.insertBefore(wrap, toolbar.firstChild);
    }

    function init() {
        var header = document.querySelector('.q-header');
        var layout = document.querySelector('.q-layout');
        if (!header || !layout) return false;
        var body = document.body;
        body.classList.add('zq-nav');
        var side = buildSidebar();
        body.appendChild(side);
        applyRbac(side);
        applyActive();
        buildTopbar(header);
        // collapse (persisted)
        try { if (localStorage.getItem('zqSideCollapsed') === '1') body.classList.add('zq-side-collapsed'); } catch (_e) {}
        var tgl = document.getElementById('zq-side-toggle');
        if (tgl) tgl.addEventListener('click', function () { body.classList.toggle('zq-side-collapsed'); try { localStorage.setItem('zqSideCollapsed', body.classList.contains('zq-side-collapsed') ? '1' : '0'); } catch (_e) {} });
        // the framework's menu burger used to toggle the (now hidden) tree drawer — repurpose it to open our
        // sidebar off-canvas on mobile; tapping the page content closes it.
        var fwBurger = header.querySelector('.q-toolbar button');
        if (fwBurger) fwBurger.addEventListener('click', function () { if (window.innerWidth <= 900) body.classList.toggle('zq-side-open'); }, true);
        document.addEventListener('click', function (e) { if (body.classList.contains('zq-side-open') && !side.contains(e.target) && (!fwBurger || !fwBurger.contains(e.target))) body.classList.remove('zq-side-open'); });
        side.addEventListener('click', function (e) { if (e.target.closest('.zqs-link')) body.classList.remove('zq-side-open'); });
        // re-apply active highlight on SPA route changes (URL is swapped without a full reload)
        var last = location.pathname;
        setInterval(function () { if (location.pathname !== last) { last = location.pathname; applyActive(); } }, 400);
        return true;
    }

    // the Quasar shell renders asynchronously — wait for the layout to exist
    var tries = 0;
    var iv = setInterval(function () {
        tries++;
        if (init() || tries > 60) clearInterval(iv);
    }, 250);
})();
