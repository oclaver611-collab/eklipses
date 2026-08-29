// G6.4 Production smoke test — with screenshots
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');

const PROD = 'https://eklipses.vercel.app';
const SS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

let ssIdx = 0;
async function shot(page, label) {
  const file = path.join(SS_DIR, `${String(++ssIdx).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${path.basename(file)}`);
  return file;
}

async function dismissSplash(page) {
  const splash = page.locator('#ek-h6-start');
  if (await splash.isVisible({ timeout: 5000 }).catch(() => false)) {
    await splash.click();
    await page.waitForSelector('#ek-hero-v6', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function selectFreePractice(page) {
  // Wait for practice focus modal
  const modal = page.locator('#practice-focus-modal');
  const visible = await modal.isVisible({ timeout: 4000 }).catch(() => false);
  if (visible) {
    await page.locator('#pfm-free').click().catch(async () => {
      await page.locator('text=Free Practice').first().click().catch(() => {});
    });
    await page.waitForTimeout(600);
    // Handle style selector modal that appears after Free Practice
    const styleSel = page.locator('#ek-style-selector');
    if (await styleSel.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Style selector appeared — clicking Direct');
      await page.locator('#ek-style-selector button').last().click().catch(async () => {
        await page.locator('text=Direct').first().click().catch(() => {});
      });
      await page.waitForTimeout(500);
    }
    return true;
  }
  return false;
}

async function main() {
  // ── Deploy check ──────────────────────────────────────────────────────────
  console.log('\n[DEPLOY CHECK] Verifying new code is live...');
  const CHECK = 'Stop overthinking it';
  let deployConfirmed = false;
  for (let i = 0; i < 6; i++) {
    const body = await new Promise((res, rej) => {
      https.get(PROD, r => { const c=[]; r.on('data',d=>c.push(d)); r.on('end',()=>res(Buffer.concat(c).toString())); }).on('error', rej);
    }).catch(() => '');
    if (body.includes(CHECK)) { deployConfirmed = true; break; }
    console.log(`  attempt ${i+1}: not yet, waiting 15s...`);
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log(`  Deploy confirmed: ${deployConfirmed ? '✓ YES' : '⚠ NOT DETECTED'}`);

  const browser = await chromium.launch({ headless: false });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: Hero, PRACTICE tab, scenario start, AI response, voice
  // ═══════════════════════════════════════════════════════════════════════════
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx1.newPage();
  // Allow play — test machine IP may be rate-limited from previous test runs
  await page.route('**/api/check-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ allowed: true, sessionsUsed: 0, limit: 2 }),
  }));
  await page.route('**/api/count-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));

  console.log('\n[STEP 1] Load production URL');
  await page.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dismissSplash(page);
  await page.waitForTimeout(1000);
  await shot(page, 'step1-production-load');

  console.log('[STEP 2] Hero text check');
  const heroEl = page.locator('text=Stop overthinking it').first();
  const heroVisible = await heroEl.isVisible().catch(() => false);
  console.log(`  hero text: ${heroVisible ? '✓ PRESENT' : '✗ MISSING'}`);
  await shot(page, 'step2-hero');

  console.log('[STEP 3] PRACTICE tab default');
  const practiceVisible = await page.locator('#ek-practice-wrap').isVisible().catch(() => false);
  const learnHidden = !(await page.locator('#ek-tab-learn').isVisible().catch(() => false));
  console.log(`  PRACTICE tab: ${practiceVisible ? '✓' : '✗'}  LEARN hidden: ${learnHidden ? '✓' : '✗'}`);
  await shot(page, 'step3-practice-tab');

  console.log('[STEP 4] Launch Sofia/Beach in type mode');
  // Set type mode first
  await page.evaluate(() => localStorage.setItem('eklipses_input_mode', 'type'));
  // Click first scenario card
  await page.locator('.nf-card').first().click();
  await page.waitForTimeout(1200);
  await selectFreePractice(page);
  await shot(page, 'step4-scenario-launched');

  console.log('[STEP 5] Ryan intro (wait 22s for full intro)');
  await page.waitForTimeout(22000);
  await shot(page, 'step5-ryan-intro');

  console.log('[STEP 6] Send text message');
  const typeWrap = page.locator('#type-input-wrap');
  let messageSent = false;
  // Wait up to 50s for type input to appear (Ryan intro can be long)
  for (let t = 0; t < 50; t++) {
    if (await typeWrap.isVisible().catch(() => false)) {
      await page.locator('#type-input-field').fill("Hey, I noticed you've been here a while — what are you working on?");
      await page.keyboard.press('Enter');
      messageSent = true;
      console.log('  ✓ Message sent');
      break;
    }
    await page.waitForTimeout(1000);
  }
  if (!messageSent) console.log('  ⚠ Type input never appeared');
  await shot(page, 'step6-message-sent');

  console.log('[STEP 7] Wait for Sofia AI response (up to 60s via transcript log)');
  let aiResponse = '';
  // Read from localStorage transcript which persists even after DOM resets to "..."
  for (let t = 0; t < 60; t++) {
    const entry = await page.evaluate(() => {
      try {
        const data = JSON.parse(localStorage.getItem('ek-transcript-v1') || '{}');
        const log = data.log || [];
        return log.find(e =>
          e.speaker !== 'User' && e.speaker !== 'DIAG' &&
          e.text && e.text.trim().length > 3 &&
          !e.text.startsWith('▶') && !e.text.startsWith('[')
        ) || null;
      } catch { return null; }
    });
    if (entry && entry.text) {
      aiResponse = entry.text.trim();
      break;
    }
    await page.waitForTimeout(1000);
  }
  console.log(`  AI response: ${aiResponse ? `✓ "${aiResponse.slice(0,80)}"` : '⚠ not detected'}`);
  await shot(page, 'step7-ai-response');

  console.log('[STEP 8] Voice input check (Chrome Web Speech API)');
  const webSpeechAvail = await page.evaluate(() =>
    typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined'
  );
  console.log(`  Web Speech API: ${webSpeechAvail ? '✓ AVAILABLE (Chrome auto-listens — no hold button)' : '✗ UNAVAILABLE'}`);
  // Check Whisper hold button for non-Chrome fallback
  const whisperBtn = await page.locator('[data-stt-mode="whisper"]').isVisible().catch(() => false);
  console.log(`  Whisper hold btn: ${whisperBtn ? '✓ visible (non-Chrome path)' : 'not shown (Chrome path active)'}`);
  await shot(page, 'step8-voice-state');

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: Paywall test
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[STEP 9] Paywall test (mock check-session → not allowed)');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  // Intercept check-session to simulate sessions exhausted
  await page2.route('**/api/check-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ allowed: false, sessionsUsed: 3, limit: 2 }),
  }));
  await page2.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dismissSplash(page2);
  // Click a scenario to trigger canPlay()
  await page2.locator('.nf-card').first().click();
  await page2.waitForTimeout(1000);
  // Select Free Practice → triggers doStart → canPlay → paywall
  const gotModal = await selectFreePractice(page2);
  console.log(`  Practice focus modal appeared: ${gotModal ? '✓' : '✗'}`);
  // Wait for paywall
  let paywallFinal = false;
  for (let t = 0; t < 10; t++) {
    if (await page2.locator('#ek-paywall').isVisible().catch(() => false)) {
      paywallFinal = true;
      break;
    }
    await page2.waitForTimeout(500);
  }
  console.log(`  Paywall: ${paywallFinal ? '✓ TRIGGERED' : '✗ NOT TRIGGERED'}`);
  const ssPaywall = path.join(SS_DIR, `${String(++ssIdx).padStart(2,'0')}-step9-paywall.png`);
  await page2.screenshot({ path: ssPaywall });
  console.log(`  📸 ${path.basename(ssPaywall)}`);

  await browser.close();

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL RESULTS
  // ═══════════════════════════════════════════════════════════════════════════
  const allPass = deployConfirmed && heroVisible && practiceVisible && learnHidden && paywallFinal;
  console.log('\n══════════════════════════════════════════════');
  console.log('G6.4 PRODUCTION SMOKE — FINAL RESULTS');
  console.log('══════════════════════════════════════════════');
  const r = (pass, label) => console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  r(deployConfirmed, 'Deploy confirmed (new code live on prod)');
  r(heroVisible,     'Hero text: "Stop overthinking it" visible');
  r(practiceVisible, 'PRACTICE tab is default');
  r(learnHidden,     'LEARN tab hidden for new users');
  r(messageSent,     'Text message sent to character');
  r(!!aiResponse,    'Sofia AI response received');
  r(webSpeechAvail,  'Chrome Web Speech API available');
  r(paywallFinal,    'Paywall triggers when sessions exhausted');
  console.log(`\nAll critical checks: ${allPass ? '✓ PASS' : '✗ SOME FAILED'}`);
  console.log(`Screenshots saved to: ${SS_DIR}`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error('SMOKE TEST ERROR:', e.message); process.exit(1); });
