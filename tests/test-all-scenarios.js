// Comprehensive audio pipeline verification test — all 14 visible scenario cards.
// Tests the audio pipeline directly by calling speakElevenLabs with a test phrase,
// bypassing the LLM (character-stream) which is subject to API rate limits and is
// tested separately. This makes the test fast, reliable, and independent of quotas.
//
// For each scenario, verifies 6 checks:
//   1. AUDIO_START fires (speakElevenLabs was called and is running)
//   2. VIDEO_STATE: speaking fires (onStart() — audio decoded and began playing)
//   3. AUDIO_END fires within 20s of AUDIO_START (audio completes, not hanging)
//   4. No hard TTS errors (429, 504, TTS fallback failed)
//   5. No OVERLAP_EVENT
//   6. No console.error after AUDIO_START (during character audio playback)
//
// node tests/test-all-scenarios.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LIVE_URL = 'https://eklipses.vercel.app';
// Short phrase spoken by the character voice — tests TTS decode + playback pipeline
const TEST_TTS_LINE = "Thank you. I appreciate you saying that.";
const CAPTURE_MS = 20000;        // response window per scenario (15s EL timeout + buffer)
const AUDIO_END_LIMIT_MS = 20000; // AUDIO_END must fire within 20s of AUDIO_START
const BETWEEN_MS = 1500;          // pause between scenarios

// ─── In-page instrumentation ──────────────────────────────────────────────────
const SCENARIO_PATCH = () => {
  window.__sr = {
    audioStartAt: null, videoStateAt: null, audioEndAt: null,
    overlapCount: 0, active: 0, calls: 0,
  };
  const orig = window.speakElevenLabs;
  if (typeof orig !== 'function') { console.log('[TEST] WARN speakElevenLabs not found'); return; }

  window.speakElevenLabs = function (text, onStart, ...rest) {
    const r = window.__sr;
    r.calls++;
    r.active++;
    if (r.active > 1) {
      r.overlapCount++;
      console.log('[TEST] OVERLAP_EVENT active=' + r.active + ' calls=' + r.calls);
    }
    if (r.audioStartAt === null) r.audioStartAt = performance.now();
    console.log('[TEST] AUDIO_START calls=' + r.calls + ' text="' + (text || '').slice(0, 40) + '"');

    const wrapped = function (...args) {
      if (r.videoStateAt === null) {
        r.videoStateAt = performance.now();
        console.log('[TEST] VIDEO_STATE: speaking gapMs=' + (r.videoStateAt - r.audioStartAt).toFixed(1));
      }
      if (typeof onStart === 'function') return onStart.apply(this, args);
    };

    const p = orig.call(this, text, wrapped, ...rest);
    Promise.resolve(p).then(
      () => {
        r.active = Math.max(0, r.active - 1);
        if (r.audioEndAt === null) {
          r.audioEndAt = performance.now();
          console.log('[TEST] AUDIO_END gapMs=' + (r.audioEndAt - r.audioStartAt).toFixed(1));
        }
      },
      () => { r.active = Math.max(0, r.active - 1); }
    );
    return p;
  };
  console.log('[TEST] PATCH_INSTALLED');
};

const RESET_TRACKING = () => {
  window.__sr = { audioStartAt: null, videoStateAt: null, audioEndAt: null,
                  overlapCount: 0, active: 0, calls: 0 };
};

// ─── Page setup ──────────────────────────────────────────────────────────────
async function setupPage(page) {
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

// Read visible scenario cards: [{key, title}]
async function getScenarioCards(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.nf-card[data-key]')).map(el => ({
      key: el.getAttribute('data-key'),
      title: (el.querySelector('.nf-card-title') || {}).textContent || el.getAttribute('data-key'),
    }))
  );
}

// Read SCENARIO_CHARACTER_MAP from live page (top-level const, accessible by bare name)
async function getCharMap(page) {
  return page.evaluate(() => {
    const map = {};
    // SCENARIO_CHARACTER_MAP is a lexical const in player.js — read as bare identifier
    try { Object.keys(SCENARIO_CHARACTER_MAP).forEach(k => { map[k] = SCENARIO_CHARACTER_MAP[k]; }); }
    catch { /* fallback: map stays empty, charId defaults to 'sofia' */ }
    return map;
  });
}

