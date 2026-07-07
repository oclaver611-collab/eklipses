// tests/test-seg11-logs.js — Navigate to segment 11 and capture audio logs
// Run: node tests/test-seg11-logs.js
const { chromium } = require('playwright');

const BASE = 'https://eklipses.vercel.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('[lesson]')) {
      const ts = new Date().toISOString().slice(11, 23);
      logs.push('[' + ts + '] ' + t);
      process.stdout.write('  LOG: ' + t + '\n');
    }
  });

  // Load app + bypass onboarding
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.removeItem('eklipses_lesson1_complete');
    localStorage.removeItem('eklipses_lesson1_progress');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#ek-start-btn').click();
  await page.locator('#ek-start-overlay').waitFor({ state: 'detached', timeout: 30000 });

  // Open lesson
  await page.locator('#ek-start-lesson1').click();
  await page.locator('#ek-lesson-player').waitFor({ state: 'visible', timeout: 10000 });

  // Wait for manifest to load
  await page.waitForFunction(() => {
    return window._lesson1Manifest !== undefined || true; // fallback
  });
  await page.waitForTimeout(2000); // let manifest load

  // Navigate to segment 11 via forward button (×11 clicks from seg 00)
  // The player starts at seg 00. We need to reach seg 11.
  // Segment IDs: 00, 01, 02, 02b, 03, 04, 05, 06, 07, 08, 09, 10, 11 = index 12
  console.log('\nNavigating to segment 11 (The Close)...');
  const fwdBtn = page.locator('#elp-fwd-btn');
  for (let i = 0; i < 12; i++) {
    await fwdBtn.click();
    await page.waitForTimeout(200);
  }

  // Verify we're on the right segment
  const segTitle = (await page.locator('#elp-seg-title').textContent().catch(() => '')).trim();
  console.log('Current segment:', segTitle);

  if (!segTitle.includes('Close')) {
    console.error('ERROR: Not on segment 11. Got:', segTitle);
    await browser.close();
    process.exit(1);
  }

  // Listen for all 8 files: 4 alex + 4 sofia
  const expected = [
    'alex_s11_01.mp3', 'sofia_s11_01.mp3',
    'alex_s11_02.mp3', 'sofia_s11_02.mp3',
    'alex_s11_03.mp3', 'sofia_s11_03.mp3',
    'alex_s11_04.mp3', 'sofia_s11_04.mp3',
  ];

  // Track which files started and ended
  const started = new Set();
  const ended   = new Set();
  const errored = new Set();

  const done = new Promise(resolve => {
    // Resolve once all 8 files have ended OR 90s elapses
    const check = () => {
      if (expected.every(f => ended.has(f) || errored.has(f))) resolve('complete');
    };
    setTimeout(() => resolve('timeout'), 90000);

    page.on('console', msg => {
      const t = msg.text();
      for (const f of expected) {
        if (t.includes('START') && t.includes(f)) { started.add(f); check(); }
        if (t.includes('END')   && t.includes(f)) { ended.add(f);   check(); }
        if ((t.includes('TIMEOUT') || t.includes('audio error')) && t.includes(f)) {
          errored.add(f); check();
        }
      }
    });
  });

  console.log('\nWaiting for segment 11 audio sequence (up to 90s)...\n');
  const reason = await done;

  console.log('\n' + '─'.repeat(60));
  console.log('Segment 11 — The Close — audio sequence report');
  console.log('─'.repeat(60));
  console.log('Exit reason:', reason);
  console.log('');

  for (const f of expected) {
    const s = started.has(f) ? '✓ START' : '✗ no START';
    const e = ended.has(f)   ? '✓ END'   : errored.has(f) ? '✗ ERROR/TIMEOUT' : '— not reached';
    console.log(`  ${f.padEnd(22)} ${s}   ${e}`);
  }

  console.log('\nAll captured [lesson] logs:');
  console.log('─'.repeat(60));
  logs.forEach(l => console.log(l));

  await browser.close();
}

run().catch(err => {
  console.error('Crashed:', err.message);
  process.exit(1);
});
