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
  } catch (error) {
    error.message = `${surface} dashboard ${stage}: ${error.message}; URL=${page.url()}`;
    if (screenshot) await page.screenshot({ path: screenshot }).catch(() => {});
    throw error;
  }
}
