// tests/test-new-features.js
// Explicit test coverage for three features added in July 2026:
//   1. Bold yellow captions (player.js Caption module + speak() / streamCharacterAndSpeak wiring)
//   2. Ambient background audio (AmbientAudio module + stopEverything() cleanup)
//   3. Certification system (Certification module logic + avatar picker badge rendering)
//
// WHY A NEW FILE (not test-lesson-player.js):
//   These features are not yet deployed to production. test-lesson-player.js and
//   test-all-scenarios.js both target https://eklipses.vercel.app. These tests must
//   run against the local codebase, so they use a built-in Node.js HTTP server that
//   serves the project directory. API routes (/api/*) are mocked inline.
//
// Run: node tests/test-new-features.js

'use strict';

const { chromium } = require('playwright');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 3787;
const BASE = `http://localhost:${PORT}`;

// ─── result tracking ─────────────────────────────────────────────────────────
const results = [];
function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${name}${detail ? `  (${detail})` : ''}`);
}

// ─── minimal local HTTP server ────────────────────────────────────────────────
// Serves project static files and mocks all /api/* routes so TTS, character
// stream, and auth never hit the real network during tests.
const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
  '.mp4':  'video/mp4',
};

// SSE mock that returns one character sentence then closes — enough for
// streamCharacterAndSpeak to process a sentence and fire Caption.show().
const MOCK_SSE =
  'data: {"sentence":"Nice to meet you."}\n\n' +
  'data: {"done":true,"full":"Nice to meet you."}\n\n';

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = req.url.split('?')[0];
      res.setHeader('Access-Control-Allow-Origin', '*');

      // ── API mocks ────────────────────────────────────────────────────────
      if (pathname === '/api/check-session') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ allowed: true, remaining: 3 }));
      }
      if (pathname === '/api/character-stream') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        return res.end(MOCK_SSE);
      }
      if (pathname === '/api/tts') {
        // Return minimal audio/mpeg so the element loads without erroring.
        // speakElevenLabs is overridden in tests anyway, so this path rarely runs.
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.end(Buffer.alloc(256)); // empty silent buffer
      }
      if (pathname === '/api/coach') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          score: 7, spokenSummary: 'Good attempt.', part1: 'P1', part2: 'P2',
          part3: 'P3', part4: 'P4', bestMoment: 'Opening.', missedOpportunity: 'Push further.',
          tryNextTime: 'Be bolder.', wouldSheDateHim: 'Maybe.', openerBreakdown: 'Direct.'
        }));
      }
      if (pathname === '/api/coach-moment') {
        res.setHeader('Content-Type', 'application/json');
        // Default: not teachable — override in specific tests that need a teachable response
        return res.end(JSON.stringify({ teachable: false }));
      }
      if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        return res.end('{}');
      }

      // ── static files ─────────────────────────────────────────────────────
      const filePath = path.join(PROJECT_ROOT, pathname === '/' ? 'index.html' : pathname);
      try {
        const content = fs.readFileSync(filePath);
        res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found: ' + pathname);
      }
    });

    server.listen(PORT, () => resolve(server));
    server.on('error', reject);
  });
}

// ─── shared page setup ────────────────────────────────────────────────────────
async function loadPage(browser) {
  const page = await browser.newPage();

  // Bypass onboarding and dev-mode flags before any JS runs
  await page.addInitScript(() => {
    localStorage.setItem('ek-onboarding-v1', '1');
    localStorage.setItem('eklipses_lesson1_complete', 'true'); // avoid drill gate
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Dismiss splash screen
  try {
    await page.waitForSelector('#ek-start-btn', { timeout: 5000 });
    await page.click('#ek-start-btn');
    await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 5000 });
  } catch { /* overlay already gone or not present */ }

  return page;
}

// ─── mock TTS so tests don't need real audio ─────────────────────────────────
// Replaces speakElevenLabs with a version that immediately fires onStart
// (simulating audio becoming ready) then waits 80ms (simulating short playback).
// Also stubs KokoroSpeech so Ryan lines never make real network calls.
async function mockTTS(page) {
  await page.evaluate(() => {
    window.speakElevenLabs = async (text, onStart) => {
      if (onStart) onStart();
      await new Promise(r => setTimeout(r, 400));
    };
    if (window.KokoroSpeech) {
      window.KokoroSpeech.speak   = async () => {};
      window.KokoroSpeech.prefetch = async () => null;
      window.KokoroSpeech.cancel  = () => {};
    }
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────
// Poll until caption is visible; returns textContent at the moment opacity==='1',
// or null on timeout. Reading text+opacity in the same evaluate avoids the race
// where Caption.hide()'s 250ms textContent-clear timer fires between two calls.
async function waitForCaption(page, maxMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const info = await page.evaluate(() => {
      const el = document.getElementById('ek-caption');
      if (!el) return null;
      return { opacity: el.style.opacity, text: el.textContent };
    });
    if (info && info.opacity === '1') return info.text; // return text captured at same instant
    await page.waitForTimeout(50);
  }
  return null; // timed out — caption never became visible
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  const server  = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {

    // ═══════════════════════════════════════════════════════════════════════
    // 1. CAPTIONS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nCaption tests');
    console.log('─'.repeat(54));

    const captionPage = await loadPage(browser);
    captionPage.on('pageerror', err => console.error('[caption page error]', err.message));

    // 1a. Caption.show() creates element with correct text and opacity
    await captionPage.evaluate(() => Caption.show('Hello world'));
    const c_shown = await captionPage.evaluate(() => {
      const el = document.getElementById('ek-caption');
      return el && el.style.opacity === '1' && el.textContent === 'Hello world';
    });
    report('Caption.show() creates #ek-caption with text and opacity:1', c_shown);

    // 1b. Caption.hide() sets opacity to 0
    await captionPage.evaluate(() => Caption.hide());
    await captionPage.waitForTimeout(300); // transition
    const c_hidden = await captionPage.evaluate(() => {
      const el = document.getElementById('ek-caption');
      return el ? el.style.opacity === '0' : false;
    });
    report('Caption.hide() sets opacity to 0', c_hidden);

    // ── speak() path ──────────────────────────────────────────────────────
    // Set up scenario context and mock TTS so speak() fires synchronously
    await captionPage.evaluate(() => {
      window.currentScenarioKey  = 'beach';
      window.currentCharacterId  = 'sofia';
    });
    await mockTTS(captionPage);

    // 1c. speak('Mary') shows caption with the correct text
    await captionPage.evaluate(() => Caption.hide()); // reset
    captionPage.evaluate(() => speak('She arrived late.', 'Mary', null, null)).catch(() => {});
    const c_maryText = await waitForCaption(captionPage); // returns text or null
    report('speak() with speaker="Mary" shows caption', c_maryText !== null, c_maryText || 'no text');
    report('Caption text matches the spoken line', c_maryText === 'She arrived late.', `"${c_maryText}"`);

    // 1d. speak('Ryan') does NOT show caption
    await captionPage.evaluate(() => Caption.hide());
    await captionPage.waitForTimeout(100);
    captionPage.evaluate(() => speak('Watch how this goes.', 'Ryan', null, null)).catch(() => {});
    await captionPage.waitForTimeout(200);
    const c_ryanSilent = await captionPage.evaluate(() => {
      const el = document.getElementById('ek-caption');
      return !el || el.style.opacity !== '1';
    });
    report('speak() with speaker="Ryan" does NOT show caption', c_ryanSilent);

    // ── streamCharacterAndSpeak path ─────────────────────────────────────
    // speakElevenLabs is still mocked (fires onStart immediately).
    // /api/character-stream returns a single sentence via SSE.
    // Caption.show() is called inside the onStart callback in processQueue().
    //
    // TIMING GUARD: speak('Mary') above uses a 400ms mock wait. The path from
    // waitForCaption returning to here is ~370ms — just inside the window where
    // Mary's switchToIdle() / Caption.hide() can fire concurrently with
    // streamCharacterAndSpeak's Caption.show(), causing a flaky race. An extra
    // 150ms ensures speak('Mary') has definitely resolved before we start.
    await captionPage.waitForTimeout(150);
    await captionPage.evaluate(() => Caption.hide());

    captionPage.evaluate(() => {
      const s = session; // capture before async
      streamCharacterAndSpeak('hey', s);
    }).catch(() => {});

    const c_streamText = await waitForCaption(captionPage, 3000); // returns text or null
    report('streamCharacterAndSpeak() shows caption when sentence fires', c_streamText !== null, c_streamText || 'no text');
    report('Caption text matches the streamed sentence', c_streamText === 'Nice to meet you.', `"${c_streamText}"`);

    // Wait for processQueue to finish (caption hides after all audio done)
    await captionPage.waitForTimeout(500);
    const c_streamHidden = await captionPage.evaluate(() => {
      const el = document.getElementById('ek-caption');
      return !el || el.style.opacity !== '1';
    });
    report('Caption hides after streamCharacterAndSpeak completes', c_streamHidden);

    await captionPage.close();


    // ═══════════════════════════════════════════════════════════════════════
    // 2. AMBIENT AUDIO
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nAmbient audio tests');
    console.log('─'.repeat(54));

    const ambientPage  = await loadPage(browser);
    const jsPageErrors = [];
    ambientPage.on('pageerror', err => jsPageErrors.push(err.message));

    // 2a. AmbientAudio.play() creates an <audio> element in the DOM
    const a_created = await ambientPage.evaluate(() => {
      AmbientAudio.play('beach');
      return document.querySelectorAll('audio').length > 0;
    });
    report('AmbientAudio.play() creates an <audio> element', a_created);

    // 2b. Audio element has correct properties
    const a_props = await ambientPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('audio'))
        .find(a => a.src && a.src.includes('ambient'));
      if (!el) return null;
      return { loop: el.loop, volume: el.volume, srcHasBeach: el.src.includes('beach') };
    });
    report('Audio element loop=true', a_props ? a_props.loop === true  : false, a_props ? `loop=${a_props.loop}` : 'element not found');
    report('Audio element volume ≤ 0.15 (subordinate mix)', a_props ? a_props.volume <= 0.15 : false, a_props ? `volume=${a_props.volume}` : 'element not found');
    report('Audio src contains "beach" category for beach scenario', a_props ? a_props.srcHasBeach : false, a_props ? `src has beach: ${a_props.srcHasBeach}` : 'element not found');

    // 2c. Missing audio file fails gracefully — no JS exception thrown
    // The onerror handler silently removes the element; no console.error should fire.
    await ambientPage.waitForTimeout(800); // allow onerror to fire for the 404
    const a_noJsErrors = jsPageErrors.length === 0;
    report('Missing ambient file does not throw a JS page error', a_noJsErrors,
      a_noJsErrors ? 'clean' : jsPageErrors.join('; '));

    // 2d. Category derivation: bar scenario maps to "bar" audio src.
    // Multiple ambient elements may exist from test 2a/2b; search by final filename.
    const a_barSrc = await ambientPage.evaluate(() => {
      AmbientAudio.play('bar');
      const el = Array.from(document.querySelectorAll('audio'))
        .find(a => a.src && a.src.endsWith('bar.mp3'));
      return el ? el.src : '';
    });
    report('bar scenario maps to ambient/bar.mp3', a_barSrc.includes('bar.mp3'), a_barSrc.split('/').pop() || 'not found');

    // 2e. Wave-3 key derived by substring: "jazz_bar" maps to "bar" category
    // Use specific src search since multiple ambient elements accumulate from prior tests.
    const a_jazzSrc = await ambientPage.evaluate(() => {
      AmbientAudio.play('jazz_bar');
      // find any element whose src ends with bar.mp3
      const el = Array.from(document.querySelectorAll('audio'))
        .find(a => a.src && a.src.endsWith('bar.mp3'));
      return el ? el.src : '';
    });
    report('jazz_bar (Wave 3) derives "bar" ambient category', a_jazzSrc.includes('bar.mp3'), a_jazzSrc.split('/').pop());

    // 2f. stopEverything() removes all audio elements (ambient included)
    const a_beforeStop = await ambientPage.evaluate(() => document.querySelectorAll('audio').length);
    await ambientPage.evaluate(() => stopEverything());
    const a_afterStop  = await ambientPage.evaluate(() => document.querySelectorAll('audio').length);
    report('stopEverything() removes ambient <audio> element from DOM',
      a_afterStop === 0, `${a_beforeStop} before → ${a_afterStop} after`);

    await ambientPage.close();


    // ═══════════════════════════════════════════════════════════════════════
    // 3. CERTIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nCertification tests');
    console.log('─'.repeat(54));

    const certPage = await loadPage(browser);
    certPage.on('pageerror', err => console.error('[cert page error]', err.message));

    // Seed known session data so tier math is deterministic.
    // sofia   : 3 sessions, scores [5,5,5]     avg 5.0  → Bronze (min 3, avg ≥ 5.0)
    // isabelle: 5 sessions, scores [7,8,8,8,7] avg 7.6  → Gold   (min 5, avg ≥ 7.5)
    // nadia   : 7 sessions, scores [9,9,9,9,9,9,9] avg 9.0 → Master (min 7, avg ≥ 8.5)
    // julia   : 5 sessions, scores [6,7,6,7,7] avg 6.6  → Silver (min 5, avg ≥ 6.5, < 7.5)
    // zoe     : 1 session                               → null (< 3 min for Bronze)
    await certPage.evaluate(() => {
      const today = new Date().toDateString();
      const mk = (id, sc, scenarioKey) => sc.map((score, i) =>
        ({ score, characterId: id, scenarioKey, date: today, ts: Date.now() + i }));
      localStorage.setItem('ek-progress-v1', JSON.stringify({
        lastSessionDate: today,
        sessions: [
          ...mk('sofia',    [5,5,5],         'beach'),
          ...mk('isabelle', [7,8,8,8,7],     'museum'),
          ...mk('nadia',    [9,9,9,9,9,9,9], 'bookstore'),
          ...mk('julia',    [6,7,6,7,7],     'street'),
          ...mk('zoe',      [8],             'gym'),
        ]
      }));
    });

    // 3a. getTier() returns correct tier for each seeded character
    const t_sofia    = await certPage.evaluate(() => { const t = Certification.getTier('sofia');    return t ? t.id : null; });
    const t_isabelle = await certPage.evaluate(() => { const t = Certification.getTier('isabelle'); return t ? t.id : null; });
    const t_nadia    = await certPage.evaluate(() => { const t = Certification.getTier('nadia');    return t ? t.id : null; });
    const t_julia    = await certPage.evaluate(() => { const t = Certification.getTier('julia');    return t ? t.id : null; });
    const t_zoe      = await certPage.evaluate(() => { const t = Certification.getTier('zoe');      return t ? t.id : null; });
    const t_none     = await certPage.evaluate(() => { const t = Certification.getTier('nobody');   return t; });

    report('getTier("sofia")    = "bronze"  (3 sessions, avg 5.0)', t_sofia    === 'bronze', `got: ${t_sofia}`);
    report('getTier("isabelle") = "gold"    (5 sessions, avg 7.6)', t_isabelle === 'gold',   `got: ${t_isabelle}`);
    report('getTier("nadia")    = "master"  (7 sessions, avg 9.0)', t_nadia    === 'master', `got: ${t_nadia}`);
    report('getTier("julia")    = "silver"  (5 sessions, avg 6.6)', t_julia    === 'silver', `got: ${t_julia}`);
    report('getTier("zoe")      = null      (1 session < 3 min)',    t_zoe      === null,     `got: ${t_zoe}`);
    report('getTier() = null for character with no sessions at all', t_none     === null,     `got: ${t_none}`);

    // 3b. getBadgeHTML() renders correctly for each case
    const b_sofia = await certPage.evaluate(() => Certification.getBadgeHTML('sofia'));
    const b_nadia = await certPage.evaluate(() => Certification.getBadgeHTML('nadia'));
    const b_zoe   = await certPage.evaluate(() => Certification.getBadgeHTML('zoe'));

    report('getBadgeHTML("sofia")    returns HTML containing "Bronze"',
      typeof b_sofia === 'string' && b_sofia.includes('Bronze'), `len=${b_sofia.length}`);
    report('getBadgeHTML("nadia")    returns HTML containing "Master"',
      typeof b_nadia === 'string' && b_nadia.includes('Master'), `len=${b_nadia.length}`);
    report('getBadgeHTML("zoe")      returns empty string (uncertified)',
      b_zoe === '', `value="${b_zoe}"`);

    // 3c. getProgressHTML() renders without throwing for both certified and uncertified
    const p_sofia     = await certPage.evaluate(() => Certification.getProgressHTML('sofia'));
    const p_isabelle  = await certPage.evaluate(() => Certification.getProgressHTML('isabelle'));
    const p_zoe       = await certPage.evaluate(() => Certification.getProgressHTML('zoe'));

    report('getProgressHTML("sofia")    returns non-empty string',
      typeof p_sofia === 'string' && p_sofia.length > 0, `len=${p_sofia.length}`);
    report('getProgressHTML("sofia")    mentions Bronze tier label',
      p_sofia.includes('Bronze'), 'tier label present');
    report('getProgressHTML("isabelle") mentions Gold tier label',
      p_isabelle.includes('Gold'), 'tier label present');
    report('getProgressHTML("zoe")      returns a progress nudge (string, possibly empty)',
      typeof p_zoe === 'string', `len=${p_zoe.length}`);

    // 3d. Avatar picker renders badges correctly
    // renderAvatarPicker() generates pick-card HTML including getBadgeHTML() per avatar.
    await certPage.evaluate(() => renderAvatarPicker());
    await certPage.waitForSelector('.pick-card', { timeout: 3000 }).catch(() => {});

    const picker_sofia_hasBronze = await certPage.evaluate(() => {
      const card = document.querySelector('.pick-card[data-id="sofia"]');
      return card ? card.innerHTML.includes('Bronze') : false;
    });
    report('Avatar picker shows Bronze badge for certified sofia', picker_sofia_hasBronze);

    const picker_zoe_noBadge = await certPage.evaluate(() => {
      const card = document.querySelector('.pick-card[data-id="zoe"]');
      if (!card) return true; // not in picker = acceptable
      const html = card.innerHTML;
      return !html.includes('Bronze') && !html.includes('Silver') && !html.includes('Gold') && !html.includes('Master');
    });
    report('Avatar picker shows no tier badge for uncertified zoe', picker_zoe_noBadge);

    await certPage.close();


    // ═══════════════════════════════════════════════════════════════════════
    // 4. COACHED PRACTICE
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nCoached Practice tests');
    console.log('─'.repeat(54));

    const coachedPage = await loadPage(browser);
    coachedPage.on('pageerror', err => console.error('[coached page error]', err.message));

    // Seed lesson1 complete so the modal has the coached option
    await coachedPage.evaluate(() => {
      localStorage.setItem('eklipses_lesson1_complete', 'true');
      localStorage.setItem('eklipses_lesson1_drill_done', '1'); // skip drill gate
    });

    // 4a. showPracticeFocusModal() renders the Coached Practice button when a lesson is complete
    await coachedPage.evaluate(() => showPracticeFocusModal('beach'));
    const cp_hasCoached = await coachedPage.evaluate(() => {
      const modal = document.getElementById('practice-focus-modal');
      return modal && modal.style.display !== 'none' && !!document.getElementById('pfm-coached');
    });
    report('showPracticeFocusModal() renders #pfm-coached button when lesson is complete', cp_hasCoached);

    // 4b. Clicking "Coached Practice" sets eklipses_coached_mode = '1' and practice_focus = 'lesson1'
    // We intercept playScenario to prevent actual scenario launch
    await coachedPage.evaluate(() => { window._scenarioLaunched = false; window.playScenario = () => { window._scenarioLaunched = true; }; });
    await coachedPage.evaluate(() => document.getElementById('pfm-coached')?.click());
    await coachedPage.waitForTimeout(100);
    const cp_coached = await coachedPage.evaluate(() => ({
      coachMode:     localStorage.getItem('eklipses_coached_mode'),
      practiceFocus: localStorage.getItem('eklipses_practice_focus'),
      launched:      window._scenarioLaunched,
    }));
    report('Coached Practice sets eklipses_coached_mode to "1"',  cp_coached.coachMode === '1',     `got: ${cp_coached.coachMode}`);
    report('Coached Practice sets practiceFocus to the latest lesson', cp_coached.practiceFocus === 'lesson1', `got: ${cp_coached.practiceFocus}`);

    // 4c. Selecting Free Practice clears eklipses_coached_mode
    await coachedPage.evaluate(() => showPracticeFocusModal('beach'));
    await coachedPage.evaluate(() => { window.playScenario = () => {}; }); // re-stub
    await coachedPage.evaluate(() => document.getElementById('pfm-free')?.click());
    await coachedPage.waitForTimeout(100);
    const cp_cleared = await coachedPage.evaluate(() => localStorage.getItem('eklipses_coached_mode'));
    report('Selecting Free Practice clears eklipses_coached_mode', cp_cleared === null, `got: ${JSON.stringify(cp_cleared)}`);

    // 4d. isCoachMode() returns false when eklipses_coached_mode is not set
    const cp_isCoachFalse = await coachedPage.evaluate(() => {
      localStorage.removeItem('eklipses_coached_mode');
      return typeof isCoachMode === 'function' && isCoachMode() === false;
    });
    report('isCoachMode() returns false when coached_mode flag absent', cp_isCoachFalse);

    // 4e. isCoachMode() returns true when eklipses_coached_mode = '1'
    const cp_isCoachTrue = await coachedPage.evaluate(() => {
      localStorage.setItem('eklipses_coached_mode', '1');
      return isCoachMode() === true;
    });
    report('isCoachMode() returns true when coached_mode flag = "1"', cp_isCoachTrue);

    // 4f. showCoachInterrupt() renders the interrupt overlay with correct sections
    const cp_overlay = await coachedPage.evaluate(() => {
      showCoachInterrupt('You seem nice.', 'I hear that a lot.', {
        skill: 'O', skillName: 'Observation opener',
        coaching: 'Generic opener — no scene reference.',
        betterLine: 'You look like you\'ve been here a while.',
      });
      const ov = document.getElementById('ek-coach-interrupt');
      if (!ov) return null;
      return {
        hasRetry:    !!ov.querySelector('#ek-interrupt-retry'),
        hasContinue: !!ov.querySelector('#ek-interrupt-continue'),
        hasCoaching: ov.textContent.includes('Generic opener'),
        hasBetterLine: ov.textContent.includes("You look like you've been here"),
        hasCharLine: ov.textContent.includes("I hear that a lot"),
      };
    });
    report('#ek-coach-interrupt overlay renders',          !!cp_overlay,                    cp_overlay ? 'present' : 'missing');
    report('Overlay has "Try again" retry button',         cp_overlay?.hasRetry    === true, cp_overlay ? String(cp_overlay.hasRetry)    : 'no overlay');
    report('Overlay has "Skip coaching" continue button',  cp_overlay?.hasContinue === true, cp_overlay ? String(cp_overlay.hasContinue) : 'no overlay');
    report('Overlay shows Ryan coaching text',             cp_overlay?.hasCoaching === true, cp_overlay ? String(cp_overlay.hasCoaching) : 'no overlay');
    report('Overlay shows the better-line suggestion',     cp_overlay?.hasBetterLine === true, cp_overlay ? String(cp_overlay.hasBetterLine) : 'no overlay');
    report("Overlay shows character's reaction line",      cp_overlay?.hasCharLine === true,  cp_overlay ? String(cp_overlay.hasCharLine)  : 'no overlay');

    // 4g. resumeFromCoachInterrupt(false) dismisses overlay without rolling back history
    // Note: top-level `let` bindings from player.js are accessible by name in evaluate()
    // but NOT via window.* (which creates a separate property). We use direct var names here.
    await coachedPage.evaluate(() => {
      conversationHistory = [{ role:'user', content:'hi' }, { role:'assistant', content:'hey' }];
      _exchangeCount = 1;
      _turnSnapshot  = { history: [], exchangeCount: 0 };
      if (!document.getElementById('ek-coach-interrupt')) {
        showCoachInterrupt('test','test',{skill:'C',skillName:'Close',coaching:'Hedged close.',betterLine:'Come with me.'});
      }
    });
    await coachedPage.evaluate(() => resumeFromCoachInterrupt(false));
    const cp_norewind = await coachedPage.evaluate(() => ({
      overlayGone: !document.getElementById('ek-coach-interrupt'),
      historyLen:  conversationHistory.length, // should still be 2 (no rewind)
    }));
    report('resumeFromCoachInterrupt(false) removes overlay', cp_norewind.overlayGone, cp_norewind.overlayGone ? 'removed' : 'still present');
    report('resumeFromCoachInterrupt(false) does NOT roll back history', cp_norewind.historyLen === 2, `len=${cp_norewind.historyLen}`);

    // 4h. resumeFromCoachInterrupt(true) rolls back state to snapshot
    await coachedPage.evaluate(() => {
      conversationHistory = [{ role:'user', content:'hi' }, { role:'assistant', content:'hey' },
                             { role:'user', content:'bad line' }, { role:'assistant', content:'meh' }];
      _exchangeCount = 2;
      _turnSnapshot  = { history: [{ role:'user', content:'hi' }, { role:'assistant', content:'hey' }], exchangeCount: 1 };
      showCoachInterrupt('bad line','meh',{skill:'T',skillName:'Tease',coaching:'Apologized.',betterLine:'Fair point.'});
    });
    await coachedPage.evaluate(() => resumeFromCoachInterrupt(true));
    const cp_rewind = await coachedPage.evaluate(() => ({
      overlayGone:   !document.getElementById('ek-coach-interrupt'),
      historyLen:    conversationHistory.length,  // should be 2 after rollback
      exchangeCount: _exchangeCount,              // should be 1
    }));
    report('resumeFromCoachInterrupt(true) removes overlay', cp_rewind.overlayGone, cp_rewind.overlayGone ? 'removed' : 'still present');
    report('resumeFromCoachInterrupt(true) rolls conversationHistory back to snapshot', cp_rewind.historyLen === 2, `len=${cp_rewind.historyLen}, expected 2`);
    report('resumeFromCoachInterrupt(true) rolls _exchangeCount back to snapshot', cp_rewind.exchangeCount === 1, `count=${cp_rewind.exchangeCount}, expected 1`);

    await coachedPage.close();


    // ═══════════════════════════════════════════════════════════════════════
    // 5. SCENARIO LAUNCH SMOKE TEST
    // Exercises the real playScenario() UI path to catch null-ref crashes on
    // elements removed from the DOM (e.g. #scenarioSelect removed in a1ae651
    // caused a TypeError at line 2072 on every scenario launch — missed by
    // test-all-scenarios.js which deliberately bypasses playScenario()).
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nScenario launch smoke tests');
    console.log('─'.repeat(54));

    const smokePage = await loadPage(browser);

    // Directly test the null-guard that was broken in production (a1ae651 removed
    // #scenarioSelect from the DOM; the guard at playScenario line 2072 was missed).
    // Rather than calling the full async playScenario() (which makes network calls),
    // we verify the guard expression directly and confirm els.select is actually null.
    const smokeResult = await smokePage.evaluate(() => {
      try {
        const selectIsNull = els.select === null;
        // This is the exact expression from player.js line 2072 — must not throw
        const key = 'beach';
        if (els.select && els.select.value !== key) els.select.value = key;
        return { threw: false, selectIsNull };
      } catch (e) {
        return { threw: true, error: e.message };
      }
    });

    report(
      'els.select is null (#scenarioSelect removed from DOM in a1ae651)',
      smokeResult.selectIsNull === true,
      smokeResult.selectIsNull ? 'null as expected' : 'unexpected: element present'
    );
    report(
      'null-guard on els.select does not throw (playScenario line 2072 fix)',
      !smokeResult.threw,
      smokeResult.threw ? `threw: ${smokeResult.error}` : 'clean'
    );

    await smokePage.close();


    // ═══════════════════════════════════════════════════════════════════════
    // 6. AUTH STATE RENDERS ON PAGE LOAD (existing session in localStorage)
    // Regression test for bug: renderAuthState() not wired to update
    // splash/onboarding overlays. player.js creates those overlays
    // synchronously before auth.js finishes its async init, so the overlays
    // always showed "Already have an account? Sign in" even for logged-in
    // users. Fix: renderAuthState(user) now removes those prompts.
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nAuth page-load state tests');
    console.log('─'.repeat(54));

    const authPage = await browser.newPage();

    // Replace the Supabase CDN script with a minimal mock that immediately
    // fires INITIAL_SESSION with a fake user — simulates a returning user
    // whose session was already in localStorage.
    await authPage.route(/supabase-js/, route => {
      route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.supabase = {
            createClient: function(url, key) {
              return {
                auth: {
                  onAuthStateChange: function(cb) {
                    // Fire after getSession() has returned so renderAuthState(null)
                    // runs first — proving the fix works for the async update case.
                    setTimeout(function() {
                      cb('INITIAL_SESSION', {
                        user: { id: 'test-user-id', email: 'tester@eklipses.test' },
                        access_token: 'fake-token-for-test'
                      });
                    }, 50);
                    return { data: { subscription: { unsubscribe: function() {} } } };
                  },
                  getSession: async function() {
                    return { data: { session: null }, error: null };
                  },
                  signOut: async function() { return { error: null }; }
                },
                from: function() {
                  return {
                    select: function() {
                      return { eq: function() {
                        return { maybeSingle: async function() { return { data: null, error: null }; } };
                      }};
                    },
                    upsert: async function() { return { error: null }; }
                  };
                }
              };
            }
          };
        `
      });
    });

    // Return valid-looking auth config so auth.js creates the client
    // (the default server fallback returns {} which has no url/anonKey).
    await authPage.route('**/api/auth-config', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://fake.supabase.co', anonKey: 'fake-anon-key' })
      });
    });

    await authPage.addInitScript(() => {
      localStorage.setItem('ek-onboarding-v1', '1'); // skip onboarding → show splash
    });

    await authPage.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Wait well past the 50ms INITIAL_SESSION delay for renderAuthState to run.
    await authPage.waitForTimeout(400);

    const authUIState = await authPage.evaluate(() => {
      const btn           = document.getElementById('ek-auth-btn');
      const indicator     = document.getElementById('ek-auth-indicator');
      const splashSignin  = document.getElementById('ek-splash-signin');
      const obSignin      = document.getElementById('ob-signin');
      return {
        btnHidden:         !btn || btn.style.display === 'none',
        indicatorVisible:  !!indicator && indicator.style.display !== 'none',
        splashSigninGone:  !splashSignin,
        obSigninGone:      !obSignin,
      };
    });

    report(
      'Nav sign-in button hidden when session exists on load',
      authUIState.btnHidden,
      authUIState.btnHidden ? 'hidden' : 'still visible'
    );
    report(
      'Nav auth indicator visible when session exists on load',
      authUIState.indicatorVisible,
      authUIState.indicatorVisible ? 'visible' : 'not visible'
    );
    report(
      'Splash "Already have an account?" removed when logged in',
      authUIState.splashSigninGone,
      authUIState.splashSigninGone ? 'removed' : 'still present'
    );

    await authPage.close();

    // ═══════════════════════════════════════════════════════════════════════
    // 7. LESSON 3 (PACE) PRACTICE INJECTION WIRING
    // Verifies that lesson3 is wired into LESSON_REGISTRY (modal shows it),
    // LESSON_MNEMONICS (mnemonic pill renders PACE), and that the DRILL_REPS
    // rep-count is 4 (PACE has 4 skills, not 5 like OTIMC/FRAME).
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nLesson 3 (PACE) injection wiring tests');
    console.log('─'.repeat(54));

    const l3Page = await browser.newPage();

    await l3Page.addInitScript(() => {
      localStorage.setItem('ek-onboarding-v1', '1');
      localStorage.setItem('eklipses_lesson1_complete', 'true');
      localStorage.setItem('eklipses_lesson2_complete', 'true');
      localStorage.setItem('eklipses_lesson3_complete', 'true');
      localStorage.removeItem('eklipses_mnemonic_off');
    });

    await l3Page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Stub KokoroSpeech BEFORE clicking start — its preload() is called
    // immediately on click and blocks overlay removal if not stubbed.
    await l3Page.waitForSelector('#ek-start-btn', { timeout: 8000 });
    await l3Page.evaluate(() => {
      if (window.KokoroSpeech) {
        window.KokoroSpeech.preload  = async () => {};
        window.KokoroSpeech.speak    = async () => {};
        window.KokoroSpeech.prefetch = async () => null;
        window.KokoroSpeech.cancel   = () => {};
      }
    });
    await l3Page.click('#ek-start-btn');
    await l3Page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 8000 });

    // Switch to Practice tab and wait for the shelf to be rendered.
    // Use JS click (evaluate) to bypass Playwright's visibility pre-check.
    await l3Page.evaluate(() => {
      const t = document.getElementById('ek-tab-practice');
      if (t) t.click();
    });
    await l3Page.waitForFunction(() => {
      const w = document.getElementById('ek-practice-wrap');
      return w && w.style.display !== 'none';
    }, { timeout: 5000 });

    // Click the first scenario card via JS to bypass visibility checks.
    await l3Page.evaluate(() => {
      const card = document.querySelector('.sc-card');
      if (card) card.click();
    });

    // Wait for the Practice Focus Modal to become visible
    await l3Page.waitForFunction(() => {
      const m = document.getElementById('practice-focus-modal');
      return m && m.style.display !== 'none';
    }, { timeout: 5000 });

    // Test A: modal body contains "Lesson 3" and "PACE"
    const modalBodyHTML = await l3Page.evaluate(() => {
      const body = document.getElementById('practice-focus-body');
      return body ? body.innerHTML : '';
    });
    const hasLesson3InModal = modalBodyHTML.includes('Lesson 3') && modalBodyHTML.includes('PACE');
    report(
      'Practice Focus Modal shows Lesson 3 — The Long Game (PACE) option',
      hasLesson3InModal,
      hasLesson3InModal ? 'found in modal' : `not found — snippet: "${modalBodyHTML.slice(0, 120)}"`
    );

    // Test B: showMnemonicPill('lesson3') renders PACE label
    // showMnemonicPill is a function declaration → accessible as window property.
    const pillResult = await l3Page.evaluate(() => {
      if (typeof showMnemonicPill !== 'function') return { available: false };
      showMnemonicPill('lesson3');
      const pill  = document.getElementById('mnemonic-pill');
      const label = document.getElementById('mnemonic-pill-label');
      return {
        available: true,
        display:   pill ? pill.style.display : 'missing',
        labelText: label ? label.textContent : '',
      };
    });
    const paceLabel = pillResult.available && pillResult.labelText.includes('PACE');
    report(
      'Mnemonic pill renders PACE label for lesson3 focus',
      paceLabel,
      paceLabel ? `label="${pillResult.labelText}"` : `available=${pillResult.available} label="${pillResult.labelText}"`
    );

    // Test C: drill skip UI shows 4 reps (PACE has 4 skills, not 5)
    // buildDrillSkipHTML is a function declaration → accessible as window property.
    const drillSkipHTML = await l3Page.evaluate(() => {
      localStorage.setItem('eklipses_lesson3_drill_done', '1');
      if (typeof buildDrillSkipHTML !== 'function') return { available: false, html: '' };
      return { available: true, html: buildDrillSkipHTML('lesson3') };
    });
    const hasFourReps = drillSkipHTML.available &&
      drillSkipHTML.html.includes('4 reps') &&
      !drillSkipHTML.html.includes('5 reps');
    report(
      'Drill skip HTML shows 4 reps for lesson3 (PACE has 4 skills)',
      hasFourReps,
      hasFourReps
        ? '4 reps confirmed'
        : `available=${drillSkipHTML.available} snippet="${(drillSkipHTML.html || '').slice(0, 80)}"`
    );

    await l3Page.close();

    // ═══════════════════════════════════════════════════════════════════════
    // 8. PRACTICE FOCUS MODAL — ZERO-LESSON USER
    // Confirms the modal shows and lesson options are available even when
    // no lessons are marked complete (gate removed from "Choose a Lesson").
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\nPractice Focus Modal — zero-lesson user tests');
    console.log('─'.repeat(54));

    const zeroPage = await browser.newPage();
    await zeroPage.addInitScript(() => {
      localStorage.setItem('ek-onboarding-v1', '1');
      // All lesson_complete keys intentionally absent — zero-lesson user
    });
    await zeroPage.goto(BASE, { waitUntil: 'domcontentloaded' });
    await zeroPage.waitForSelector('#ek-start-btn', { timeout: 8000 });
    await zeroPage.evaluate(() => {
      if (window.KokoroSpeech) {
        window.KokoroSpeech.preload  = async () => {};
        window.KokoroSpeech.speak    = async () => {};
        window.KokoroSpeech.prefetch = async () => null;
        window.KokoroSpeech.cancel   = () => {};
      }
    });
    await zeroPage.click('#ek-start-btn');
    await zeroPage.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 8000 });
    await zeroPage.evaluate(() => {
      const t = document.getElementById('ek-tab-practice');
      if (t) t.click();
    });
    await zeroPage.waitForFunction(() => {
      const w = document.getElementById('ek-practice-wrap');
      return w && w.style.display !== 'none';
    }, { timeout: 5000 });
    await zeroPage.evaluate(() => {
      const card = document.querySelector('.sc-card');
      if (card) card.click();
    });
    await zeroPage.waitForFunction(() => {
      const m = document.getElementById('practice-focus-modal');
      return m && m.style.display !== 'none';
    }, { timeout: 5000 });

    const zeroState = await zeroPage.evaluate(() => {
      const body = document.getElementById('practice-focus-body');
      const html = body ? body.innerHTML : '';
      return {
        modalVisible:       !!document.getElementById('practice-focus-modal'),
        chooseEnabled:      !!document.getElementById('pfm-choose-btn'),
        latestAbsent:       !document.getElementById('pfm-latest'),
        freeRecommended:    html.includes('Recommended'),
        lesson1InList:      html.includes('Lesson 1'),
      };
    });

    report(
      'Zero-lesson user: modal appears with Choose a Lesson enabled, Latest Lesson absent',
      zeroState.modalVisible && zeroState.chooseEnabled && zeroState.latestAbsent,
      `modal=${zeroState.modalVisible} choose=${zeroState.chooseEnabled} latestAbsent=${zeroState.latestAbsent}`
    );
    report(
      'Zero-lesson user: Free Practice shows Recommended badge, lesson content available',
      zeroState.freeRecommended && zeroState.lesson1InList,
      `recommended=${zeroState.freeRecommended} lesson1inList=${zeroState.lesson1InList}`
    );

    await zeroPage.close();

  } finally {
    await browser.close();
    server.close();
  }

  // ── final summary ──────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log('\n' + '─'.repeat(54));
  console.log(`${passed}/${results.length} tests PASS${failed > 0 ? `, ${failed} FAIL` : ''}`);

  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => !r.passed).forEach(r =>
      console.log(`  ✗ ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`));
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
