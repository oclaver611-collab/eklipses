const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://eklipses.vercel.app?dev=ek_dev_2026', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const sel = document.getElementById('scenarioSelect');
    return {
      selectOptions: sel ? Array.from(sel.options).map(o => o.value) : 'element missing',
      // Try calling renderShelf manually
      hasRenderShelf: typeof renderShelf !== 'undefined',
      // Check els object
      elsSelectId: typeof els !== 'undefined' ? (els.select ? els.select.id : 'els.select null') : 'els undefined',
      // Which screen is active?
      activeScreen: Array.from(document.querySelectorAll('[id]'))
        .filter(el => el.style.display !== 'none' && el.id)
        .map(el => el.id)
        .slice(0, 20),
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Try calling renderShelf and check again
  await page.evaluate(() => { if (typeof renderShelf !== 'undefined') renderShelf(); });
  await page.waitForTimeout(500);
  const optionsAfter = await page.$eval('#scenarioSelect', el => Array.from(el.options).map(o => o.value));
  console.log('Options after manual renderShelf:', optionsAfter.slice(0, 6));

  await browser.close();
})();
