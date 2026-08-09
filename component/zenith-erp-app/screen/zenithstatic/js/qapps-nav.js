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
    try { document.body.classList.add('zq-nav'); } catch (_e) {}   // apply the chrome CSS from first paint (no black header flash)

    // per-module sub-nav tabs — [moduleTitle, 'segment:label', …]; href = /qapps/zenith/<mount>/<segment>
    // (POS Terminal → /apps billing surface). Mirrors the /apps #z-subnav route map.
    var SUBNAV = {
        '/Contacts': ['Contacts', 'ContactsDashboard:Dashboard', 'FindContact:All Contacts', 'Customers:Customers', 'Vendors:Suppliers', 'CustomerGroups:Customer Groups', 'MergeContacts:Merge'],
        '/sales': ['Sales', 'SalesDashboard:Dashboard', 'FindQuotation:Quotations', 'FindOrder:Orders', 'FindDeliveryChallan:Delivery Challans', 'FindInvoice:Invoices', 'FindCreditNote:Credit / Debit Notes', 'PosSalesRegister:POS Sales', 'WarrantyPolicies:Warranty', 'Commissions:Commissions', 'SalesForecast:Forecast'],
        '/Purchase': ['Purchase', 'GoodsReceipt:Goods Receipt (GRN)', 'FindPurchaseOrder:Purchase Orders', 'FindPurchaseInvoice:Vendor Bills (ITC)', 'CreatePurchaseInvoice:Log Vendor Bill', 'PurchaseInvoices:Purchase Invoices', 'PurchaseReturns:Purchase Returns', 'JobWorkChallan:Job Work Challan', 'RfqList:RFQs', 'Gstr2bRecon:GSTR-2B Recon', 'VendorEvaluation:Vendor Evaluation'],
        '/Crm': ['CRM', 'Leads:Leads', 'Pipeline:Pipeline', 'Activities:Activities', 'Segments:Segments'],
        '/pos': ['POS', 'Dashboard:Dashboard', 'OwnerDashboard:Overview', 'Terminal:Billing Terminal', 'PosTransactions:Transactions', 'DailySummary:Daily Summary', 'PosSessions:Sessions', 'PosTerminals:Terminals', 'CreditBills:Credit Bills', 'CashEntry:Cash Entry', 'Expenses:Expenses', 'Wastage:Wastage', 'Stock:Stock', 'Reports:Reports', 'BillAuditReport:Audit Report', 'ProductPricing:Product Prices', 'PriceOverrides:Price Overrides', 'DiscountSettings:Discount', 'SalesMode:Sales Mode', 'Barcodes:Barcodes', 'BarcodeLabels:Barcode Labels', 'ProductImport:Import', 'ReceiptConfig:Receipts', 'PrinterConfig:Printers', 'Kitchen:Kitchen', 'BillNumberRegister:Bill Register', 'OfflineMode:Offline Mode'],
        '/Inventory': ['Inventory', 'InventoryDashboard:Dashboard', 'FindProduct:Products', 'StockLevels:Stock Levels', 'FindReceipt:Receiving', 'StockTransfers:Stock Transfers', 'StockAdjustments:Stock Adjustments', 'GatePasses:Gate Passes', 'CreateCatalogue:Catalogues', 'ExpiryDashboard:Expiry Risk', 'SerialNumbers:Serial Numbers', 'DemandForecast:Demand Forecast'],
        '/manufacturing': ['Manufacturing', 'WorkOrders:Work Orders', 'BillOfMaterials:Bill of Materials', 'WorkCenters:Work Centers', 'JobWork:Job Work', 'MrpPlanning:MRP Planning', 'ProductionSchedule:Production Schedule'],
        '/Accounting': ['Accounting', 'AcctgDashboard:Dashboard', 'ChartOfAccounts:Chart of Accounts', 'ManualJournalEntry:Journal Entry', 'JournalHistory:Journal History', 'Invoices:Invoices (A/R & A/P)', 'Payments:Payments', 'TrialBalance:Trial Balance', 'ProfitAndLoss:Profit & Loss', 'CashFlowStatement:Cash Flow', 'AgingReport:AR/AP Aging', 'Budgets:Budgets', 'GstReports:GST Reports', 'Gstr3bReport:GSTR-3B', 'TdsRegister:TDS Register', 'MsmeAgingReport:MSME Aging', 'AutoBrs:Bank Feeds & BRS', 'Schedule3Statements:Schedule III', 'RecurringInvoices:Recurring Invoices', 'TallyExport:Tally Export', 'VoucherAudit:Voucher Audit', 'McaAuditLog:MCA Audit Log'],
        '/payroll': ['Payroll', 'PayrollRuns:Payroll Runs', 'SalaryStructures:Salary Structures', 'TaxDeclarations:Tax Declarations', 'SalaryAdvances:Salary Advances', 'CtcCalculator:CTC Calculator', 'StatutoryCompliance:Statutory Compliance', 'EpfRegister:EPF Register', 'EsiRegister:ESI Register'],
        '/expenses': ['Expenses', 'MyExpenses:My Expenses', 'AllReports:All Reports', 'Categories:Categories', 'Advances:Advances', 'PerDiemRules:Per Diem Rules'],
        '/project': ['Projects', 'Projects:Projects', 'AllTasks:All Tasks'],
        '/Stores': ['Shops', 'FindStore:All Shops']
    };
    // the "Dashboards" hub shown on the Home/Dashboard landing — [label, href, matchPrefix, planModule] across
    // the ERP. A tab is shown only if its planModule is in the tenant's plan (null = always shown).
    var DASHBOARDS = [
        ['Overview', '/qapps/zenith', '/', null],
        ['Sales', '/qapps/zenith/sales/SalesDashboard', '/sales', 'sales'],
        ['POS', '/qapps/zenith/pos/Dashboard', '/pos/Dashboard', 'pos'],
        ['Owner Overview', '/qapps/zenith/pos/OwnerDashboard', '/pos/OwnerDashboard', 'pos'],
        ['Inventory', '/qapps/zenith/Inventory/InventoryDashboard', '/Inventory', 'inventory'],
        ['Accounting', '/qapps/zenith/Accounting/AcctgDashboard', '/Accounting', 'accounting'],
        ['Contacts', '/qapps/zenith/Contacts/ContactsDashboard', '/Contacts', 'contacts'],
        ['HR', '/qapps/zenith/Hr/HrDashboard', '/Hr', 'hr']
    ];
    // tenant's allowed plan modules (null = all-access / not a plan-gated tenant)
    function tenantMods() {
        try { var cfg = document.getElementById('zenith-saas-cfg');
            if (cfg && cfg.getAttribute('data-tenant') === 'true' && cfg.getAttribute('data-all') !== 'true') {
                var m = []; try { m = JSON.parse(cfg.getAttribute('data-modules') || '[]'); } catch (_e) {} return m.length ? m : null;
            }
        } catch (_e) {} return null;
    }

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
            { mod: 'project', match: '/project', icon: 'folder_open', label: 'Projects', href: '/qapps/zenith/project' },
            { match: '/Stores', icon: 'storefront', label: 'Shops', href: '/qapps/zenith/Stores/FindStore' }
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
            var msep = el('div'); msep.style.cssText = 'height:1px;background:#EEE9F7;margin:5px 6px'; menu.appendChild(msep);
            var mmg = el('a', 'zqsm-item'); mmg.href = '/qapps/zenith/Stores/FindStore'; mmg.style.fontWeight = '700';
            mmg.appendChild(mi('add')); mmg.appendChild(el('span', null, 'Add / manage shops'));
            mmg.addEventListener('click', function (e) { e.stopPropagation(); });
            menu.appendChild(mmg);
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

    // ---- per-module sub-nav bar (below the header): current module's sections as horizontal tabs ----
    var subBar = null;
    function updateSubnav() {
        if (!subBar) return;
        var rel = location.pathname.replace(/^\/qapps\/zenith/, '') || '/';
        // Home/Dashboard landing → the "Dashboards" hub (every ERP dashboard)
        if (rel === '/' || rel === '/Dashboard') {
            subBar.innerHTML = '';
            subBar.appendChild(el('span', 'zqsub-title', 'Dashboards'));
            var mods = tenantMods();
            DASHBOARDS.forEach(function (d) {
                if (d[3] && mods && mods.indexOf(d[3]) < 0) return;   // module not in the tenant's plan → skip
                var a = el('a', 'zqsub-tab', d[0]); a.href = d[1];
                var on = (d[2] === '/') ? (rel === '/' || rel === '/Dashboard') : (rel.indexOf(d[2]) === 0);
                if (on) a.classList.add('on');
                subBar.appendChild(a);
            });
            subBar.classList.add('show'); document.body.classList.add('zq-has-subnav');
            return;
        }
        var key = null, klen = -1;
        for (var k in SUBNAV) { if (rel.indexOf(k) === 0 && k.length > klen) { key = k; klen = k.length; } }
        subBar.innerHTML = '';
        if (!key) { subBar.classList.remove('show'); document.body.classList.remove('zq-has-subnav'); return; }
        var arr = SUBNAV[key], mount = key.slice(1);
        subBar.appendChild(el('span', 'zqsub-title', arr[0]));
        var active = null, alen = -1;
        for (var i = 1; i < arr.length; i++) {
            var pair = arr[i], ci = pair.indexOf(':'), seg = pair.slice(0, ci), label = pair.slice(ci + 1);
            var href = (mount === 'pos' && seg === 'Terminal') ? '/apps/zenith/pos/Terminal' : ('/qapps/zenith/' + mount + '/' + seg);
            var a = el('a', 'zqsub-tab', label); a.href = href;
            var m = key + '/' + seg; if (rel.indexOf(m) === 0 && m.length > alen) { active = a; alen = m.length; }
            subBar.appendChild(a);
        }
        if (active) active.classList.add('on');
        subBar.classList.add('show'); document.body.classList.add('zq-has-subnav');
        if (active) { try { var r = active.getBoundingClientRect(), br = subBar.getBoundingClientRect(); subBar.scrollLeft += (r.left - br.left) - (subBar.clientWidth / 2) + (r.width / 2); } catch (_e) {} }
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
        subBar = el('div'); subBar.id = 'zq-subnav';
        subBar.style.top = (header.offsetHeight || 51) + 'px';
        body.appendChild(subBar);
        updateSubnav();
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
        setInterval(function () { if (location.pathname !== last) { last = location.pathname; applyActive(); updateSubnav(); } }, 400);
        return true;
    }

    // the Quasar shell renders asynchronously — wait for the layout AND the screen config (#z-shopdata, which
    // drives the shop switcher) so canSwitch is read correctly; fall back after ~4s if the config never loads.
    var tries = 0;
    var iv = setInterval(function () {
        tries++;
        if (!document.getElementById('z-shopdata') && tries <= 16) return;
        if (init() || tries > 60) clearInterval(iv);
    }, 250);
})();
