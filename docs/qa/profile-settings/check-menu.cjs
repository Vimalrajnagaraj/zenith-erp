const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('component/zenith-erp-app/screen/zenithstatic/js/profile-menu.js', 'utf8');

for (const shell of ['apps', 'qapps']) {
  for (const admin of ['true', 'false', null]) {
    const events = {}, children = [];
    const avatar = { href: '/apps/my', setAttribute() {}, getBoundingClientRect: () => ({ right: 900, bottom: 50 }) };
    const document = {
      getElementById: () => admin === null ? null : { getAttribute: name => name === 'data-is-admin' ? admin : 'false' },
      createElement: () => ({ style: {}, offsetHeight: 160, setAttribute() {}, appendChild: link => children.push(link) }),
      addEventListener: (name, handler) => { events[name] = handler; },
      body: { appendChild() {} }
    };
    vm.runInNewContext(source, { document, location: { pathname: `/${shell}/zenith/sales/SalesDashboard` }, window: { innerWidth: 1000, innerHeight: 800, addEventListener() {} } });
    events.click({ target: { closest: () => avatar }, button: 0, detail: 1, preventDefault() {} });
    const settings = children.filter(link => link.textContent === 'Settings');
    assert.equal(settings.length, admin === 'true' ? 1 : 0);
    if (settings.length) assert.equal(settings[0].href, `/${shell}/zenith/Settings/Users`);
    assert(children.some(link => link.textContent === 'My Account' && link.href === '/apps/my'));
    assert(children.some(link => link.textContent === 'Logout' && link.href === '/Login/logout'));
  }
}
console.log('PASS: Settings is admin-only on both shells; account and logout routes retained.');