// ─── Per-scenario runner ──────────────────────────────────────────────────────
async function runScenario(page, key, charId, scenarioLogs) {
  scenarioLogs.length = 0;

  // Kill any lingering async from previous scenario (increments session counter)
  await page.evaluate(() => { try { stopEverything(); } catch {} });
  // Reset conversation history so previous characters don't bleed into new prompt
  await page.evaluate(() => { try { resetConversation(); } catch {} });
  await page.evaluate(RESET_TRACKING);

  // Set scenario state directly — avoids triggering playScenario/warmupCharacterApi/
  // Ryan TTS calls that would pollute the capture window with noise errors
  await page.evaluate(({ k, c }) => {
    currentScenarioKey = k;
    currentCharacterId = c;
    const set = AVATAR_SETS.find(s => s.id === c);
    if (set) applyAvatarSet(set);
  }, { k: key, c: charId || 'sofia' });

  const injectAt = Date.now();

  // Directly invoke speakElevenLabs with a test phrase for the current character voice.
  // Bypasses the LLM (character-stream) entirely — tests the audio pipeline only:
  // TTS fetch → ElevenLabs/OpenAI decode → AudioContext play → onStart callback.
  await page.evaluate(({ line }) => {
    speakElevenLabs(line);
  }, { line: TEST_TTS_LINE });

  await page.waitForTimeout(CAPTURE_MS);

  const sr = await page.evaluate(() => window.__sr);
  const windowLogs = scenarioLogs.filter(m => m.at >= injectAt && m.at < injectAt + CAPTURE_MS);
  windowLogs.forEach(m => { m.relMs = m.at - injectAt; });

  // ── Check 1: AUDIO_START ───────────────────────────────────────────────────
  const audioStartFired = sr.audioStartAt !== null;

  // ── Check 2: VIDEO_STATE ───────────────────────────────────────────────────
  const videoStateFired = sr.videoStateAt !== null;
  const injectToVideoMs = videoStateFired
    ? windowLogs.find(m => m.text.includes('[TEST] VIDEO_STATE: speaking'))?.relMs ?? null
    : null;
  const audioStartToVideoMs = (audioStartFired && videoStateFired)
    ? Math.round(sr.videoStateAt - sr.audioStartAt) : null;

  // ── Check 3: AUDIO_END within limit ───────────────────────────────────────
  const audioEndFired = sr.audioEndAt !== null;
  const audioEndMs = (audioEndFired && audioStartFired)
    ? Math.round(sr.audioEndAt - sr.audioStartAt) : null;
  const audioEndInTime = audioEndFired && audioStartFired
    ? (sr.audioEndAt - sr.audioStartAt) <= AUDIO_END_LIMIT_MS : false;

  // ── Check 4: TTS hard errors ──────────────────────────────────────────────
  // Hard-fail on rate-limit/fatal TTS patterns. "TTS failed, falling back" is
  // a warning (ElevenLabs timed out but OpenAI fallback may still succeed).
  const hardTtsPatterns = ['API error: 429', 'API error: 504', 'TTS fallback failed'];
  const softTtsPatterns = ['TTS failed, falling back'];

  const hardTtsErrors = windowLogs.filter(m =>
    (m.type === 'error' || m.type === 'warning') &&
    hardTtsPatterns.some(p => m.text.includes(p))
  );
  const softTtsWarns = windowLogs.filter(m =>
    m.type === 'warning' && softTtsPatterns.some(p => m.text.includes(p))
  );

  // ── Check 5: No OVERLAP ───────────────────────────────────────────────────
  const overlapCount = sr.overlapCount;

  // ── Check 6: No console.error AFTER AUDIO_START ──────────────────────────
  // Errors before AUDIO_START are pre-scenario background noise (e.g. Ryan's TTS
  // from page setup still in-flight). Only errors during the character response
  // window (after the character pipeline has started) count as failures.
  const audioStartLog = windowLogs.find(m => m.text.includes('[TEST] AUDIO_START'));
  const audioStartRelMs = audioStartLog ? audioStartLog.relMs : 0;
  const consoleErrors = windowLogs.filter(
    m => m.type === 'error' && m.relMs >= audioStartRelMs
  );

  // ── Overall PASS ─────────────────────────────────────────────────────────
  const pass = audioStartFired && videoStateFired &&
               audioEndFired && audioEndInTime &&
               hardTtsErrors.length === 0 &&
               overlapCount === 0 &&
               consoleErrors.length === 0;

  return {
    pass, key, audioStartFired, videoStateFired, audioEndFired, audioEndInTime,
    injectToVideoMs, audioStartToVideoMs, audioEndMs,
    hardTtsErrors, softTtsWarns, overlapCount, consoleErrors, windowLogs, sr,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function pad(s, n) { return String(s).padEnd(n); }
function yn(b) { return b ? 'YES' : 'NO '; }
function ms(n) { return n !== null ? n + 'ms' : '—'; }

function printVerbose(results) {
  const W = 80;
  console.log('\n' + '═'.repeat(W));
  console.log('SCENARIO AUDIO VERIFICATION — DETAILED');
  console.log('═'.repeat(W));
  for (const r of results) {
    const status = r.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`\n${pad(r.title, 40)} ${status}`);
    console.log(`  1. AUDIO_START:         ${yn(r.audioStartFired)}`);
    console.log(`  2. VIDEO_STATE:speaking: ${yn(r.videoStateFired)}` +
      (r.injectToVideoMs !== null ? `  (${ms(r.injectToVideoMs)} from inject, ${ms(r.audioStartToVideoMs)} TTS decode)` : ''));
    console.log(`  3. AUDIO_END in time:   ${yn(r.audioEndFired && r.audioEndInTime)}` +
      (r.audioEndMs !== null ? `  (${ms(r.audioEndMs)} playback, limit ${AUDIO_END_LIMIT_MS/1000}s)` : '') +
      (r.audioEndFired && !r.audioEndInTime ? '  ⚠ EXCEEDED LIMIT' : ''));
    console.log(`  4. TTS hard errors:     ${r.hardTtsErrors.length === 0 ? 'none' : r.hardTtsErrors.length + ' ← FAIL'}` +
      (r.softTtsWarns.length > 0 ? `  (${r.softTtsWarns.length} EL→OAI fallback)` : ''));
    console.log(`  5. OVERLAP events:      ${r.overlapCount === 0 ? 'none' : r.overlapCount + ' ← FAIL'}`);
    console.log(`  6. Console errors:      ${r.consoleErrors.length === 0 ? 'none' : r.consoleErrors.length + ' ← FAIL'} (post-AUDIO_START only)`);
    if (!r.pass) {
      const reasons = [
        !r.audioStartFired ? 'no AUDIO_START' : '',
        !r.videoStateFired ? 'no VIDEO_STATE' : '',
        !r.audioEndFired ? 'no AUDIO_END' : '',
        r.audioEndFired && !r.audioEndInTime ? 'AUDIO_END exceeded 30s' : '',
        r.hardTtsErrors.length ? r.hardTtsErrors[0].text.slice(0, 80) : '',
        r.overlapCount ? `${r.overlapCount} overlaps` : '',
        r.consoleErrors.length ? r.consoleErrors[0].text.slice(0, 80) : '',
      ].filter(Boolean);
      console.log(`  ↳ Fail reason: ${reasons.join('; ')}`);
    }
  }
}

function printSummaryTable(results) {
  const W = 80;
  console.log('\n' + '─'.repeat(W));
  console.log(pad('SCENARIO', 36) + pad('PASS?', 6) + pad('INJECT→SPEAK', 14) +
              pad('AUDIO_END', 10) + pad('EL→OAI', 8) + 'ERRORS');
  console.log('─'.repeat(W));
  for (const r of results) {
    const errStr = [
      r.consoleErrors.length ? `${r.consoleErrors.length} err` : '',
      r.hardTtsErrors.length ? 'TTS_FAIL' : '',
      r.overlapCount ? 'OVERLAP' : '',
    ].filter(Boolean).join(' ') || '—';
    console.log(
      pad(r.title, 36) +
      pad(r.pass ? 'PASS' : 'FAIL', 6) +
      pad(ms(r.injectToVideoMs), 14) +
      pad(ms(r.audioEndMs), 10) +
      pad(r.softTtsWarns.length > 0 ? 'yes' : 'no', 8) +
      errStr
    );
  }
  console.log('─'.repeat(W));
  const passes = results.filter(r => r.pass).length;
  console.log(`${passes}/${results.length} scenarios PASS`);
}

function printFailLogs(results) {
  const failures = results.filter(r => !r.pass);
  if (failures.length === 0) return;
  console.log('\n' + '═'.repeat(80));
  console.log('RAW CONSOLE LOGS FOR FAILING SCENARIOS');
  console.log('═'.repeat(80));
  for (const r of failures) {
    console.log(`\n── ${r.title} (${r.key}) ──`);
    if (r.windowLogs.length === 0) {
      console.log('  (no messages in capture window)');
    } else {
      for (const m of r.windowLogs) {
        const pfx = m.type === 'error' ? '[ERR]' : m.type === 'warning' ? '[WRN]' : '[LOG]';
        console.log(`  +${String(m.relMs ?? '?').padStart(5)}ms ${pfx} ${m.text}`);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const scenarioLogs = [];
  page.on('console', msg => scenarioLogs.push({ type: msg.type(), text: msg.text(), at: Date.now() }));
  page.on('pageerror', err => scenarioLogs.push({ type: 'error', text: err.message, at: Date.now() }));

  console.log('Loading page and dismissing splash…');
  await setupPage(page);

  const cards = await getScenarioCards(page);
  if (cards.length === 0) {
    console.error('No .nf-card[data-key] elements found — aborting.');
    await browser.close(); process.exit(1);
  }

  const charMap = await getCharMap(page);
  console.log(`Found ${cards.length} scenario cards. Running comprehensive audio checks…`);
  const perScenarioSecs = (CAPTURE_MS + BETWEEN_MS) / 1000;
  console.log(`${CAPTURE_MS / 1000}s capture + ${BETWEEN_MS / 1000}s gap per scenario.` +
    ` Estimated total: ~${Math.ceil(cards.length * perScenarioSecs / 60)} min\n`);

  const results = [];
  for (let i = 0; i < cards.length; i++) {
    const { key, title } = cards[i];
    process.stdout.write(`  ${pad(title, 38)} … `);
    const charId = charMap[key] || 'sofia';
    const r = await runScenario(page, key, charId, scenarioLogs);
    results.push({ title, ...r });

    const statusStr = r.pass ? 'PASS' : `FAIL (${[
      !r.audioStartFired     ? 'no AUDIO_START'   : '',
      !r.videoStateFired     ? 'no VIDEO_STATE'   : '',
      !r.audioEndFired       ? 'no AUDIO_END'     : '',
      r.hardTtsErrors.length ? 'TTS_FAIL'         : '',
      r.overlapCount         ? 'OVERLAP'           : '',
      r.consoleErrors.length ? `${r.consoleErrors.length} console err` : '',
    ].filter(Boolean).join(', ')})`;
    process.stdout.write(statusStr + '\n');

    if (i < cards.length - 1) {
      await page.waitForTimeout(BETWEEN_MS);
    }
  }

  await browser.close();

  printVerbose(results);
  printSummaryTable(results);
  printFailLogs(results);

  // Write full logs to file
  const logPath = path.join(__dirname, 'log-all-scenarios.txt');
  const logLines = results.map(r => {
    const header = `\n=== ${r.title} (${r.key}) — ${r.pass ? 'PASS' : 'FAIL'} ===`;
    const lines = r.windowLogs.map(m =>
      `  +${String(m.relMs ?? '?').padStart(5)}ms [${m.type}] ${m.text}`
    );
    return [header, ...lines].join('\n');
  });
  fs.writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
  console.log(`\nFull logs: tests/log-all-scenarios.txt`);

  const passes = results.filter(r => r.pass).length;
  process.exit(passes === results.length ? 0 : 1);
})();
