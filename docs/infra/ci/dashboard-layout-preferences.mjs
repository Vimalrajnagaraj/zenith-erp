import assert from 'node:assert/strict';

// Form submissions can navigate the document or refresh the Quasar subscreen.
// Verify the real response and resulting preference, rather than requiring one transport.
export async function verifyDashboardLayout(page, base, surface, screenshot) {
  await page.goto(`${base}/${surface}/zenith/pos/Dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pos-dash-v2');
  await page.click('.pos-dash-customize');
  await page.waitForSelector('#pos-dash-settings');
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
      page.click(selector),
    ]);
    assert(response.status() < 400, `${surface}: preference POST returned ${response.status()}`);
  };
  await page.$eval('#pos-dash-settings [name="w_opsKpi"]', input => { input.checked = false; });
  await submit(paths.save, '#pos-dash-settings button[type="submit"]:not(.pos-dash-reset)');
  await page.waitForFunction(() => !!document.querySelector('.pos-dash-v2') && !document.querySelector('.pos-dash-secondary'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pos-dash-v2');
  assert.equal(await page.$('.pos-dash-secondary'), null, `${surface}: choice was not persisted`);
  await page.click('.pos-dash-customize');
  await page.waitForSelector('#pos-dash-settings');
  await submit(paths.reset, '#pos-dash-settings .pos-dash-reset');
  await page.waitForSelector('.pos-dash-secondary');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pos-dash-secondary');
  console.log(`PASS POS Customize Save/persist/Reset on /${surface}`);
}
