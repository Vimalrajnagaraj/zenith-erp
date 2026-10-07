const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const base = process.env.CGQA_BASE_URL || 'http://127.0.0.1:18080';
const url = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '18080') throw new Error('Only isolated loopback port 18080 is allowed');
const out = process.env.CGQA_OUTPUT_DIR ? path.resolve(process.env.CGQA_OUTPUT_DIR) : __dirname;
fs.mkdirSync(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [], viewports: [], frames: [] };
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); if (!pass) throw new Error(name); };
let browser;
(async () => {
  try {
    browser = await chromium.launch({ executablePath: process.env.CGQA_CHROME || undefined, headless: true });
    const page = await browser.newPage();
    await page.goto(base + '/Login');
    await page.locator('#login_form_organizationId').fill('CITEST_ORG_A');
    await page.locator('#login_form_username').fill(process.env.CGQA_USERNAME || 'john.doe');
    await page.locator('#login_form input[name="password"]').fill(process.env.CGQA_PASSWORD || 'moqui');
    await page.locator('#login_form button[type="submit"]').click();
    for (const shell of ['apps', 'qapps']) {
      for (const width of [1492, 1440, 800, 390, 320]) {
        await page.setViewportSize({ width, height: width >= 1440 ? 720 : 900 });
        await page.goto(`${base}/${shell}/zenith/Contacts/EditCustomerGroup?customerGroupId=CGQA_EMPTY_A`, { timeout: 90000 });
        await page.locator('.zecg-page').waitFor();
        await page.waitForTimeout(700);
        await page.waitForFunction(() => !document.querySelector('.q-notification'), undefined, { timeout: 10000 });
        const styles = await page.evaluate(() => {
          const root = document.querySelector('.zecg-page');
          const submit = root.querySelector('.zecg-form button[type="submit"]');
          const add = root.querySelector('.zecg-add-trigger');
          const qTrack = root.querySelector('.q-toggle__inner--truthy .q-toggle__track');
          const qThumb = root.querySelector('.q-toggle__thumb');
          const nativeThumb = root.querySelector('.cg-toggle-sw');
          const inputs = [...root.querySelectorAll('.q-field input.q-field__native,.q-field input.q-field__input')].filter(e => e.getBoundingClientRect().width);
          const type = [...root.querySelectorAll('.cg-summary-val')].find(e => e.textContent.trim() === 'Wholesale');
          const typeRange = document.createRange();
          typeRange.selectNodeContents(type);
          const summary = root.querySelector('.cg-summary-row');
          const summaryRect = summary.getBoundingClientRect();
          const summaryItems = [...summary.querySelectorAll('.cg-summary-item')];
          return {
            submitBg: getComputedStyle(submit).backgroundColor,
            addBg: getComputedStyle(add).backgroundColor, addColor: getComputedStyle(add).color,
            moreVisible: [...document.querySelectorAll('.zc-morenav')].some(e => e.getBoundingClientRect().width),
            qTrackBg: qTrack ? getComputedStyle(qTrack).backgroundColor : null,
            qTrackOpacity: qTrack ? getComputedStyle(qTrack).opacity : null,
            knobBg: getComputedStyle(qThumb || nativeThumb, '::after').backgroundColor,
            inputBorders: inputs.map(e => getComputedStyle(e).borderTopWidth),
            groupName: root.querySelector('[name="groupName"]').value,
            terms: root.querySelector('[name="paymentTerms"]').value,
            description: root.querySelector('[name="description"]').value,
            pageOverflow: root.scrollWidth - root.clientWidth,
            gridColumns: getComputedStyle(root.querySelector('.zecg-grid')).gridTemplateColumns.split(' ').length,
            summaryWithinCard: summaryItems.every(e => {
              const r = e.getBoundingClientRect();
              return r.left >= summaryRect.left - 1 && r.right <= summaryRect.right + 1;
            }),
            summaryItemGaps: summaryItems.map(e => getComputedStyle(e).gap),
            summaryIconWidths: [...summary.querySelectorAll('.cg-summary-ico')].map(e => e.getBoundingClientRect().width),
            typeText: type.textContent.trim(),
            typeLineHeight: parseFloat(getComputedStyle(type).lineHeight),
            typeTextHeight: typeRange.getBoundingClientRect().height,
            typeTextLineRects: [...typeRange.getClientRects()].map(r => ({ width: r.width, height: r.height, top: r.top }))
          };
        });
        const tag = `${shell} ${width}`;
        check(tag + ': purple submit', styles.submitBg === 'rgb(117, 67, 232)', styles.submitBg);
        check(tag + ': white/purple Add Member', styles.addBg === 'rgb(255, 255, 255)' && styles.addColor === 'rgb(116, 85, 187)', { bg: styles.addBg, color: styles.addColor });
        check(tag + ': More hidden', !styles.moreVisible, styles.moreVisible);
        check(tag + ': white Active knob', styles.knobBg === 'rgb(255, 255, 255)', styles.knobBg);
        check(tag + ': clean reference fixture', styles.groupName === 'Import' && !styles.terms && !styles.description, { name: styles.groupName, terms: styles.terms, description: styles.description });
        check(tag + ': no page overflow', styles.pageOverflow <= 1, styles.pageOverflow);
        check(tag + ': responsive card columns', styles.gridColumns === (width < 1024 ? 1 : 2), styles.gridColumns);
        check(tag + ': summary items stay within card', styles.summaryWithinCard, styles.summaryWithinCard);
        check(tag + ': summary spacing preserves desktop and fits mobile', styles.summaryItemGaps.every(g => g === (width < 600 ? '8px' : '14px')) && styles.summaryIconWidths.every(w => Math.abs(w - (width < 600 ? 40 : 46)) < 1), { gaps: styles.summaryItemGaps, iconWidths: styles.summaryIconWidths });
        check(tag + ': Wholesale text stays on one line', styles.typeText === 'Wholesale' && styles.typeTextHeight <= styles.typeLineHeight + 1, { text: styles.typeText, height: styles.typeTextHeight, lineHeight: styles.typeLineHeight, rects: styles.typeTextLineRects });
        if (shell === 'qapps') {
          check(tag + ': solid purple track', styles.qTrackBg === 'rgb(117, 67, 232)' && styles.qTrackOpacity === '1', { bg: styles.qTrackBg, opacity: styles.qTrackOpacity });
          check(tag + ': zero input inner borders', styles.inputBorders.every(b => b === '0px'), styles.inputBorders);
        }
        report.viewports.push({ shell, width, height: width >= 1440 ? 720 : 900, styles });
        if (width === 1492 || width === 320) {
          const filename = `${shell}-${width === 1492 ? 'desktop' : 'mobile'}.png`;
          const captureHeight = width === 1492 ? 720 : 1400;
          if (width === 320) {
            await page.setViewportSize({ width, height: captureHeight });
            await page.waitForTimeout(300);
          }
          await page.screenshot({ path: path.join(out, filename), fullPage: false });
          report.frames.push({ shell, width, height: captureHeight, screenshot: filename });
        }
      }
    }
    if (process.env.CGQA_SOURCE_DIR && process.env.CGQA_RUNTIME_DIR) {
      const files = [
        'component/zenith-erp-contacts/screen/zenith/contacts/Contacts/EditCustomerGroup.xml',
        'component/zenith-erp-app/screen/zenithstatic/css/edit-customer-group.css',
        'component/zenith-erp-app/screen/zenithstatic/js/cpe-tabs.js',
        'component/zenith-erp-app/screen/zenith/ZenithApp.xml'
      ];
      const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const parity = { capturedAt: new Date().toISOString(), files: files.map(file => {
        const sourceSha = sha(path.join(process.env.CGQA_SOURCE_DIR, file));
        const runtimeSha = sha(path.join(process.env.CGQA_RUNTIME_DIR, 'runtime', file));
        check('Overlay parity: ' + file, sourceSha === runtimeSha, { sourceSha, runtimeSha });
        return { path: file, sourceSha256: sourceSha, runtimeSha256: runtimeSha, match: sourceSha === runtimeSha };
      }) };
      fs.writeFileSync(path.join(out, 'final-overlay-parity.json'), JSON.stringify(parity, null, 2));
    }
    report.completed = true;
  } catch (e) {
    report.completed = false; report.failure = e.message;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'visual-checks.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    console.log(JSON.stringify({ completed: report.completed, passed: report.checks.filter(c => c.pass).length, failed: report.checks.filter(c => !c.pass).length, failure: report.failure || null }));
    if (!report.completed) process.exitCode = 1;
  }
})();
