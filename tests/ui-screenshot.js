const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('https://eklipses.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });

  // Click start if overlay is present
  const startBtn = page.locator('#ek-start-btn');
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: 'tests/ui-screenshot.png', fullPage: true });
  console.log('[SCREENSHOT] Saved to tests/ui-screenshot.png');
  await browser.close();
})();
