// Disposable staging only: verify POS customization, account links and Remember Me.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { establishSession } from './session.mjs';

const base = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const url = new URL(base);
assert.equal(url.protocol, 'http:');
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '8080');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await establishSession(page, base, 'john.doe', 'moqui');
  for (const surface of ['apps', 'qapps']) {
    const dashboard = `${base}/${surface}/zenith/pos/Dashboard`;
    await page.goto(dashboard, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.pos-dash-v2');
    await page.click('.pos-dash-customize');
    await page.waitForSelector('#pos-dash-settings');
    if (surface === 'apps') await page.screenshot({ path: join(process.env.RUNNER_TEMP || process.cwd(), 'pos-dashboard-customize-ci.png') });
    const paths = await page.$eval('#pos-dash-settings', form => ({
      save: new URL(form.action).pathname,
      reset: new URL(form.querySelector('.pos-dash-reset').formAction).pathname,
    }));
    assert.equal(paths.save, `/${surface}/zenith/pos/Dashboard/saveDashLayout`);
    assert.equal(paths.reset, `/${surface}/zenith/pos/Dashboard/resetDashLayout`);
    await page.$eval('#pos-dash-settings [name="w_opsKpi"]', input => { input.checked = false; });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('#pos-dash-settings button[type="submit"]:not(.pos-dash-reset)')]);
    assert.equal(await page.$('.pos-dash-secondary'), null, `${surface}: operations remained visible after Save`);
    await page.reload({ waitUntil: 'networkidle2' });
    assert.equal(await page.$('.pos-dash-secondary'), null, `${surface}: choice was not persisted`);
    await page.click('.pos-dash-customize');
    await page.waitForSelector('#pos-dash-settings');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('#pos-dash-settings .pos-dash-reset')]);
    assert(await page.$('.pos-dash-secondary'), `${surface}: Reset did not restore role defaults`);
    console.log(`PASS POS Customize Save/persist/Reset on /${surface}`);
  }

  // The fixture user has no MY_ACCOUNT_USERS membership. Header destinations
  // must open the own-user workspace, without granting access to SimpleScreens.
  const staff = await browser.newPage();
  await establishSession(staff, base, 'citest.a', 'moqui');
  await staff.goto(`${base}/qapps/zenith`, { waitUntil: 'networkidle2' });
  await staff.waitForSelector('#zq-toolbtns');
  const links = await staff.$$eval('#zq-toolbtns a[href]', nodes => nodes.map(a => ({ label: a.getAttribute('aria-label'), href: a.getAttribute('href') })));
  for (const label of ['My Password', 'Notifications', 'Messages', 'Events This Week', 'Open Tasks', 'My account']) {
    const link = links.find(item => item.label === label || item.label?.endsWith(`— ${label}`));
    assert(link, `Missing account action: ${label}`);
    if (label !== 'My Password') assert(link.href.startsWith('/apps/zenith/MyWorkspace?section='));
    const response = await staff.goto(base + link.href, { waitUntil: 'networkidle2' });
    assert.equal(response?.status(), 200, `${label}: HTTP ${response?.status()}`);
    assert(!staff.url().includes('/Login'), `${label}: redirected to login`);
    const body = await staff.$eval('body', node => node.innerText);
    assert(!/not authorized|permission denied|screen render exception/i.test(body), `${label}: authorization/render error`);
    assert(!body.includes("We couldn't load this account activity"), `${label}: account data did not load`);
    await staff.goto(`${base}/qapps/zenith`, { waitUntil: 'networkidle2' });
    await staff.waitForSelector('#zq-toolbtns');
  }
  await staff.goto(`${base}/apps/zenith/pos/Dashboard`, { waitUntil: 'networkidle2' });
  await staff.waitForSelector('#z-avatar');
  const appsAccountLinks = await staff.$$eval('#navbar-buttons a[href]', nodes => nodes.map(a => a.getAttribute('href')));
  for (const section of ['notifications', 'messages', 'calendar', 'tasks', 'account']) {
    assert(appsAccountLinks.some(href => href?.includes(`MyWorkspace?section=${section}`)), `/apps header missing ${section}`);
  }
  await staff.goto(`${base}/qapps/zenith`, { waitUntil: 'networkidle2' });
  await staff.waitForSelector('#zq-toolbtns');
  await staff.screenshot({ path: join(process.env.RUNNER_TEMP || process.cwd(), 'account-toolbar-ci.png') });
  const themeRect = await staff.$eval('#zq-toolbtns [aria-label="Switch Dark / Light"]', node => {
    const rect = node.getBoundingClientRect();
    const describe = element => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { tag: element.tagName, id: element.id, className: element.className,
        display: style.display, visibility: style.visibility, width: bounds.width, height: bounds.height };
    };
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewport: innerWidth,
      bodyClass: document.body.className,
      ancestors: [node, node.parentElement, node.parentElement?.parentElement, node.closest('.q-header')].filter(Boolean).map(describe),
      toolbars: [...document.querySelectorAll('.q-header .q-toolbar')].map(describe) };
  });
  assert(themeRect.width > 0 && themeRect.x >= 0 && themeRect.x + themeRect.width <= themeRect.viewport,
    `Theme control is outside the viewport: ${JSON.stringify(themeRect)}`);
  await staff.click('#zq-toolbtns [aria-label="Switch Dark / Light"]');
  assert(await staff.$eval('body', node => node.classList.contains('body--dark')));
  await staff.reload({ waitUntil: 'networkidle2' });
  assert(await staff.$eval('body', node => node.classList.contains('body--dark')), 'Theme did not persist');
  await staff.click('#zq-toolbtns [aria-label="Switch Dark / Light"]');
  console.log('PASS shared account destinations and persisted theme for staff');

  const postLogin = async remember => {
    const body = new URLSearchParams({ organizationId: 'CITEST_A', username: 'citest.a', password: 'moqui', rememberMeSubmitted: 'Y' });
    if (remember) body.set('rememberMe', 'true');
    const response = await fetch(`${base}/Login/login`, { method: 'POST', body, redirect: 'manual' });
    assert(response.status >= 300 && response.status < 400, `Login returned ${response.status}`);
    return response.headers.getSetCookie().find(value => value.startsWith('moquiLoginKey='));
  };
  const rememberCookie = await postLogin(true);
  assert(rememberCookie?.includes('HttpOnly') && /Max-Age=2592000/i.test(rememberCookie), 'Remember Me did not issue a persistent HttpOnly key');
  const key = rememberCookie.split(';')[0];
  const resumed = await fetch(`${base}/Login`, { headers: { Cookie: key }, redirect: 'manual' });
  assert(resumed.status >= 300 && resumed.status < 400, 'Remembered key did not resume login');
  assert(resumed.headers.get('location')?.includes('/qapps/zenith/Dashboard'));
  const forgotten = await postLogin(false);
  assert(forgotten && /Max-Age=0/i.test(forgotten), 'Unchecked Remember Me did not clear the old browser key');
  const invalid = await fetch(`${base}/Login`, { headers: { Cookie: 'moquiLoginKey=invalid' }, redirect: 'manual' });
  assert.equal(invalid.status, 200, 'Invalid key did not return to login');
  assert(invalid.headers.getSetCookie().some(value => value.startsWith('moquiLoginKey=') && /Max-Age=0/i.test(value)));
  console.log('PASS Remember Me issue/resume/clear/invalid-key cases');
} finally {
  await browser.close();
}
