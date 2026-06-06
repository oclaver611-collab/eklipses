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
    // Navigate fresh for each test to avoid stale state
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for scenario options to be populated (renderShelf runs inside launchApp)
    await page.waitForFunction(
      () => (document.getElementById('scenarioSelect')?.options.length || 0) > 0,
      { timeout: 15000 }
    );

    // Select scenario (triggers playScenario via onchange)
    await page.selectOption('#scenarioSelect', key);

    // Wait for Ryan intro — "What do you do?" appears
    await page.waitForFunction(() => {
      const text = document.getElementById('lineText')?.textContent || '';
      return text.toLowerCase().includes('what do you do');
    }, { timeout: 40000 });

    // Capture text AFTER Ryan finishes
    const ryanText = await page.$eval('#lineText', el => el.textContent);

    // Simulate user speech by dispatching a custom event
    await page.evaluate(() => {
      const event = new CustomEvent('test:speech', { detail: { text: 'hi what is your name' } });
      window.dispatchEvent(event);
    });

    // Wait for character to respond — text must change from Ryan's last line
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
