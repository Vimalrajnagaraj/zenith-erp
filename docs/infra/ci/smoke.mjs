// Phase-1 render smoke for the ephemeral staging stack.
//
// Drives a running Moqui (default http://localhost:8080) as the demo admin and asserts a set of
// screens render on BOTH /apps and /qapps with HTTP 200 and no server-error signature in the HTML.
// Exits non-zero if any screen fails, so the CI job goes red. Report-only: it never touches prod.
//
// Usage:  node docs/infra/ci/smoke.mjs  [baseUrl]
// Env:    SMOKE_USER (default john.doe), SMOKE_PASS (default moqui)
//
// TODO (Phase 1 → later): beyond "does it render", add the real acceptance checks against seeded
// fixtures — org-isolation asserts (tenant A can't see B, via DB ground truth) and a MARUTHI-shaped
// billing no-op smoke (cash/card/split sale → bill mints, pricing/tax == golden baseline). Those
// need docs/infra/ci/seed/ fixtures and are the next increment.

import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const USER = process.env.SMOKE_USER || 'john.doe';
const PASS = process.env.SMOKE_PASS || 'moqui';

// Representative smoke set — paths are rendered on both surfaces where it makes sense.
// Keep this small and high-signal; it is a "did the build boot and render", not full coverage.
const PATHS = [
  '/apps/zenith',
  '/apps/zenith/Contacts/ContactsDashboard',
  '/apps/zenith/Contacts/FindContact',
  '/apps/zenith/Dashboard',
  '/qapps/zenith',
  '/qapps/zenith/Contacts/ContactsDashboard',
  '/qapps/zenith/Contacts/FindContact',
];

const ERR_SIG = /(java\.lang\.|groovy\.lang\.|org\.moqui\.\w+Exception|freemarker\.core|ScreenRenderException|Error rendering|500 Internal Server Error|HTTP Status 500)/i;
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
});

let failures = 0;
try {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ Authorization: AUTH });
  await page.setViewport({ width: 1400, height: 1000 });

  for (const path of PATHS) {
    let status = 0, errSig = false, note = '';
    try {
      const resp = await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
      status = resp ? resp.status() : 0;
      await sleep(3000); // let Vue/Quasar and any img-onload bootstraps paint
      const html = await page.content();
      errSig = ERR_SIG.test(html);
    } catch (e) {
      note = 'NAV ERROR: ' + e.message;
    }
    const ok = status === 200 && !errSig && !note;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${status || '---'}]${errSig ? ' <error-signature>' : ''}  ${path}${note ? '  ' + note : ''}`);
  }
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'SMOKE OK' : 'SMOKE FAILED'} — ${PATHS.length - failures}/${PATHS.length} screens rendered cleanly.`);
process.exit(failures === 0 ? 0 : 1);
