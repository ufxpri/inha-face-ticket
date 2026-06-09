import pw from 'file:///C:/Users/ufxpri/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules/playwright/index.js';
const { chromium } = pw;

const out = process.env.SHOT_DIR || '.';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

async function shoot(path, file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`https://127.0.0.1:8000${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // let React/JSX mount
  await page.screenshot({ path: `${out}/${file}`, fullPage: false });
  console.log(`[${path}] -> ${file}  title="${await page.title()}"  consoleErrors=${errs.length}`);
  errs.slice(0, 5).forEach(e => console.log('   err:', e));
  await page.close();
}

await shoot('/admin', 'admin.png');
await shoot('/tablet', 'tablet.png');
await browser.close();
