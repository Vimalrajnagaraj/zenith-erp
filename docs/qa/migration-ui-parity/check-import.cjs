const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('component/zenith-erp-app/screen/zenithstatic/js/pos-terminal.js', 'utf8');
const start = source.indexOf('    function piEsc(');
const helpers = source.slice(start, source.indexOf('    function g(id)', start));

(async () => {
  let field = { value: 'test-session' }, request, response = { ok: true, json: async () => ({ success: true }) };
  const context = { URLSearchParams, Promise, Error,
    document: { getElementById: () => field },
    window: {}, fetch: async (url, options) => { request = { url, options }; return response; } };
  vm.createContext(context); vm.runInContext(helpers, context);
  assert.equal(context.piTok(), 'test-session', '/apps reads the rendered session token');
  await context.piPost('ProductImport/importProducts', { csvText: 'a,b\n"x,y",z', blank: null });
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.body.get('moquiSessionToken'), 'test-session');
  assert.equal(request.options.body.get('csvText'), 'a,b\n"x,y",z');
  assert.equal(request.options.body.get('blank'), '');
  field = null;
  context.window.moqui = { webrootVue: { moquiSessionToken: 'test-vue-session' } };
  assert.equal(context.piTok(), 'test-vue-session', 'Quasar fallback retained');
  response = { ok: false, status: 403, json: () => { throw new Error('Must not parse HTML as JSON'); } };
  await assert.rejects(context.piPost('ProductImport/importProducts', {}), /HTTP 403/);
  context.window.moqui = null;
  request = null;
  await assert.rejects(context.piPost('ProductImport/importProducts', {}), /Refresh the page/);
  assert.equal(request, null, 'No unauthenticated write is sent');
  assert.equal(context.piEsc('<b>"&'), '&lt;b&gt;&quot;&amp;');
  console.log('PASS: native/Vue CSRF, POST encoding, missing session, HTTP errors and escaping.');
})().catch(error => { console.error(error); process.exitCode = 1; });
