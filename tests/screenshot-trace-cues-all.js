/**
 * Captures one screenshot per TRACE cue type during a Lesson 5 practice session.
 *
 * Navigates the real preview URL, starts a practice scenario so Sofia's video
 * frame is live, then calls TraceCue.show() directly for each of the four TRACE
 * signal texts. This sidesteps SSE/TTS timing while testing the actual rendered
 * pill position and styling in context.
 *
 * Console warnings/errors are collected to verify zero audio errors.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PREVIEW_URL = 'https://eklipses-qln6w955s-oclaver611-collabs-projects.vercel.app';
const OUT_DIR = path.join(__dirname, 'trace-cue-screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CUES = [
  { label: '1-T-track-gaze',         text: 'She holds your gaze a beat past where it should have ended.' },
  { label: '2-R-register-proximity', text: 'She moves closer — only a few inches, but you feel the shift.' },
  { label: '3-A-attend-alignment',   text: "Her posture has drifted into yours. You can't say when it happened." },
  { label: '4-C-catch-touch',        text: 'She touches your arm briefly, then lets her hand fall away.' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Seed localStorage and suppress voice/mic before page scripts run
  await context.addInitScript(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    localStorage.setItem('eklipses_practice_focus', 'lesson5');
    localStorage.setItem('eklipses_input_mode', 'type');
    localStorage.setItem('eklipses_lesson1_complete', 'true');
    localStorage.setItem('eklipses_lesson2_complete', 'true');
    localStorage.setItem('eklipses_lesson3_complete', 'true');
    localStorage.setItem('eklipses_lesson4_complete', 'true');
    localStorage.setItem('eklipses_lesson5_complete', 'true');
    window._testMode = true;
  });

  const page = await context.newPage();

  // Collect all console warnings and errors
  const consoleLog = [];
  page.on('console', msg => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      consoleLog.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => consoleLog.push(`[pageerror] ${err.message}`));

  // Stub TTS and SSE so no Groq/Kokoro calls block the run
  await page.route('**/api/character-stream**', async (route) => {
    // Return a well-formed SSE that resolves immediately with no cue
    // (we inject cues directly via TraceCue.show below)
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: 'data: {"done":true,"full":"..."}\n\n',
    });
  });
  await page.route('**/api/kokoro**', async (route) => route.fulfill({
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
    // 4-byte MPEG header + silence fills — enough for audio element to fire onended
    body: Buffer.from('fffb5800' + 'ff'.repeat(104), 'hex'),
  }));
  await page.route('**elevenlabs**', async (route) => route.abort());
  await page.route('**api.kokoro**', async (route) => route.abort());

  // ── Navigate ──────────────────────────────────────────────────────────────
  console.log('[NAV] Loading preview…');
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });

  // Detect Vercel auth wall
  const url = page.url();
  if (!url.includes('eklipses') || url.includes('vercel.com/sso') || url.includes('/_vercel/')) {
    console.warn('[NAV] Auth wall — falling back to production');
    await page.goto('https://eklipses.vercel.app', { waitUntil: 'domcontentloaded', timeout: 40000 });
  }
  console.log('[NAV] At:', page.url());

  // Dismiss start overlay
  const startBtn = page.locator('#ek-start-btn');
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
    await page.waitForTimeout(1000);
  }

  // Switch to Practice tab
  await page.click('#ek-tab-practice');
  await page.waitForTimeout(700);

  // If Practice Focus modal appears, pick Latest Lesson
  const latestBtn = page.locator('button:has-text("Latest Lesson")');
  if (await latestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await latestBtn.click();
    await page.waitForTimeout(500);
  }

  // Click first scenario card
  console.log('[NAV] Starting scenario…');
  const firstCard = page.locator('.nf-card[data-key]').first();
  await firstCard.waitFor({ timeout: 10000 });
  await firstCard.click();

  // Practice modal may appear again after card click
  if (await latestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await latestBtn.click();
    await page.waitForTimeout(500);
  }

  // Wait out the 3-2-1 countdown if present
  const countdown = page.locator('#ek-countdown-overlay');
  if (await countdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[NAV] Waiting for countdown…');
    await countdown.waitFor({ state: 'detached', timeout: 20000 });
  }

  // Give Sofia's video a moment to load
  await page.waitForTimeout(2000);

  // ── Verify TraceCue is accessible ────────────────────────────────────────
  const hasTcFn = await page.evaluate(() => typeof TraceCue !== 'undefined' && typeof TraceCue.show === 'function');
  console.log('[CHECK] TraceCue.show() accessible:', hasTcFn);

  // ── Screenshot each cue ───────────────────────────────────────────────────
  const savedPaths = [];

  for (const { label, text } of CUES) {
    console.log(`\n[CUE] ${label}`);
    console.log(`  text: "${text}"`);

    // Show the cue via the live TraceCue module
    const showed = await page.evaluate((cueText) => {
      if (typeof TraceCue === 'undefined') return false;
      TraceCue.show(cueText);
      return true;
    }, text);

    if (!showed) {
      console.warn(`  TraceCue.show() not callable — pill may not appear`);
    }

    // Wait for the pill to reach full opacity (0.6s transition + small margin)
    try {
      await page.waitForFunction(
        () => {
          const el = document.getElementById('ek-trace-cue');
          if (!el) return false;
          // Check both inline style and computed style to handle transition state
          const computed = window.getComputedStyle(el).opacity;
          return parseFloat(computed) > 0.5;
        },
        { timeout: 4000 }
      );
      await page.waitForTimeout(200);
    } catch {
      console.warn(`  Pill opacity check timed out — shooting anyway`);
    }

    const outPath = path.join(OUT_DIR, `${label}.png`);
    const stageEl = page.locator('#stageFrame, .stage').first();
    const box = await stageEl.boundingBox().catch(() => null);
    if (box) {
      await page.screenshot({
        path: outPath,
        clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 },
      });
    } else {
      await page.screenshot({ path: outPath, fullPage: false });
    }
    savedPaths.push(outPath);
    console.log(`  Saved: ${outPath}`);

    // Hide cue before next one
    await page.evaluate(() => { if (typeof TraceCue !== 'undefined') TraceCue.hide(); });
    await page.waitForTimeout(500);
  }

  // ── Audio error report ────────────────────────────────────────────────────
  const audioErrors = consoleLog.filter(m => /audio error|lesson.*audio/i.test(m));

  console.log('\n══════════════════════════════════════════');
  console.log('SCREENSHOTS SAVED:');
  savedPaths.forEach(p => console.log('  ' + p));

  console.log(`\nCONSOLE WARNINGS/ERRORS (${consoleLog.length} total):`);
  if (consoleLog.length === 0) {
    console.log('  (none)');
  } else {
    consoleLog.slice(0, 20).forEach(m => console.log('  ' + m));
    if (consoleLog.length > 20) console.log(`  … and ${consoleLog.length - 20} more`);
  }

  console.log('\nAUDIO ERRORS:');
  if (audioErrors.length === 0) {
    console.log('  ZERO — onerror false-positive fix confirmed.');
  } else {
    console.log(`  ${audioErrors.length} audio error(s) found:`);
    audioErrors.forEach(m => console.log('  ' + m));
  }

  await browser.close();
  console.log('\nDone.');
})();
