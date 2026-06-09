const { chromium } = require('playwright');
const BASE_URL = 'https://eklipses.vercel.app?dev=ek_dev_2026';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();

  await page.addInitScript(() => { window.__EKLIPSES_TEST_MODE = true; });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Poll every 500ms for 15s to watch launchApp progress
  let last = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      options: document.getElementById('scenarioSelect')?.options.length,
      lineText: document.getElementById('lineText')?.textContent?.trim().slice(0, 60),
      testMode: window.__EKLIPSES_TEST_MODE,
    }));
    const s = JSON.stringify(state);
    if (s !== last) {
      console.log(`[${((i+1)*0.5).toFixed(1)}s]`, state);
      last = s;
    }
  }

  await browser.close();
})();
