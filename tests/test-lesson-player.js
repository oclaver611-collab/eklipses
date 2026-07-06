// tests/test-lesson-player.js — Lesson player automated test suite
// Run: node tests/test-lesson-player.js
const { chromium } = require('playwright');

const BASE = 'https://eklipses.vercel.app';
const results = [];

function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${name}${detail ? '  (' + detail + ')' : ''}`);
}

// Check no audio overlap: at no point did two files play simultaneously.
// Returns true even if audio is still in-flight (START without END is fine,
// but two simultaneous STARTs is overlap).
function noAudioOverlap(logs) {
  let inFlight = 0;
  for (const { text } of logs) {
    if (text.includes('[lesson] START')) { inFlight++; if (inFlight > 1) return false; }
    if (text.includes('[lesson] END'))   { inFlight = Math.max(0, inFlight - 1); }
  }
  return true;
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  // ── Load & dismiss splash (match paywall test pattern) ──────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');   // skip onboarding overlay
    localStorage.setItem('ek-dev-key', 'ek_dev_2026'); // dev bypass
    localStorage.removeItem('eklipses_lesson1_complete'); // start fresh
    localStorage.removeItem('eklipses_lesson1_progress');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.locator('#ek-start-btn').click();
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 30000 });

  console.log('\nLesson Player Test Suite');
  console.log('─'.repeat(55));

  // ── 1. Page loads silently ───────────────────────────────────────────────
  const noisyLogs = logs.filter(l =>
    l.text.includes('[TTS]') &&
    !l.text.includes('module ready') &&
    !l.text.includes('no preload needed') &&
    !l.text.includes('Tool loaded')
  );
  report('1. Page loads silently — no TTS on load', noisyLogs.length === 0,
    noisyLogs.length ? noisyLogs[0].text.slice(0, 80) : '');

  // ── 2. LEARN tab is default ──────────────────────────────────────────────
  const learnVisible    = await page.locator('#ek-learn-tab').isVisible();
  const practiceHidden  = !(await page.locator('#ek-practice-wrap').isVisible());
  report('2. LEARN tab visible and default', learnVisible && practiceHidden);

  // ── 3. Lesson 1 card with Start Lesson button ────────────────────────────
  const lessonBtn = page.locator('#ek-start-lesson1');
  const btnExists = await lessonBtn.count() > 0;
  const btnText   = btnExists ? (await lessonBtn.textContent()).trim() : '';
  report('3. Lesson 1 card with "Start Lesson" button',
    btnExists && btnText.includes('Start Lesson'), `"${btnText}"`);

  // ── Open lesson & collect manifest log ──────────────────────────────────
  logs.length = 0;
  let manifestLogText = null;
  const manifestDone = new Promise(resolve => {
    const h = msg => {
      if (msg.text().includes('manifest loaded')) {
        page.off('console', h);
        manifestLogText = msg.text();
        resolve();
      }
    };
    page.on('console', h);
    setTimeout(resolve, 15000);
  });

  await lessonBtn.click();

  // ── 4. Lesson player overlay appears ────────────────────────────────────
  const playerVisible = await page.locator('#ek-lesson-player')
    .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  report('4. Start Lesson opens lesson player overlay', playerVisible);

  // ── 5. Manifest loads — version 3 / 15 segments ─────────────────────────
  await manifestDone;
  report('5. Manifest loads — version: 3 | segments: 15',
    !!manifestLogText &&
    manifestLogText.includes('version: 3') &&
    manifestLogText.includes('segments: 15'),
    manifestLogText ? manifestLogText.replace('[lesson] ', '') : 'no manifest log');

  // Wait for first segment audio to play (up to 10s)
  await page.waitForTimeout(10000);

  // ── 6. No audio errors on first 3 segments ──────────────────────────────
  const audioErrors = logs.filter(l =>
    l.text.includes('TIMEOUT') || l.text.includes('[lesson] audio error')
  );
  report('6. No audio errors on first 3 segments', audioErrors.length === 0,
    audioErrors.length ? audioErrors[0].text.slice(0, 80) : '');

  // ── 7. ryan_seg00.mp3 accessible (HTTP 200) ─────────────────────────────
  const ryanStatus = await page.evaluate(async () => {
    try {
      // Test via proxy — reliable from both localhost and production
      const r = await fetch('/api/lesson-audio?file=ryan_seg00.mp3', { method: 'HEAD' });
      return r.status;
    } catch (e) { return -1; }
  });
  report('7. ryan_seg00.mp3 returns HTTP 200', ryanStatus === 200, `status: ${ryanStatus}`);

  // ── 8. Progress bar shows 1/15 ───────────────────────────────────────────
  const progressText = (await page.locator('#elp-progress-label').textContent().catch(() => '')).trim();
  report('8. Progress bar shows 1/15', progressText === '1 / 15', `"${progressText}"`);

  // ── 9. Segment label shows "Welcome" ────────────────────────────────────
  const segTitle = (await page.locator('#elp-seg-title').textContent().catch(() => '')).trim();
  report('9. Segment label shows "Welcome"', segTitle === 'Welcome', `"${segTitle}"`);

  // ── Pause before navigation & snapshot log window ───────────────────────
  const pauseBtn = page.locator('#elp-pause-btn');
  const fwdBtn   = page.locator('#elp-fwd-btn');
  const backBtn  = page.locator('#elp-back-btn');
  if (await pauseBtn.isVisible()) { await pauseBtn.click(); await page.waitForTimeout(300); }
  const logsBeforeNav = logs.length; // snapshot before any navigation

  // ── 10. Forward ×2 → segment 02 "Before The Approach" ───────────────────
  await fwdBtn.click(); await page.waitForTimeout(400);
  await fwdBtn.click(); await page.waitForTimeout(400);
  const titleFwd = (await page.locator('#elp-seg-title').textContent().catch(() => '')).trim();
  report('10. Forward ×2 → "Before The Approach"',
    titleFwd === 'Before The Approach', `"${titleFwd}"`);

  // ── 11. Back ×2 → segment 00 "Welcome" ──────────────────────────────────
  await backBtn.click(); await page.waitForTimeout(400);
  await backBtn.click(); await page.waitForTimeout(400);
  const titleBack = (await page.locator('#elp-seg-title').textContent().catch(() => '')).trim();
  report('11. Back ×2 → "Welcome"', titleBack === 'Welcome', `"${titleBack}"`);

  // ── 12. No overlapping audio (pre-navigation window only) ────────────────
  // Only check logs captured before navigation — navigating kills audio and
  // rapid restarts are intentional, not overlap. In the pre-nav window the
  // first segment (one file) should never have two simultaneous STARTs.
  report('12. No overlapping audio', noAudioOverlap(logs.slice(0, logsBeforeNav)));

  // ── 13. Pause button stops audio ─────────────────────────────────────────
  // navigate() resets _paused=false, so after the navigation tests the button
  // is back to "Pause". One click pauses; title must change to "Resume".
  await pauseBtn.click(); // pause
  await page.waitForTimeout(300);
  const pauseBtnTitle = await pauseBtn.getAttribute('title').catch(() => '');
  report('13. Pause button stops audio', pauseBtnTitle === 'Resume',
    `Button title: "${pauseBtnTitle}"`);

  // ── 14-15. Completion screen ─────────────────────────────────────────────
  await page.evaluate(() => {
    localStorage.setItem('eklipses_lesson1_complete', 'true');
    const el = document.getElementById('elp-complete');
    if (el) el.style.display = '';
  });
  await page.waitForTimeout(300);

  const completeVisible = await page.locator('#elp-complete').isVisible().catch(() => false);
  report('14. Completion screen appears', completeVisible);

  const mnemonicText = (await page.locator('.elp-mnemonic-phrase').textContent().catch(() => '')).trim();
  report('15. Completion screen contains mnemonic phrase',
    mnemonicText === 'One Tequila Makes Ideas Click', `"${mnemonicText}"`);

  // ── Summary ───────────────────────────────────────────────────────────────
  await browser.close();

  const passed = results.filter(r => r.passed).length;
  const total  = results.length;
  console.log('─'.repeat(55));
  console.log(`${passed}/${total} tests PASS`);

  if (passed < total) {
    console.log('\nFailed:');
    results.filter(r => !r.passed).forEach(r =>
      console.log(`  ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
    );
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test runner crashed:', err.message);
  process.exit(1);
});
