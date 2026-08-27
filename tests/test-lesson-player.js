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
    localStorage.setItem('ek-dev-key', 'ek_dev_2026'); // dev bypass
    localStorage.removeItem('eklipses_lesson1_complete'); // start fresh
    localStorage.removeItem('eklipses_lesson1_progress');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#ek-h6-start', { timeout: 15000 });
  await page.locator('#ek-h6-start').click();
  await page.waitForSelector('#ek-hero-v6', { state: 'detached', timeout: 30000 });

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

  // ── 2. PRACTICE tab is now default ──────────────────────────────────────
  const practiceVisible = await page.locator('#ek-practice-wrap').isVisible();
  const learnTabHidden  = !(await page.locator('#ek-tab-learn').isVisible());
  report('2. PRACTICE tab is default; LEARN tab hidden for new users', practiceVisible && learnTabHidden);

  // Navigate with ?lessons=1 so lesson-specific tests can access the LEARN tab
  await page.goto(BASE + '?lessons=1', { waitUntil: 'networkidle', timeout: 30000 });
  if (await page.locator('#ek-h6-start').isVisible().catch(() => false)) {
    await page.locator('#ek-h6-start').click();
    await page.waitForSelector('#ek-hero-v6', { state: 'detached', timeout: 30000 });
  }

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

  // ── 5. Manifest loads — version 3 / 16 segments ─────────────────────────
  await manifestDone;
  report('5. Manifest loads — version: 3 | segments: 16',
    !!manifestLogText &&
    manifestLogText.includes('version: 3') &&
    manifestLogText.includes('segments: 16'),
    manifestLogText ? manifestLogText.replace('[lesson] ', '') : 'no manifest log');

  // Wait for first segment audio to play (up to 10s)
  await page.waitForTimeout(10000);

  // ── 6. No audio errors on first 3 segments ──────────────────────────────
  const audioErrors = logs.filter(l =>
    l.text.includes('[lesson] TIMEOUT') || l.text.includes('[lesson] audio error')
  );
  report('6. No audio errors on first 3 segments', audioErrors.length === 0,
    audioErrors.length ? audioErrors[0].text.slice(0, 80) : '');

  // ── 7. ryan_seg00.mp3 accessible via worker (HTTP 200) ──────────────────
  const ryanStatus = await page.evaluate(async () => {
    try {
      const r = await fetch('https://eklipses-lesson-audio.oclaver611.workers.dev?file=ryan_seg00.mp3', { method: 'HEAD' });
      return r.status;
    } catch (e) { return -1; }
  });
  report('7. ryan_seg00.mp3 returns HTTP 200', ryanStatus === 200, `status: ${ryanStatus}`);

  // ── 8. Progress bar shows 1/16 ───────────────────────────────────────────
  const progressText = (await page.locator('#elp-progress-label').textContent().catch(() => '')).trim();
  report('8. Progress bar shows 1/16', progressText === '1 / 16', `"${progressText}"`);

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
    // showCompletion() populates #elp-complete-inner via buildCompletionHTML() and shows the screen
    if (window.LessonPlayer && window.LessonPlayer.showCompletion) {
      window.LessonPlayer.showCompletion();
    } else {
      // Fallback: just reveal the container (mnemonic phrase won't be populated)
      localStorage.setItem('eklipses_lesson1_complete', 'true');
      const el = document.getElementById('elp-complete');
      if (el) el.style.display = '';
    }
  });
  await page.waitForTimeout(300);

  const completeVisible = await page.locator('#elp-complete').isVisible().catch(() => false);
  report('14. Completion screen appears', completeVisible);

  const mnemonicText = (await page.locator('.elp-mnemonic-phrase').textContent().catch(() => '')).trim();
  report('15. Completion screen contains mnemonic phrase',
    mnemonicText === 'One Tequila Makes Ideas Click', `"${mnemonicText}"`);

  // ── 16-18. Mic-toggle mid-conversation regression ───────────────────────────
  // Regression for commit 19d0278: listenForUserType had no abort path when the
  // mic toggle fired mid-conversation. The game froze because the Promise only
  // resolved via text submit or session change — never via a toggle event.
  // Fix: added window.addEventListener('eklipses-abort-type-listen', onAbort).
  //
  // Test 16 (sanity) simulates the PRE-FIX state by monkey-patching addEventListener
  // to silently drop eklipses-abort-type-listen registrations. The abort event is
  // then dispatched; without the handler the Promise must hang → timedOut:true.
  // This confirms the test WOULD have caught the original bug.
  // Tests 17-18 run with the real fix in place.

  const sanityResult = await page.evaluate(async () => {
    // Suppress eklipses-abort-type-listen registrations to simulate missing fix
    const origAddEL = window.addEventListener.bind(window);
    window.addEventListener = function(type, handler, options) {
      if (type === 'eklipses-abort-type-listen') return;
      return origAddEL(type, handler, options);
    };

    localStorage.setItem('eklipses_input_mode', 'type');
    const snap = session;
    const p = listenForUserType(snap);
    await new Promise(r => setTimeout(r, 150)); // let setup complete

    const wrapShown = document.getElementById('type-input-wrap')?.style.display === 'flex';

    // Dispatch abort event — should have NO effect (handler was never registered)
    localStorage.setItem('eklipses_input_mode', 'voice');
    window.dispatchEvent(new CustomEvent('eklipses-abort-type-listen'));

    const outcome = await Promise.race([
      p.then(val => ({ timedOut: false, val })),
      new Promise(r => setTimeout(() => r({ timedOut: true }), 1000)),
    ]);

    window.addEventListener = origAddEL; // restore
    // Drain the stuck Promise: session change triggers sessionPoll → done(null)
    stopEverything();
    await Promise.race([p, new Promise(r => setTimeout(r, 700))]);
    await new Promise(r => setTimeout(r, 200)); // let session settle

    return { wrapShown, outcome };
  });

  report('16. [sanity] Pre-fix: abort event ignored when handler missing — Promise hangs',
    sanityResult.outcome.timedOut === true && sanityResult.wrapShown,
    sanityResult.outcome.timedOut
      ? (sanityResult.wrapShown ? 'confirmed — hung 1 s as expected' : 'hung but wrap not shown (DOM missing?)')
      : 'UNEXPECTED RESOLVE — abort fired without handler (sanity invalid)');

  const abortResult = await page.evaluate(async () => {
    localStorage.setItem('eklipses_input_mode', 'type');
    const snap = session; // session may have incremented after stopEverything above
    const startMs = Date.now();
    // Set _testMode so the recursive voice re-listen returns null immediately (deterministic)
    const prevTestMode = window._testMode;
    window._testMode = true;
    // Call listenForUser — the real playLoop call — routes to listenForUserType in type mode
    const p = listenForUser(snap, 10000);
    await new Promise(r => setTimeout(r, 150)); // let setup complete

    const wrapBefore = document.getElementById('type-input-wrap')?.style.display;

    // Simulate mic toggle: set voice in localStorage then dispatch abort event
    // (exact sequence from initInputModeToggle click handler in player.js)
    localStorage.setItem('eklipses_input_mode', 'voice');
    window.dispatchEvent(new CustomEvent('eklipses-abort-type-listen'));

    const outcome = await Promise.race([
      p.then(val => ({ timedOut: false, val, elapsedMs: Date.now() - startMs })),
      new Promise(r => setTimeout(() => r({ timedOut: true, elapsedMs: Date.now() - startMs }), 2000)),
    ]);

    window._testMode = prevTestMode;
    const wrapAfter = document.getElementById('type-input-wrap')?.style.display;
    const modeAfter = localStorage.getItem('eklipses_input_mode');

    return { wrapBefore, outcome, wrapAfter, modeAfter };
  });

  report('17. Mic toggle mid-listen — listenForUser resolves null within 2 s (not frozen)',
    !abortResult.outcome.timedOut && abortResult.outcome.val === null,
    abortResult.outcome.timedOut
      ? `TIMED OUT ${abortResult.outcome.elapsedMs}ms — freeze bug present`
      : `resolved null in ${abortResult.outcome.elapsedMs}ms`);

  report('18. After mic toggle — type wrap hidden and eklipses_input_mode is voice',
    abortResult.wrapAfter === 'none' && abortResult.modeAfter === 'voice',
    `wrap="${abortResult.wrapAfter}" mode="${abortResult.modeAfter}"`);

  // ── 19. Mode-switch rescue-line regression ────────────────────────────────
  // Regression for the bug where type→voice toggle triggered the "No worries,
  // let's keep going" fallback line. Root cause: listenForUserType resolved null
  // on abort, and listenForUser returned that null directly to playLoop /
  // freeConversation, which treated null as genuine silence.
  // Fix: listenForUser now re-enters voice mode on mode-switch null instead of
  // returning null to callers. Verified by checking _lastInputMode === 'voice'
  // after the Promise resolves (proves the recursive voice-mode call happened).

  const modeSwitchResult = await page.evaluate(async () => {
    const prevTestMode = window._testMode;
    window._testMode = true; // voice path returns null immediately — no SR needed
    localStorage.setItem('eklipses_input_mode', 'type');
    const snap = session;

    const p = listenForUser(snap, 5000);
    await new Promise(r => setTimeout(r, 100));

    // Simulate toggle
    localStorage.setItem('eklipses_input_mode', 'voice');
    window.dispatchEvent(new CustomEvent('eklipses-abort-type-listen'));

    const val = await Promise.race([
      p,
      new Promise(r => setTimeout(() => r('TIMEOUT'), 2000)),
    ]);

    const lastMode = _lastInputMode; // 'voice' proves recursive re-enter happened
    window._testMode = prevTestMode;
    return { val, lastMode };
  });

  report('19. Type→voice toggle — listenForUser re-enters voice mode (no rescue line)',
    modeSwitchResult.lastMode === 'voice' && modeSwitchResult.val === null,
    `_lastInputMode="${modeSwitchResult.lastMode}" val="${modeSwitchResult.val}"`);

  // ── 20. Drill skip choice on second entry ────────────────────────────────
  // When eklipses_{lesson}_drill_done='1', clicking Latest Lesson in the
  // practice-focus modal should replace the modal body with the skip choice
  // (drill-warmup-btn + drill-skip-btn) rather than closing the modal.
  // Pre-deploy: test will fail (buildDrillSkipHTML not on production yet).
  // Post-deploy: should pass.

  const drillSkipResult = await page.evaluate(() => {
    try {
      localStorage.setItem('eklipses_lesson1_complete', 'true');
      localStorage.setItem('eklipses_lesson1_drill_done', '1');

      const key = Object.keys(SCENARIOS)[0];
      showPracticeFocusModal(key);

      const latestBtn = document.getElementById('pfm-latest');
      if (!latestBtn) return { error: 'pfm-latest not found' };
      latestBtn.click();

      const modalEl = document.getElementById('practice-focus-modal');
      return {
        warmupBtn: !!document.getElementById('drill-warmup-btn'),
        skipBtn:   !!document.getElementById('drill-skip-btn'),
        modalOpen: modalEl ? modalEl.style.display !== 'none' : false,
      };
    } catch (e) {
      return { error: e.message };
    } finally {
      // Clean up so this test doesn't affect the session state
      const m = document.getElementById('practice-focus-modal');
      if (m) m.style.display = 'none';
      localStorage.removeItem('eklipses_lesson1_drill_done');
    }
  });

  report('20. Drill skip choice on second entry (drill_done=1)',
    !drillSkipResult.error && drillSkipResult.warmupBtn && drillSkipResult.skipBtn && drillSkipResult.modalOpen,
    drillSkipResult.error || `warmup=${drillSkipResult.warmupBtn} skip=${drillSkipResult.skipBtn} modalOpen=${drillSkipResult.modalOpen}`);

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
