// Baseline integration test: for each visible scenario card, triggers the
// scenario, injects a test message via streamCharacterAndSpeak(), and
// measures time to first audio (onStart fires) within a 15s window.
//
// node tests/test-all-scenarios.js
const { chromium } = require('playwright');

const LIVE_URL = 'https://eklipses.vercel.app';
const TEST_MESSAGE = "I couldn't help but notice you — you have a really great presence.";
const WAIT_MS = 15000;  // max wait per scenario for VIDEO_STATE: speaking
const SETUP_MS = 2500;  // time after triggering scenario for state to settle

// Patches speakElevenLabs on the page to:
//   - log [TEST] ELEVEN_LABS_START when called
//   - log [TEST] VIDEO_STATE: speaking gapMs=N when onStart() fires
//   - log [TEST] OVERLAP_EVENT if called while another call is still active
const SCENARIO_PATCH = () => {
  window.__sr = { calls: 0, active: 0, overlapFired: false, startedAt: null, onStartAt: null };
  const orig = window.speakElevenLabs;
  if (typeof orig !== 'function') { console.log('[TEST] WARN speakElevenLabs not found'); return; }
  window.speakElevenLabs = function (text, onStart, ...rest) {
    const r = window.__sr;
    r.calls++;
    r.active++;
    if (r.active > 1) {
      r.overlapFired = true;
      console.log('[TEST] OVERLAP_EVENT active=' + r.active);
    }
    if (r.startedAt === null) r.startedAt = performance.now();
    console.log('[TEST] ELEVEN_LABS_START text="' + (text || '').slice(0, 40) + '"');
    const wrapped = function (...args) {
      if (r.onStartAt === null) {
        r.onStartAt = performance.now();
        console.log('[TEST] VIDEO_STATE: speaking gapMs=' + (r.onStartAt - r.startedAt).toFixed(1));
      }
      if (typeof onStart === 'function') return onStart.apply(this, args);
    };
    const p = orig.call(this, text, wrapped, ...rest);
    Promise.resolve(p).then(() => { r.active = Math.max(0, r.active - 1); },
                            () => { r.active = Math.max(0, r.active - 1); });
    return p;
  };
};

// Reset per-scenario tracking without re-wrapping (patch already installed)
const RESET_TRACKING = () => {
  window.__sr = { calls: 0, active: 0, overlapFired: false, startedAt: null, onStartAt: null };
};

async function setup(page) {
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
  await page.click('#ek-start-btn');
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(500);
  await page.evaluate(SCENARIO_PATCH);
}

// Read visible scenario cards from the page: [{key, title}]
async function getScenarioCards(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.nf-card[data-key]')).map(el => ({
      key: el.getAttribute('data-key'),
      title: (el.querySelector('.nf-card-title') || {}).textContent || el.getAttribute('data-key'),
    }));
  });
}

async function runScenario(page, key) {
  // Kill any running scenario to free audio and increment session counter
  await page.evaluate(() => { stopEverything(); });

  // Reset tracking for this run
  await page.evaluate(RESET_TRACKING);

  // Trigger the scenario the same way a card click does:
  // set scenarioSelect.value and dispatch change event
  const triggered = await page.evaluate((k) => {
    const sel = document.getElementById('scenarioSelect');
    if (!sel) return false;
    sel.value = k;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, key);

  if (!triggered) return { pass: false, latencyMs: null, overlap: false, error: 'scenarioSelect not found' };

  // Give playScenario time to set currentScenarioKey, currentCharacterId,
  // and applyAvatarSet before we inject the test message.
  await page.waitForTimeout(SETUP_MS);

  // Inject the test message directly — this works for both demo and coldOpen
  // (freeConversation) scenarios since we bypass the STT listener entirely.
  page.evaluate((msg) => {
    return streamCharacterAndSpeak(msg, session).catch(() => {});
  }, TEST_MESSAGE).catch(() => {});

  // Wait for onStart to fire (VIDEO_STATE: speaking) within WAIT_MS
  try {
    await page.waitForFunction(() => window.__sr.onStartAt !== null, { timeout: WAIT_MS });
    const sr = await page.evaluate(() => window.__sr);
    return {
      pass: true,
      latencyMs: Math.round(sr.onStartAt - sr.startedAt),
      overlap: sr.overlapFired,
    };
  } catch {
    const sr = await page.evaluate(() => window.__sr);
    return {
      pass: false,
      latencyMs: null,
      overlap: sr.overlapFired,
      // If speakElevenLabs was called but onStart never fired within 15s,
      // that means TTS calls are still pending — ElevenLabs latency too high.
      // If calls===0, character-stream API produced no sentences.
      detail: sr.calls > 0 ? 'TTS_TIMEOUT' : 'NO_CHARACTER_RESPONSE',
    };
  }
}

function pad(s, n) { return String(s).padEnd(n); }
function lpad(s, n) { return String(s).padStart(n); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', err => console.error('[PAGE_ERROR]', err.message));

  console.log('Loading page and dismissing splash…');
  await setup(page);

  const cards = await getScenarioCards(page);
  if (cards.length === 0) {
    console.log('No .nf-card[data-key] elements found — aborting.');
    await browser.close();
    process.exit(1);
  }
  console.log(`Found ${cards.length} scenario cards. Running tests…\n`);

  const results = [];
  for (const { key, title } of cards) {
    process.stdout.write(`  ${pad(title, 36)} … `);
    const r = await runScenario(page, key);
    results.push({ key, title, ...r });
    const status = r.pass
      ? `PASS  ${lpad(r.latencyMs + 'ms', 7)}${r.overlap ? '  ⚠ OVERLAP' : ''}`
      : `FAIL  ${r.detail || ''}`;
    process.stdout.write(status + '\n');
  }

  await browser.close();

  // Summary table
  const passes = results.filter(r => r.pass).length;
  console.log('\n' + '─'.repeat(72));
  console.log(pad('SCENARIO', 36) + pad('RESULT', 8) + pad('LATENCY', 10) + 'OVERLAP');
  console.log('─'.repeat(72));
  for (const r of results) {
    const res = r.pass ? 'PASS' : 'FAIL';
    const lat = r.latencyMs !== null ? r.latencyMs + 'ms' : '—';
    const ovl = r.overlap ? 'YES' : 'no';
    const detail = !r.pass && r.detail ? ` (${r.detail})` : '';
    console.log(pad(r.title, 36) + pad(res + detail, 8 + (detail ? detail.length : 0)) + lpad(lat, 10) + '  ' + ovl);
  }
  console.log('─'.repeat(72));
  console.log(`${passes}/${results.length} scenarios PASS`);

  process.exit(passes === results.length ? 0 : 1);
})();
