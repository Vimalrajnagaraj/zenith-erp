// Run only against the named disposable loopback memory runtime. No production access.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const crypto = require('crypto'), { chromium } = require('playwright');
const base = 'http://127.0.0.1:18085';
const runtime = process.env.BILL_QA_RUNTIME, java = process.env.BILL_QA_JAVA;
const out = path.resolve(process.env.BILL_QA_OUT || 'vendor-bill-proof');
if (!runtime || !java) throw Error('Configure the disposable runtime and JDK');
fs.mkdirSync(out, { recursive: true });
const classes = path.join(out, 'classes'); fs.mkdirSync(classes, { recursive: true });
cp.execFileSync(path.join(path.dirname(java), 'javac.exe'), ['-d', classes, path.join(__dirname, 'VendorBillDbProbe.java')], { windowsHide: true });
function q(sql) {
    return JSON.parse(cp.execFileSync(java, ['-cp', path.join(runtime, 'WEB-INF/lib/h2-2.4.240.jar') + path.delimiter + classes, 'VendorBillDbProbe'], { input: sql, encoding: 'utf8', windowsHide: true }));
}
const hash = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const report = { productionAccess: false, checks: [], failures: [], generated: [] };
function check(name, ok, evidence = {}) {
    report.checks.push({ name, passed: !!ok, evidence }); console.log((ok ? 'PASS ' : 'FAIL ') + name);
    if (!ok) throw Error(name);
}
const invoice = id => q(`SELECT * FROM invoice WHERE invoice_id='${id}'`);
const lines = id => q(`SELECT * FROM invoice_item WHERE invoice_id='${id}' ORDER BY invoice_item_seq_id`);
const totals = id => q(`SELECT invoice_total,unpaid_total,total_taxable_amount,total_tax_amount,total_cgst,total_sgst,round_off_amount FROM invoice WHERE invoice_id='${id}'`)[0];
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let admin, ctx;
    try {
        admin = await browser.newContext();
        const deadline = Date.now() + 120000;
        for (;;) {
            try {
                const r = await admin.request.get(base + '/apps/zenith/Purchase/FindPurchaseInvoice', { timeout: 120000, headers: { Authorization: 'Basic ' + Buffer.from('john.doe:moqui').toString('base64') } });
                if (r.status() >= 500) throw Error('Not ready'); break;
            } catch (e) { if (Date.now() >= deadline) throw e; await new Promise(r => setTimeout(r, 1000)); }
        }
        const ap = await admin.newPage(); await ap.goto(base + '/apps/zenith/Purchase/FindPurchaseInvoice');
        const adminToken = await ap.locator('[name=moquiSessionToken]').first().inputValue();
        let r = await admin.request.post(base + '/apps/zenith/pricing/VendorBillQaAcceptance/initialize', { form: { moquiSessionToken: adminToken } });
        check('Fresh fixtures initialized', r.status() === 200 && (await r.json()).initialized === true);
        check('Approved seed slab and reused SAC fixture exist', Number(q("SELECT igst_rate FROM india_gst_slab WHERE gst_slab_id='GST_18'")[0].igst_rate) === 18);
        check('Issued control fixture has real tax-inclusive grand', Number(totals('PP_QA_ISSUED').invoice_total)===118 && Number(totals('PP_QA_ISSUED').total_tax_amount)===18 && lines('PP_QA_ISSUED').length===1);
        const issued = hash(invoice('PP_QA_ISSUED')), issuedLines = hash(lines('PP_QA_ISSUED'));
        const foreign = hash(invoice('PP_QA_BILL_B')), foreignLines = hash(lines('PP_QA_BILL_B'));
        const sales = hash(invoice('PP_QA_SALES_CONTROL'));
        const outside = hash(q("SELECT * FROM invoice WHERE to_party_id NOT IN ('PP_QA_A','PP_QA_B','PP_QA_VENDOR_A') OR to_party_id IS NULL ORDER BY invoice_id"));
        ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
        await ctx.request.get(base + '/apps/zenith/Purchase/FindPurchaseInvoice', { headers: { Authorization: 'Basic ' + Buffer.from('purchase.pricing.qa:moqui').toString('base64') } });
        const p = await ctx.newPage(); await p.goto(base + '/apps/zenith/Purchase/FindPurchaseInvoice');
        const token = await p.locator('[name=moquiSessionToken]').first().inputValue();
        check('Active fixture organization established', q("SELECT preference_value FROM user_preference WHERE user_id='PP_QA_USER' AND preference_key='ACTIVE_ORGANIZATION'")[0].preference_value === 'PP_QA_A');
        async function post(screen, transition, data = {}, shell = 'apps', csrf = true) {
            await ctx.request.get(base + '/apps/zenith/Purchase/FindPurchaseInvoice');
            const prefix = screen === 'VendorBillQaAcceptance' ? 'pricing' : 'Purchase';
            const res = await ctx.request.post(`${base}/${shell}/zenith/${prefix}/${screen}/${transition}`, { form: { ...(csrf ? { moquiSessionToken: token } : {}), ...data }, maxRedirects: 0 });
            check(shell + ' ' + transition + ' has no server exception', res.status() < 500, { status: res.status() }); return res;
        }
        async function invoke(op, data) { return (await post('VendorBillQaAcceptance', 'invoke', { op, ...data })).json(); }
        const create = { organizationPartyId: 'PP_QA_A', vendorPartyId: 'PP_QA_VENDOR_A', invoiceDate: '2026-01-15', vendorInvoiceNumber: 'Disposable verified creation' };
        for (const bad of [{ organizationPartyId: 'PP_QA_B' }, { organizationPartyId: '_NA_' }, { vendorPartyId: 'PP_QA_VENDOR_B' }, { vendorPartyId: 'PP_QA_MISSING' }, { vendorPartyId: 'PP_QA_USER' }, { currencyUomId: 'OTH_ea' }, { purchaseOrderNumber: 'PP_QA_ORDER_B' }, { purchaseOrderNumber: 'PP_QA_MIXED_ORDER' }, { isReverseCharge: 'invalid' }, { isReverseCharge: 'Y', isCompositionDealer: 'Y' }, { invoiceDate: 'invalid' }]) {
            const count = q('SELECT count(*) n FROM invoice')[0].n, result = await invoke('create', { ...create, ...bad });
            check('Invalid create persists nothing ' + JSON.stringify(bad), result.errors.length > 0 && q('SELECT count(*) n FROM invoice')[0].n === count);
        }
        const created = await invoke('create', { ...create, purchaseOrderNumber: 'PP_QA_ORDER_A' });
        check('Valid creation returns an actual Purchase invoice', !created.errors.length && invoice(created.result.invoiceId)[0].invoice_type_enum_id === 'InvoicePurchase', created);
        const newBill = created.result.invoiceId; report.generated.push(newBill);
        check('Vendor invoice number and scoped PO persist', invoice(newBill)[0].vendor_invoice_number === create.vendorInvoiceNumber && invoice(newBill)[0].purchase_order_number === 'PP_QA_ORDER_A' && invoice(newBill)[0].to_party_id === 'PP_QA_A');
        const item = { invoiceId: newBill, productId: 'PP_QA_PRODUCT_A', quantity: '1', unitAmount: '100.01' };
        for (const bad of [{ quantity: '0' }, { quantity: '-1' }, { quantity: 'invalid' }, { unitAmount: '-1' }, { discountPercent: '101' }, { discountPercent: '-1' }, { productId: 'PP_QA_PRODUCT_B' }, { invoiceId: 'PP_QA_BILL_B' }, { invoiceId: 'PP_QA_ISSUED' }, { invoiceId: 'PP_QA_SALES_CONTROL' }, { invoiceId: 'PP_QA_MISSING' }]) {
            const before = hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id'));
            const result = await invoke('item', { ...item, ...bad });
            check('Invalid shared line persists nothing ' + JSON.stringify(bad), result.errors.length > 0 && before === hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id')));
        }
        const added = await invoke('item', item); check('Shared line persists', !added.errors.length && lines(newBill).length === 1, added);
        const value = totals(newBill);
        check('Shared grand/unpaid include tax before separate round-off', Number(value.invoice_total) === 118.01 && Number(value.unpaid_total) === 118.01 && Number(value.total_taxable_amount) === 100.01 && Number(value.total_tax_amount) === 18 && Number(value.round_off_amount) === -0.01, value);
        check('Shared line/header GST columns reconcile', Number(value.total_cgst) === 9 && Number(value.total_sgst) === 9 && Number(lines(newBill)[0].cgst_amount) === 9);
        const charged = await invoke('charged', { invoiceId: newBill });
        check('GST reader preserves charged tax with separate round-off', !charged.errors.length && Number(charged.result.cgst) === 9 && Number(charged.result.sgst) === 9 && charged.result.reconciled === true, charged);
        const cessBill=await invoke('create',{...create,vendorInvoiceNumber:'Disposable approved cess arithmetic'});
        check('Cess arithmetic bill creation persists',!cessBill.errors.length&&!!invoice(cessBill.result.invoiceId).length);report.generated.push(cessBill.result.invoiceId);
        const cessLine=await invoke('item',{...item,invoiceId:cessBill.result.invoiceId,productId:'PP_QA_CESS'});
        const cessDb=invoice(cessBill.result.invoiceId)[0];
        check('Approved cess reconciles line, header and grand',!cessLine.errors.length&&Number(cessDb.total_cess)===5&&Number(cessDb.total_tax_amount)===33&&Number(cessDb.invoice_total)===133.01&&Number(lines(cessBill.result.invoiceId)[0].cess_amount)===5,cessLine);
        const cessReader=await invoke('charged',{invoiceId:cessBill.result.invoiceId});
        check('GST reader retains approved cess without reallocating it',!cessReader.errors.length&&cessReader.result.reconciled===true&&Number(cessReader.result.cess)===5&&Number(cessReader.result.cgst)===14&&Number(cessReader.result.sgst)===14,cessReader);
        const setScheme=await post('VendorBillQaAcceptance','buyerScheme',{scheme:'Y'});
        check('Exact disposable buyer composition scheme persists',setScheme.status()===200&&q("SELECT is_composition_scheme FROM india_gst_config WHERE organization_party_id='PP_QA_A'")[0].is_composition_scheme==='Y');
        const compositionBuyer=await invoke('create',{...create,vendorInvoiceNumber:'Disposable composition buyer',itcEligible:'Y'});
        check('Composition buyer creation stores ITC No',!compositionBuyer.errors.length&&invoice(compositionBuyer.result.invoiceId)[0].itc_eligible==='N',compositionBuyer);report.generated.push(compositionBuyer.result.invoiceId);
        const compositionLine=await invoke('item',{...item,invoiceId:compositionBuyer.result.invoiceId});
        check('Regular supplier GST remains payable by a composition buyer',!compositionLine.errors.length&&Number(totals(compositionBuyer.result.invoiceId).invoice_total)===118.01&&Number(totals(compositionBuyer.result.invoiceId).total_tax_amount)===18,compositionLine);
        for(const shell of ['apps','qapps']) {
            const before=hash(invoice(compositionBuyer.result.invoiceId));
            await post('EditPurchaseInvoice','updateInvoice',{invoiceId:compositionBuyer.result.invoiceId,itcEligible:'Y'},shell);
            check(shell+' composition buyer ITC cannot be forged',before===hash(invoice(compositionBuyer.result.invoiceId)));
            await post('EditPurchaseInvoice','updateInvoice',{invoiceId:compositionBuyer.result.invoiceId,itcEligible:'N',vendorInvoiceNumber:shell+' composition buyer metadata'},shell);
            check(shell+' composition buyer valid metadata persists',invoice(compositionBuyer.result.invoiceId)[0].itc_eligible==='N'&&invoice(compositionBuyer.result.invoiceId)[0].vendor_invoice_number===shell+' composition buyer metadata');
        }
        await post('VendorBillQaAcceptance','buyerScheme',{scheme:'N'});
        check('Exact disposable buyer scheme restored',q("SELECT is_composition_scheme FROM india_gst_config WHERE organization_party_id='PP_QA_A'")[0].is_composition_scheme==='N');
        const exportUrls = {};
        for (const shell of ['apps', 'qapps']) {
            await p.goto(`${base}/${shell}/zenith/Purchase/CreatePurchaseInvoice`,{waitUntil:'networkidle'});
            await p.getByRole('heading',{name:'Log Vendor Bill',exact:true}).waitFor();
            if(shell==='apps') await p.locator('select[name=fromPartyId]').selectOption('PP_QA_VENDOR_A');
            else {
                await p.getByRole('combobox',{name:'Vendor (Supplier)',exact:true}).click();
                await p.getByRole('option').filter({hasText:'Disposable Vendor A'}).click();
            }
            await p.locator('[name=vendorInvoiceNumber]').fill(shell+' actual browser form');
            await p.getByRole('button',{name:'Log Bill',exact:true}).click();
            await p.getByRole('heading',{name:'Vendor Bill: '+shell+' actual browser form',exact:true}).waitFor();
            const browserCreated=q(`SELECT invoice_id,to_party_id,from_party_id,invoice_type_enum_id FROM invoice WHERE vendor_invoice_number='${shell} actual browser form'`);
            check(shell+' actual browser form saves its scoped Purchase bill',browserCreated.length===1&&browserCreated[0].to_party_id==='PP_QA_A'&&browserCreated[0].from_party_id==='PP_QA_VENDOR_A'&&browserCreated[0].invoice_type_enum_id==='InvoicePurchase');report.generated.push(browserCreated[0].invoice_id);
            const legacyNumber=shell+' actual logged bill';
            await post('CreatePurchaseInvoice','createInvoice',{fromPartyId:'PP_QA_VENDOR_A',toPartyId:'PP_QA_A',invoiceDate:'2026-01-15',vendorInvoiceNumber:legacyNumber,purchaseOrderNumber:'PP_QA_ORDER_A',supplyNature:'REGULAR',itcEligible:'Y'},shell);
            const logged=q(`SELECT invoice_id,invoice_type_enum_id,to_party_id,purchase_order_number FROM invoice WHERE vendor_invoice_number='${legacyNumber}'`);
            check(shell+' actual Log Bill creation preserves vendor number and PO',logged.length===1&&logged[0].invoice_type_enum_id==='InvoicePurchase'&&logged[0].to_party_id==='PP_QA_A'&&logged[0].purchase_order_number==='PP_QA_ORDER_A');report.generated.push(logged[0].invoice_id);
            for(const supply of ['RCM','COMPOSITION']) {
                const number=shell+' actual '+supply;
                await post('PurchaseInvoices','createPurchaseInvoice',{...create,vendorInvoiceNumber:number,isReverseCharge:supply==='RCM'?'Y':'N',isCompositionDealer:supply==='COMPOSITION'?'Y':'N'},shell);
                const special=q(`SELECT * FROM invoice WHERE vendor_invoice_number='${number}'`);
                check(shell+' actual '+supply+' creation persists flags',special.length===1&&special[0].invoice_type_enum_id==='InvoicePurchase'&&special[0].is_reverse_charge===(supply==='RCM'?'Y':'N')&&special[0].is_composition_dealer===(supply==='COMPOSITION'?'Y':'N')&&(supply!=='COMPOSITION'||special[0].itc_eligible==='N'));report.generated.push(special[0].invoice_id);
                const specialLine=await invoke('item',{...item,invoiceId:special[0].invoice_id});
                check(shell+' '+supply+' shared line collects no supplier GST',!specialLine.errors.length&&Number(totals(special[0].invoice_id).invoice_total)===100.01&&Number(totals(special[0].invoice_id).total_tax_amount)===0,specialLine);
                await post('EditPurchaseInvoice','addItem',{invoiceId:special[0].invoice_id,productId:'PP_QA_PRODUCT_A',hsnSacCode:'998314',quantity:'1',amount:'100.01',taxPercentage:'18'},shell);
                check(shell+' '+supply+' routed line collects no supplier GST',lines(special[0].invoice_id).length===2&&Number(totals(special[0].invoice_id).invoice_total)===200.02&&Number(totals(special[0].invoice_id).total_tax_amount)===0);
                if(supply==='COMPOSITION') {const state=hash(invoice(special[0].invoice_id));await post('EditPurchaseInvoice','updateInvoice',{invoiceId:special[0].invoice_id,itcEligible:'Y'},shell);check(shell+' composition ITC cannot be forged',state===hash(invoice(special[0].invoice_id)));}
            }
            // The actual routed legacy editor has no postal fixtures. Existing approved tax-region metadata is enough.
            const row = { invoiceId: 'PP_QA_BILL_A', productId: 'PP_QA_PRODUCT_A', hsnSacCode: '998314', quantity: '1', amount: '100.01', taxPercentage: '18' };
            for (const bad of [{ quantity: '0' }, { quantity: '-1' }, { quantity: 'invalid' }, { amount: '-1' }, { taxPercentage: '19' }, { discountPercent: '101' }, { productId: 'PP_QA_PRODUCT_B' }, { invoiceId: 'PP_QA_BILL_B' }, { invoiceId: 'PP_QA_ISSUED' }, { invoiceId: 'PP_QA_SALES_CONTROL' }, { hsnSacCode: '' }]) {
                const before = hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id'));
                await post('EditPurchaseInvoice', 'addItem', { ...row, ...bad }, shell);
                check(shell + ' invalid routed line leaves DB unchanged ' + JSON.stringify(bad), before === hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id')));
            }
            await post('EditPurchaseInvoice', 'addItem', row, shell);
            const last = lines('PP_QA_BILL_A').at(-1);
            check(shell + ' routed positive line persists without postal-address exception', last && Number(last.taxable_amount) === 100.01 && Number(last.total_tax_amount) === 18 && last.hsn_sac_code === '998314');
            const expectedCount = shell === 'apps' ? 1 : 2;
            check(shell + ' routed totals include all GST', Number(totals('PP_QA_BILL_A').invoice_total) === 118.01 * expectedCount && Number(totals('PP_QA_BILL_A').unpaid_total) === 118.01 * expectedCount);
            await post('EditPurchaseInvoice', 'addItem', { ...row, discountPercent: '100' }, shell);
            check(shell + ' full discount stays zero instead of gross fallback', Number(lines('PP_QA_BILL_A').at(-1).taxable_amount) === 0 && Number(totals('PP_QA_BILL_A').invoice_total) === 118.01 * expectedCount);
            const before = hash(invoice('PP_QA_BILL_A'));
            await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_BILL_A', vendorInvoiceNumber: shell + ' verified metadata', toPartyId: 'PP_QA_B', fromPartyId: 'PP_QA_VENDOR_B', invoiceTypeEnumId: 'InvoiceSales', invoiceTotal: '1', unpaidTotal: '1' }, shell);
            check(shell + ' metadata saves while owner/type/totals remain protected', invoice('PP_QA_BILL_A')[0].vendor_invoice_number === shell + ' verified metadata' && invoice('PP_QA_BILL_A')[0].to_party_id === 'PP_QA_A' && invoice('PP_QA_BILL_A')[0].invoice_type_enum_id === 'InvoicePurchase' && Number(totals('PP_QA_BILL_A').invoice_total) === 118.01 * expectedCount);
            await post('EditPurchaseInvoice','updateInvoice',{invoiceId:'PP_QA_BILL_A',dueDate:'2026-01-20'},shell);
            await p.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=PP_QA_BILL_A`,{waitUntil:'networkidle'});
            check(shell+' saved overdue due date exposes actionable MSME warning',(await p.locator('body').innerText()).includes('MSME payment overdue')&&!/statutory limit|disallowed in the Income Tax Audit/.test(await p.locator('body').innerText()));
            await post('EditPurchaseInvoice','updateInvoice',{invoiceId:'PP_QA_BILL_A',dueDate:'2030-01-20'},shell);
            await p.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=PP_QA_BILL_A`,{waitUntil:'networkidle'});
            check(shell+' future due date persists in the fixture user timezone and has no overdue warning',Date.parse(invoice('PP_QA_BILL_A')[0].due_date.replace(' ','T')+'Z')===Date.parse('2030-01-20T00:00:00+05:30')&&(await p.locator('[name=dueDate]').inputValue())==='2030-01-20'&&!(await p.locator('body').innerText()).includes('MSME payment overdue'));
            const saved = hash(invoice('PP_QA_BILL_A'));
            for (const bad of [{ statusId: 'InvoicePaid' }, { statusId: 'InvoicePmtSent' }, { dueDate: '2000-01-01' }, { itcEligible: 'invalid' }, { supplierGstin: 'invalid' }, { isReverseCharge: 'Y' }]) await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_BILL_A', ...bad }, shell);
            await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_BILL_A', vendorInvoiceNumber: 'Missing CSRF' }, shell, false);
            check(shell + ' invalid metadata/workflow/CSRF leave it unchanged', saved === hash(invoice('PP_QA_BILL_A')));
            await post('EditPurchaseInvoice', 'deleteItem', { invoiceId: 'PP_QA_ISSUED', invoiceItemSeqId: '00001' }, shell);
            await post('EditPurchaseInvoice', 'deleteItem', { invoiceId: 'PP_QA_BILL_A', invoiceItemSeqId: 'FOREIGN' }, shell);
            await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_ISSUED', vendorInvoiceNumber: 'Blocked' }, shell);
            await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_BILL_B', vendorInvoiceNumber: 'Blocked' }, shell);
            check(shell + ' issued and foreign headers/lines unchanged', issued === hash(invoice('PP_QA_ISSUED')) && issuedLines === hash(lines('PP_QA_ISSUED')) && foreign === hash(invoice('PP_QA_BILL_B')) && foreignLines === hash(lines('PP_QA_BILL_B')));
            await post('EditPurchaseInvoice', 'deleteItem', { invoiceId: 'PP_QA_BILL_A', invoiceItemSeqId: lines('PP_QA_BILL_A').at(-1).invoice_item_seq_id }, shell);
            check(shell + ' exact draft deletion preserves other totals', lines('PP_QA_BILL_A').length === expectedCount && Number(totals('PP_QA_BILL_A').invoice_total) === 118.01 * expectedCount);
        }
        for(const shell of ['apps','qapps']) {
            await p.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=${cessBill.result.invoiceId}`,{waitUntil:'networkidle'});
            check(shell+' approved cess is visible in summary and tax-inclusive line total', (await p.locator('body').innerText()).includes('Cess Charged') && (await p.locator('body').innerText()).includes('CESS:') && (await p.locator('body').innerText()).includes('133.01'));
            const contrast=await p.locator('.vbill-itc-summary .text-success').first().evaluate(e=>{
                function luminance(color){const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
                const fg=luminance(getComputedStyle(e).color),bg=luminance(getComputedStyle(e.closest('.vbill-itc-summary')).backgroundColor);
                return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
            });
            check(shell+' tax summary values have readable contrast',contrast>=4.5,{contrast});
            const avatar=await p.locator('.zenith-avatar').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
            check(shell+' bill icon retains its square alignment',Math.abs(avatar.width-avatar.height)<1&&avatar.width>=48,avatar);
            for(const id of ['PP_QA_BILL_B','PP_QA_MISSING','PP_QA_SALES_CONTROL']) {
                const res=await p.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=${id}`,{waitUntil:'networkidle'});
                await p.getByRole('heading',{name:"That purchase invoice isn't part of your account.",exact:true}).waitFor();
                check(shell+' foreign/missing/wrong-type detail remains safe',res.status()===200&&!(await p.locator('body').innerText()).includes('Disposable foreign bill line'));
            }
            await ap.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=PP_QA_MISSING`,{waitUntil:'networkidle'});
            check(shell+' ADMIN missing detail renders safe notice',(await ap.locator('body').innerText()).includes("That purchase invoice isn't part of your account."));
            for(const [screen,heading] of [['FindPurchaseInvoice','Vendor Bills (ITC)'],['PurchaseInvoices','Purchase Invoices & GSTR-2B'],['CreatePurchaseInvoice','Log Vendor Bill'],['EditPurchaseInvoice?invoiceId=PP_QA_BILL_A','Vendor Bill: qapps verified metadata']]) {
                const res=await p.goto(`${base}/${shell}/zenith/Purchase/${screen}`,{waitUntil:'networkidle'});
                await p.getByRole('heading',{name:heading,exact:true}).waitFor();
                check(shell+' '+screen+' renders actual content',res.status()===200&&!/Error running actions|Error rendering screen/.test(await p.locator('body').innerText()));
                for(const width of [1366,768,390,360]) {
                    await p.setViewportSize({width,height:900});
                    await p.waitForFunction(()=>[...document.querySelectorAll('#z-sidebar,#zq-sidebar')].every(e=>e.getAnimations().every(a=>a.playState!=='running')));
                    const size=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
                    check(shell+' '+screen+' fits '+width,size.scroll<=size.client+2,size);
                    if(shell==='qapps') {
                        await p.waitForFunction(()=>{const h=document.querySelector('.q-header');return h&&Math.abs(h.offsetHeight-parseFloat(getComputedStyle(document.body).getPropertyValue('--zq-vbill-header-height')))<2});
                        const layout=await p.evaluate(()=>{const nodes=[...document.querySelectorAll('.q-header .q-toolbar>button,#zq-ownerview,#zq-search,#zq-toolbtns')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0).map(e=>e.getBoundingClientRect());let overlaps=0;for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(Math.min(nodes[i].right,nodes[j].right)-Math.max(nodes[i].left,nodes[j].left)>1&&Math.min(nodes[i].bottom,nodes[j].bottom)-Math.max(nodes[i].top,nodes[j].top)>1)overlaps++;return{overlaps,headingTop:document.querySelector('.zvbill-page h3').getBoundingClientRect().top,navBottom:document.querySelector('#zq-subnav').getBoundingClientRect().bottom}});
                        check(shell+' '+screen+' header controls do not overlap at '+width,layout.overlaps===0,layout);
                        check(shell+' '+screen+' heading clears navigation at '+width,layout.headingTop>=layout.navBottom-2,layout);
                    }
                }
                await p.screenshot({path:path.join(out,shell+'-'+screen.split('?')[0]+'-360.png'),fullPage:true});
                if(screen==='FindPurchaseInvoice'||screen==='PurchaseInvoices') {
                    await p.goto(`${base}/${shell}/zenith/Purchase/${screen}?toPartyId=PP_QA_B&invoiceTypeEnumId=InvoiceSales`,{waitUntil:'networkidle'});
                    await p.getByRole('heading',{name:heading,exact:true}).waitFor();
                    const body=await p.locator('body').innerText();check(shell+' '+screen+' forged list filters reveal only Purchase rows for own org',body.includes('qapps verified metadata')&&!body.includes('PP_QA_BILL_B')&&!body.includes('PP_QA_SALES_CONTROL')&&!body.includes('IRN Validated'));
                    const href=await p.locator('.zvbill-page .z-listchrome a[href*="renderMode=csv"]').first().getAttribute('href');const url=new URL(href,base);
                    // Quasar exports intentionally use the standalone /apps renderer, outside the SPA.
                    check(shell+' '+screen+' export stays on its disposable standalone route',url.origin===base&&url.pathname===`/apps/zenith/Purchase/${screen}`&&url.searchParams.get('lastStandalone')==='true',{href});url.searchParams.set('toPartyId','PP_QA_B');url.searchParams.set('invoiceTypeEnumId','InvoiceSales');exportUrls[shell+screen]=url.toString();
                    const csv=await ctx.request.get(url.toString());const text=await csv.text();
                    check(shell+' '+screen+' actual CSV preserves header and scoped records',csv.status()===200&&text.startsWith('ID,')&&text.includes('qapps verified metadata')&&!text.includes('PP_QA_BILL_B')&&!text.includes('PP_QA_SALES_CONTROL'),{header:text.split('\n')[0]});
                }
            }
            await p.goto(`${base}/${shell}/zenith/Purchase/EditPurchaseInvoice?invoiceId=PP_QA_ISSUED`,{waitUntil:'networkidle'});
            await p.getByRole('heading',{name:'Vendor Bill: PP_QA_ISSUED',exact:true}).waitFor();
            check(shell+' issued detail exposes no line or header write buttons',await p.getByRole('button',{name:/Add Item|Save Details|Update Status/}).count()===0);
        }
        await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: newBill, statusId: 'InvoiceReceived' });
        check('Valid receive workflow persists actual status', invoice(newBill)[0].status_id === 'InvoiceReceived');
        const gstr = await invoke('gstr2', { organizationPartyId: 'PP_QA_A', returnPeriod: '012026' });
        const registered = gstr.result.reportData.find(row => row.invoiceId === newBill);
        check('GSTR2 consumes actual Purchase grand with exact charged GST', !gstr.errors.length && registered && Number(registered.taxableValue) === 100.01 && Number(registered.cgst) === 9 && Number(registered.sgst) === 9, gstr);
        const gstr3b = await invoke('gstr3b', { organizationPartyId: 'PP_QA_A', returnPeriod: '012026' });
        check('GSTR3B includes purchased GST without round-off drift', !gstr3b.errors.length && Number(gstr3b.result.table4.cgst) === 18 && Number(gstr3b.result.table4.sgst) === 18, gstr3b);
        await post('VendorBillQaAcceptance', 'scope', { org: 'NONE' });
        const beforeNoOrg = hash(q('SELECT * FROM invoice ORDER BY invoice_id'));
        const noOrgLines=hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id'));
        await invoke('create', create); await invoke('item', item);
        for (const shell of ['apps', 'qapps']) {
            await post('EditPurchaseInvoice', 'addItem', { invoiceId: 'PP_QA_BILL_A', hsnSacCode: '998314', quantity: '1', amount: '1', taxPercentage: '0' }, shell);
            await post('EditPurchaseInvoice', 'updateInvoice', { invoiceId: 'PP_QA_BILL_A', vendorInvoiceNumber: 'No org' }, shell);
            for(const screen of ['FindPurchaseInvoice','PurchaseInvoices']) {
                const csv=await ctx.request.get(exportUrls[shell+screen]);const text=await csv.text();check(shell+' no-org '+screen+' exports headers and zero fixture rows',csv.status()===200&&text.startsWith('ID,')&&!text.includes('qapps verified metadata')&&!text.includes('PP_QA_BILL_B'));
            }
        }
        check('No-org requests cannot mutate fixture invoices', beforeNoOrg === hash(q('SELECT * FROM invoice ORDER BY invoice_id')) && noOrgLines===hash(q('SELECT * FROM invoice_item ORDER BY invoice_id,invoice_item_seq_id')));
        check('Sales control remains unchanged', sales === hash(invoice('PP_QA_SALES_CONTROL')));
        check('All invoices outside fixture ownership remain unchanged', outside === hash(q("SELECT * FROM invoice WHERE to_party_id NOT IN ('PP_QA_A','PP_QA_B','PP_QA_VENDOR_A') OR to_party_id IS NULL ORDER BY invoice_id")));
        await ctx.close(); ctx = null;
        r = await admin.request.post(base + '/apps/zenith/pricing/VendorBillQaAcceptance/cleanup', { form: { moquiSessionToken: adminToken } });
        check('Exact resolved fixture cleanup succeeds', r.status() === 200 && (await r.json()).removed > 0);
        for (const [table, where] of [['invoice', "to_party_id IN ('PP_QA_A','PP_QA_B','PP_QA_VENDOR_A')"], ['invoice_item', "invoice_id LIKE 'PP_QA_%'"], ['tax_line_detail', "reference_id LIKE 'PP_QA_%'"], ['india_party_tax_profile',"party_id LIKE 'PP_QA_%'"], ['india_gst_config', "organization_party_id LIKE 'PP_QA_%'"], ['party', "party_id LIKE 'PP_QA_%'"], ['product', "product_id LIKE 'PP_QA_%'"], ['user_account', "user_id='PP_QA_USER'"], ['order_header', "order_id LIKE 'PP_QA_%'"], ['order_part', "order_id LIKE 'PP_QA_%'"]]) check('Zero fixture residue ' + table, q(`SELECT count(*) n FROM ${table} WHERE ${where}`)[0].n === '0');
        check('Generated child and tax rows removed by captured invoice IDs', report.generated.every(id => lines(id).length === 0 && q(`SELECT count(*) n FROM tax_line_detail WHERE reference_id='${id}'`)[0].n === '0'));
        for(const [table,where] of [['party_role',"party_id LIKE 'PP_QA_%'"],['party_relationship',"party_relationship_id LIKE 'PP_QA_%'"],['person',"party_id LIKE 'PP_QA_%'"],['organization',"party_id LIKE 'PP_QA_%'"],['user_preference',"user_id='PP_QA_USER'"],['user_group_member',"user_id='PP_QA_USER'"],['company_settings',"organization_party_id LIKE 'PP_QA_%'"],['tax_registration',"registration_id LIKE 'PP_QA_%'"]]) check('Zero fixture residue '+table,q(`SELECT count(*) n FROM ${table} WHERE ${where}`)[0].n==='0');
        check('Outside invoices unchanged after cleanup', outside === hash(q("SELECT * FROM invoice WHERE to_party_id NOT IN ('PP_QA_A','PP_QA_B','PP_QA_VENDOR_A') OR to_party_id IS NULL ORDER BY invoice_id")));
    } catch (e) { report.failures.push(e.stack || e.message); process.exitCode = 1; }
    finally {
        if (ctx) await ctx.close(); if (admin) await admin.close(); await browser.close();
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, out }));
    }
})();
