import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://eklipses.vercel.app?dev=ek_dev_2026';
const SS_DIR = './test-screenshots';

const logs = [];
const errors = [];
const networkFails = [];

async function run() {
  fs.mkdirSync(SS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Auto-click splash/onboarding in test mode — mirrors test-browser.js
  await page.addInitScript(() => {
    window.__EKLIPSES_TEST_MODE = true;
    localStorage.setItem('ek-onboarding-v1', '1'); // skip onboarding screen
    const obs = new MutationObserver(() => {
      const startBtn = document.getElementById('ek-start-btn');
      if (startBtn) startBtn.click();
      const obBtn = document.getElementById('ob-btn');
      if (obBtn) obBtn.click();
    });
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  });

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', resp => {
    if (!resp.ok()) networkFails.push(`${resp.status()} ${resp.url()}`);
  });

  // ─── 1. Load page ───
  console.log('\n=== 1. LOAD + WAIT FOR BOOT ===');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${SS_DIR}/grid.png` });
  console.log('grid.png saved (before boot)');

  // Wait up to 45s for KokoroSpeech.preload to finish + renderShelf() to run
  console.log('Waiting for #scenarioSelect to populate (KokoroSpeech preload)...');
  try {
    await page.waitForFunction(
      () => (document.getElementById('scenarioSelect')?.options.length || 0) > 0,
      { timeout: 45000 }
    );
    console.log('Boot complete — select has options');
  } catch {
    console.log('TIMEOUT: select never got options after 45s');
    const opts = await page.evaluate(() => document.getElementById('scenarioSelect')?.options.length ?? 'el-missing');
    console.log('  options.length:', opts);
    const overlays = await page.evaluate(() => {
      return ['ek-start-overlay','ek-onboarding','ek-paywall'].map(id => ({
        id,
        exists: !!document.getElementById(id),
      }));
    });
    console.log('  overlay state:', JSON.stringify(overlays));
    await page.screenshot({ path: `${SS_DIR}/boot-timeout.png` });
    await browser.close();
    return;
  }

  // ─── 2. Screenshot after boot ───
  await page.screenshot({ path: `${SS_DIR}/grid-after-boot.png` });
  console.log('grid-after-boot.png saved');

  // ─── 3. Audit scenario options ───
  console.log('\n=== 2. SCENARIO SELECT AUDIT ===');
  const selectAudit = await page.evaluate(() => {
    const sel = document.getElementById('scenarioSelect');
    const options = Array.from(sel.options).map(o => o.value);
    const wave3 = ['farmers_market','rooftop_pool','wine_bar','night_market','dance_studio',
      'cherry_blossom_park','jazz_bar','airport_gate','rooftop_pool','university_library'];
    return {
      total: options.length,
      wave3Present: wave3.filter(k => options.includes(k)),
      wave3Missing: wave3.filter(k => !options.includes(k)),
      sample: options.slice(0, 5),
    };
  });
  console.log('Total options:', selectAudit.total);
  console.log('Wave3 present:', selectAudit.wave3Present);
  console.log('Wave3 missing:', selectAudit.wave3Missing);
  console.log('First 5:', selectAudit.sample);

  // ─── 4. Thumbnail check ───
  console.log('\n=== 3. THUMBNAIL CHECK ===');
  const thumbs = await page.evaluate(() =>
    ['farmers_market','rooftop_pool','wine_bar','night_market','dance_studio'].map(key => {
      const el = document.querySelector(`[data-key="${key}"]`);
      if (!el) return { key, found: false };
      const img = el.querySelector('img');
      return { key, found: true, src: img?.src?.split('/').pop() || 'none', loaded: img ? (img.complete && img.naturalWidth > 0) : false };
    })
  );
  thumbs.forEach(t => console.log(' ', JSON.stringify(t)));

  // ─── 5. Video state BEFORE click ───
  const vidBefore = await page.evaluate(() =>
    Array.from(document.querySelectorAll('video')).map(v => ({
      id: v.id,
      src: (v.currentSrc || v.src).split('/').pop().slice(0, 40),
      paused: v.paused,
      time: v.currentTime.toFixed(2),
    }))
  );
  console.log('\nVideo state before click:', JSON.stringify(vidBefore));

  // ─── 6. Select farmers_market ───
  console.log('\n=== 4. SELECT farmers_market ===');
  const preClickLogs = logs.length;
  await page.selectOption('#scenarioSelect', 'farmers_market');
  console.log('Selected farmers_market');

  // Screenshot 300ms after — check for stale video
  await page.waitForTimeout(300);
  const vidAt300 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('video')).map(v => ({
      id: v.id, src: (v.currentSrc || v.src).split('/').pop().slice(0, 40),
      paused: v.paused, time: v.currentTime.toFixed(2),
    }))
  );
  await page.screenshot({ path: `${SS_DIR}/camille-load.png` });
  console.log('camille-load.png saved (300ms after click)');
  console.log('Video at 300ms:', JSON.stringify(vidAt300));

  // Check if stale character video was cleared
  const staleCharVid = vidAt300.find(v => v.id === 'sceneBg' && !v.paused && v.time !== '0.00');
  if (staleCharVid) {
    console.log('*** BUG: stale character video still playing at 300ms:', JSON.stringify(staleCharVid));
  } else {
    console.log('OK: no stale video at 300ms');
  }

  // ─── 7. Wait for Ryan intro (test mode skips audio) ───
  console.log('\n=== 5. WAIT FOR RYAN INTRO (listenPill) ===');
  try {
    await page.waitForFunction(() => {
      const pill = document.getElementById('listenPill');
      if (!pill) return false;
      const style = window.getComputedStyle(pill);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, { timeout: 30000 });
    console.log('listenPill visible — Ryan intro complete');
  } catch {
    console.log('TIMEOUT: listenPill never appeared');
    const lineText = await page.$eval('#lineText', el => el.textContent).catch(() => '(not found)');
    console.log('  lineText:', lineText);
  }

  const ryanIntroText = await page.$eval('#lineText', el => el.textContent.trim()).catch(() => '');
  console.log('Ryan intro text:', ryanIntroText.slice(0, 150));
  await page.screenshot({ path: `${SS_DIR}/after-intro.png` });
  console.log('after-intro.png saved');

  // ─── 8. Send "hi what is your name" ───
  console.log('\n=== 6. SEND TEST SPEECH ===');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('test:speech', { detail: { text: 'hi what is your name' } }));
  });

  // Wait for character response
  try {
    await page.waitForFunction((prev) => {
      const text = document.getElementById('lineText')?.textContent || '';
      return text !== prev && text.length > 5;
    }, ryanIntroText, { timeout: 30000 });
    console.log('Got character response');
  } catch {
    console.log('TIMEOUT: no character response within 30s');
  }

  await page.waitForTimeout(500);
  const charResponse = await page.$eval('#lineText', el => el.textContent.trim()).catch(() => '');
  const speakerName = await page.$eval('#speakerName', el => el.textContent.trim()).catch(() => '');
  console.log('Speaker name el:', speakerName);
  console.log('Character response:', charResponse.slice(0, 200));

  await page.screenshot({ path: `${SS_DIR}/camille-response.png` });
  console.log('camille-response.png saved');

  // ─── 9. Bleedthrough check ───
  console.log('\n=== 7. BLEEDTHROUGH CHECK ===');
  const hasSofia = /\bsofia\b/i.test(charResponse);
  const hasBeach = /\bbeach\b|\bshoreline\b/i.test(charResponse);
  const hasCamille = /\bcamille\b/i.test(charResponse);
  const hasFarmers = /farmers|market/i.test(charResponse);
  console.log(`Response text: "${charResponse.slice(0, 200)}"`);
  console.log(`  "sofia" in response: ${hasSofia} ${hasSofia ? '*** BLEEDTHROUGH ***' : ''}`);
  console.log(`  "beach"/"shoreline" in response: ${hasBeach} ${hasBeach ? '*** BLEEDTHROUGH ***' : ''}`);
  console.log(`  "camille" in response: ${hasCamille}`);
  console.log(`  "farmers"/"market" in response: ${hasFarmers}`);

  // ─── 10. Console + error logs ───
  console.log('\n=== 8. NEW CONSOLE LOGS (after scenario click) ===');
  logs.slice(preClickLogs).forEach(l => console.log(' ', l));

  console.log('\n=== PAGE ERRORS ===');
  errors.forEach(e => console.log(' ', e));

  console.log('\n=== NETWORK FAILURES (relevant) ===');
  networkFails
    .filter(n => !n.includes('analytics') && !n.includes('posthog') && !n.includes('amplitude') && !n.includes('google'))
    .forEach(n => console.log(' ', n));

  await browser.close();
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
