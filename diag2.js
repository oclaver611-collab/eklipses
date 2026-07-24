const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push('[' + msg.type().toUpperCase() + '] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => {
    const url = req.url();
    if (!url.includes('favicon')) {
      consoleMessages.push('REQFAIL: ' + url + ' — ' + req.failure().errorText);
    }
  });

  console.log('Loading site...');
  await page.goto('https://eklipses.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click PRACTICE tab
  const practiceTab = await page.$('text=PRACTICE');
  if (practiceTab) {
    console.log('Clicking PRACTICE tab...');
    await practiceTab.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('PRACTICE tab not found');
  }

  // Find scenario cards
  const cards = await page.$$('.sc-card');
  console.log('Scenario cards found:', cards.length);

  if (cards.length > 0) {
    console.log('Clicking first card...');
    await cards[0].click();
    await page.waitForTimeout(3000);

    // Try Free Practice button
    const freeBtn = await page.$('button:has-text("Free Practice"), [class*="free"], [id*="free"]');
    if (freeBtn) {
      console.log('Clicking Free Practice...');
      await freeBtn.click();
      await page.waitForTimeout(8000);
    } else {
      // List all buttons
      const btns = await page.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => t));
      console.log('Buttons visible:', btns.join(' | '));
    }
  }

  console.log('\n=== ALL CONSOLE MESSAGES (last 40) ===');
  consoleMessages.slice(-40).forEach(m => console.log(m));
  console.log('\n=== PAGE ERRORS ===');
  errors.forEach(e => console.log(e));

  // Screenshot
  await page.screenshot({ path: 'C:/Users/serge/AppData/Local/Temp/claude/C--Users-serge/d9b4d713-b805-49d6-922a-3811600ae42e/scratchpad/diag_screen.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})().catch(e => console.error('Script error:', e.message));
