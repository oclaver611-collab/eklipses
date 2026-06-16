// Measures Elena (airport scenario) character audio latency: time from
// speakElevenLabs() being called for the first response sentence to the
// moment its onStart() callback actually fires (audio begins playing).
// This is the gap the MediaSource streaming fix targets.
//
// node tests/test-streaming-latency.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://eklipses.vercel.app';
const RUNS = 3;
const TEST_MESSAGE = "I've never seen anyone read a book this intensely without turning a page.";
const GOOD_MS = 3000;
const FAIL_MS = 8000;

// Wraps window.speakElevenLabs so we can time the gap between the call
// being made (ELEVEN_LABS_START) and onStart() actually firing
// (VIDEO_STATE: speaking — audio truly begins playing).
const INSTRUMENT_LATENCY = () => {
  window.__latencyLog = [];
  const orig = window.speakElevenLabs;
  if (typeof orig !== 'function') {
    console.log('[LAT] ERROR speakElevenLabs not found on window');
    return;
  }
  window.speakElevenLabs = function (text, onStart, ...rest) {
    const t0 = performance.now();
    console.log('[LAT] ELEVEN_LABS_START text="' + (text || '').slice(0, 50) + '"');
    const wrappedOnStart = function (...args) {
      const gapMs = performance.now() - t0;
      window.__latencyLog.push({ text: (text || '').slice(0, 50), gapMs });
      console.log('[LAT] VIDEO_STATE: speaking gapMs=' + gapMs.toFixed(1));
      if (typeof onStart === 'function') return onStart.apply(this, args);
    };
    return orig.call(this, text, wrappedOnStart, ...rest);
  };
  console.log('[LAT] INSTRUMENTED speakElevenLabs');
};

async function runOnce(runIndex, lines) {
  const record = (msg) => { lines.push(`[run ${runIndex}] ${msg}`); };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => record(`CONSOLE.${msg.type()} ${msg.text()}`));
  page.on('pageerror', err => record(`PAGE_ERROR ${err.message}`));

  try {
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('ek-onboarding-v1', '1');
      localStorage.setItem('ek-dev-key', 'ek_dev_2026');
    });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('#ek-start-btn', { timeout: 15000 });
    await page.click('#ek-start-btn');
    await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 20000 });
    record('SPLASH_DISMISSED');

    await page.waitForTimeout(500);
    await page.evaluate(INSTRUMENT_LATENCY);

    // Skip playScenario() entirely — airport is coldOpen so it forces
    // practice=true and only resolves after the (up to 7-minute) free-conversation
    // loop ends, and it also plays all 6 Ryan intro lines through OpenAI TTS,
    // which floods the shared IP rate limiter and causes /api/character-stream
    // to 429 and silently fall back to a canned response (no speakElevenLabs
    // call at all). Set just enough state directly to call
    // streamCharacterAndSpeak() cleanly.
    await page.evaluate(() => {
      // currentScenarioKey/currentCharacterId/AVATAR_SETS are top-level `let`/`const`
      // bindings in player.js's classic-script global scope — they are NOT
      // properties of `window`, so they must be assigned/read as bare identifiers
      // here, not via `window.x`, or the assignment silently no-ops.
      currentScenarioKey = 'airport';
      currentCharacterId = 'elena';
      const set = AVATAR_SETS.find(s => s.id === 'elena');
      if (set) applyAvatarSet(set);
    });
    record('STATE_INITIALIZED');

    const result = await page.evaluate(async (msg) => {
      try {
        // `session` is a top-level `let` in player.js's classic-script scope,
        // not a `window` property — must pass the bare identifier here too.
        await streamCharacterAndSpeak(msg, session);
        return { ok: true, log: window.__latencyLog };
      } catch (e) {
        return { ok: false, error: e.message, log: window.__latencyLog };
      }
    }, TEST_MESSAGE);

    record(`RESULT ${JSON.stringify(result)}`);
    await browser.close();

    if (!result.ok) return { ok: false, error: result.error };
    if (!result.log || result.log.length === 0) return { ok: false, error: 'no speakElevenLabs calls captured' };
    return { ok: true, gapMs: result.log[0].gapMs };
  } catch (e) {
    record(`RUN_ERROR ${e.message}`);
    await browser.close();
    return { ok: false, error: e.message };
  }
}

(async () => {
  const lines = [];
  const results = [];

  for (let i = 1; i <= RUNS; i++) {
    const r = await runOnce(i, lines);
    results.push(r);
    console.log(`[run ${i}] ${r.ok ? `gapMs=${r.gapMs.toFixed(1)}` : `FAILED: ${r.error}`}`);
  }

  const ok = results.filter(r => r.ok);
  const logPath = path.join(__dirname, 'log-streaming-latency.txt');
  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');

  if (ok.length === 0) {
    console.log('\nAll runs failed — cannot compute latency.');
    process.exit(1);
  }

  const avg = ok.reduce((s, r) => s + r.gapMs, 0) / ok.length;
  console.log(`\n${ok.length}/${RUNS} runs succeeded.`);
  console.log(`Per-run gaps (ms): ${ok.map(r => r.gapMs.toFixed(1)).join(', ')}`);
  console.log(`Average gap: ${avg.toFixed(1)}ms`);
  if (avg < GOOD_MS) console.log(`PASS — under ${GOOD_MS}ms target.`);
  else if (avg < FAIL_MS) console.log(`MARGINAL — over ${GOOD_MS}ms target but under ${FAIL_MS}ms failure threshold.`);
  else console.log(`FAIL — over ${FAIL_MS}ms threshold.`);

  process.exit(avg < FAIL_MS ? 0 : 1);
})();
