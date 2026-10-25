import assert from 'node:assert/strict';

// Form submissions can navigate the document or refresh the Quasar subscreen.
// Verify the real response and resulting preference, rather than requiring one transport.
export async function verifyDashboardLayout(page, base, surface, screenshot) {
  let stage = 'open dashboard';
  try {
    const ready = async () => {
      await page.waitForSelector('.pos-dash-v2');
      if (surface === 'qapps') await page.waitForFunction(() => document.documentElement.classList.contains('zq-nav-ready'));
    };
    // Locator clicks wait for the shared shell to finish moving the control.
    const click = selector => page.locator(selector).click();
    await page.goto(`${base}/${surface}/zenith/pos/Dashboard`, { waitUntil: 'domcontentloaded' });
    await ready();
    stage = 'open customization';
    await click('.pos-dash-customize');
    await page.waitForSelector('#pos-dash-settings', { visible: true });
    if (screenshot) await page.screenshot({ path: screenshot });
    const paths = await page.$eval('#pos-dash-settings', form => ({
      save: new URL(form.action).pathname,
      reset: new URL(form.querySelector('.pos-dash-reset').formAction).pathname,
    }));
    assert.equal(paths.save, `/${surface}/zenith/pos/Dashboard/saveDashLayout`);
    assert.equal(paths.reset, `/${surface}/zenith/pos/Dashboard/resetDashLayout`);
    const submit = async (path, selector) => {
      const [response] = await Promise.all([
        page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === path),
        click(selector),
      ]);
      assert(response.status() < 400, `${surface}: preference POST returned ${response.status()}`);
    };
    await page.$eval('#pos-dash-settings [name="w_opsKpi"]', input => { input.checked = false; });
    stage = 'save preference';
    await submit(paths.save, '#pos-dash-settings button[type="submit"]:not(.pos-dash-reset)');
    await page.waitForFunction(() => !!document.querySelector('.pos-dash-v2') && !document.querySelector('.pos-dash-secondary'));
    stage = 'reload saved preference';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    assert.equal(await page.$('.pos-dash-secondary'), null, `${surface}: choice was not persisted`);
    stage = 'reopen customization';
    await click('.pos-dash-customize');
    await page.waitForSelector('#pos-dash-settings', { visible: true });
    stage = 'reset preference';
    await submit(paths.reset, '#pos-dash-settings .pos-dash-reset');
    await page.waitForSelector('.pos-dash-secondary');
    stage = 'reload default preference';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    await page.waitForSelector('.pos-dash-secondary');
    console.log(`PASS POS Customize Save/persist/Reset on /${surface}`);
    stage = 'select This Week';
    const today = await page.$eval('.pos-dash-periods a', a => new URL(a.href).searchParams.get('dashDate'));
    const monday = new Date(today + 'T00:00:00Z');
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const from = monday.toISOString().slice(0, 10);
    const dateResponse = start => page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname.endsWith('/zenith/pos/Dashboard') &&
        url.searchParams.get('dashDate') === start && url.searchParams.get('dashDateTo') === today;
    });
    await Promise.all([dateResponse(from), click('.pos-dash-periods a:nth-child(2)')]);
    const rangeReady = async start => page.waitForFunction((first, last) =>
      document.querySelector('.pos-dash-range [name="dashDate"]')?.value === first &&
      document.querySelector('.pos-dash-range [name="dashDateTo"]')?.value === last &&
      document.querySelector('.pos-dash-chart svg')?.getAttribute('aria-label')?.includes(`sales from ${first} to ${last}`), {}, start, today);
    await rangeReady(from);
    stage = 'reload This Week';
    await page.reload({ waitUntil: 'networkidle2' });
    await rangeReady(from);
    stage = 'apply custom seven-day range';
    const sevenDays = new Date(today + 'T00:00:00Z');
    sevenDays.setUTCDate(sevenDays.getUTCDate() - 6);
    const customFrom = sevenDays.toISOString().slice(0, 10);
    await click('.pos-dash-range summary');
    await page.$eval('.pos-dash-range [name="dashDate"]', (input, value) => { input.value = value; }, customFrom);
    await Promise.all([dateResponse(customFrom), click('.pos-dash-range button[type="submit"]')]);
    await rangeReady(customFrom);
    await page.waitForFunction(() => new URL(location.href).searchParams.get('dateMode') === 'custom');
    assert.equal(new URL(page.url()).pathname, `/${surface}/zenith/pos/Dashboard`);
    console.log(`PASS POS This Week and custom seven-day range on /${surface}`);
  } catch (error) {
    error.message = `${surface} dashboard ${stage}: ${error.message}; URL=${page.url()}`;
    if (screenshot) await page.screenshot({ path: screenshot }).catch(() => {});
    throw error;
  }
}
