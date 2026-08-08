const puppeteer = require('C:/Users/ASUS/node_modules/puppeteer-core');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = process.argv[2];

function svg(N) {
  const r = Math.round(N * 0.22);          // corner radius ~ match old icon
  const fs = N * 0.42;                       // "ZC" cap height
  const ls = -(N * 0.028);                   // tight letter-spacing
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    svg{display:block}</style></head><body>
    <svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4A5EC"/>
        <stop offset="52%" stop-color="#6E56CF"/>
        <stop offset="100%" stop-color="#463D7A"/>
      </linearGradient></defs>
      <rect x="0" y="0" width="${N}" height="${N}" rx="${r}" ry="${r}" fill="url(#g)"/>
      <text x="${N/2}" y="${N/2}" fill="#ffffff" text-anchor="middle" dominant-baseline="central"
        font-family="'Segoe UI', Inter, -apple-system, Arial, sans-serif" font-weight="800"
        font-size="${fs}" letter-spacing="${ls}">ZC</text>
    </svg></body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox','--force-device-scale-factor=1'] });
  const page = await browser.newPage();
  for (const N of sizes) {
    await page.setViewport({ width: N, height: N, deviceScaleFactor: 1 });
    await page.setContent(svg(N), { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 150));
    await page.screenshot({ path: `${outDir}/icon-${N}x${N}.png`, omitBackground: true,
      clip: { x: 0, y: 0, width: N, height: N } });
    console.log('rendered', `icon-${N}x${N}.png`);
  }
  await browser.close();
})();
