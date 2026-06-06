const { chromium } = require('playwright');

const BASE_URL = 'https://eklipses.vercel.app?dev=ek_dev_2026';

const SCENARIOS = [
  { key: 'beach',       character: 'Sofia' },
  { key: 'bookstore',   character: 'Nadia' },
  { key: 'gym',         character: 'Zoe' },
  { key: 'train',       character: 'Erika' },
  { key: 'coffee_shop', character: 'Anna' },
  { key: 'house_party', character: 'Sarah' },
];

async function testScenario(page, key, character) {
  const start = Date.now();
  try {
    // Navigate fresh — set test mode before page scripts run
    await page.addInitScript(() => { window.__EKLIPSES_TEST_MODE = true; });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for scenario options — MutationObserver auto-clicks splash+onboarding buttons
    await page.waitForFunction(
      () => (document.getElementById('scenarioSelect')?.options.length || 0) > 0,
      { timeout: 20000 }
    );

    // Select scenario (triggers playScenario via onchange)
    await page.selectOption('#scenarioSelect', key);

    // Wait for listening pill to become visible (Ryan finished intro, mic is open)
    await page.waitForFunction(() => {
      const pill = document.getElementById('listenPill');
      if (!pill) return false;
      const style = window.getComputedStyle(pill);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, { timeout: 60000 });

    const ryanText = await page.$eval('#lineText', el => el.textContent);

    // Simulate user speech
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test:speech', { detail: { text: 'hi what is your name' } }));
    });

    // Wait for character to respond
    await page.waitForFunction((prev) => {
      const text = document.getElementById('lineText')?.textContent || '';
      return text !== prev && text.length > 10 && !text.toLowerCase().includes('what do you do');
    }, ryanText, { timeout: 30000 });

    const responseText = await page.$eval('#lineText', el => el.textContent);
    const elapsed = Date.now() - start;
    console.log(`✅ ${character} (${key}): "${responseText.slice(0, 60)}" [${elapsed}ms]`);
    return true;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${character} (${key}): TIMEOUT or ERROR [${elapsed}ms]`);
    return false;
  }
}

(async () => {
  console.log('Eklipses browser test\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();

  // Runs before page scripts — enables test mode and auto-clicks splash/onboarding buttons
  await page.addInitScript(() => {
    window.__EKLIPSES_TEST_MODE = true;
    const observer = new MutationObserver(() => {
      const startBtn = document.getElementById('ek-start-btn');
      if (startBtn) { startBtn.click(); }
      const obBtn = document.getElementById('ob-btn');
      if (obBtn) { obBtn.click(); }
    });
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  page.on('console', () => {});
  page.on('pageerror', e => console.error('[page error]', e.message.slice(0, 80)));

  let passed = 0;
  for (const { key, character } of SCENARIOS) {
    const ok = await testScenario(page, key, character);
    if (ok) passed++;
  }

  console.log(`\n${passed}/${SCENARIOS.length} scenarios passed`);
  await browser.close();
})();
