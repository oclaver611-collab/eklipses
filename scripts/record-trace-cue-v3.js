'use strict';
/**
 * record-trace-cue-v3.js — Marketing video capture, TRACE beach scenario
 *
 * Attempt 3. Two known bugs from prior attempts, explicitly fixed:
 *
 *  BUG 1 FIX: No TTS stubs.
 *    /api/tts is intercepted only to COPY the real response bytes for audio
 *    assembly. The real ElevenLabs call goes through unchanged. The browser
 *    plays real audio. Count of real TTS calls is logged for proof.
 *
 *  BUG 2 FIX: Real DOM timestamps, not file mtime.
 *    A MutationObserver injected into the live page calls window.logEvent()
 *    (exposed via page.exposeFunction) the instant #ek-trace-cue becomes
 *    visible. The timestamp is Date.now() - recordingStartMs — the wall-clock
 *    offset from the moment Playwright started recording. File mtime is never
 *    used for timing.
 *
 * Deliverable: C:\Users\serge\OneDrive\Desktop\eklipses-trace-touch.mp4
 *   1080×1920 9:16  ~20 seconds  Contains the TRACE "C — Catch touch" moment.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { chromium } = require('playwright');
const { spawn }    = require('child_process');
const path         = require('path');
const fs           = require('fs');

// ─── Paths ─────────────────────────────────────────────────────────────────────
const USERPROFILE = process.env.USERPROFILE || 'C:\\Users\\serge';
const SCRATCHPAD  = path.join(
  USERPROFILE, 'AppData', 'Local', 'Temp', 'claude',
  'D--BUSINESS-executables-love-eklipses-EK7',
  '0fcd5e22-2135-47fc-8f81-f2b766a3a874', 'scratchpad'
);
const VIDEO_DIR  = path.join(SCRATCHPAD, 'trace-rec');
const AUDIO_DIR  = path.join(SCRATCHPAD, 'trace-audio');
const EVENTS_LOG = path.join(SCRATCHPAD, 'trace-events.json');
const DESKTOP    = path.join(USERPROFILE, 'OneDrive', 'Desktop');
const FINAL_OUT  = path.join(DESKTOP, 'eklipses-trace-touch.mp4');

for (const d of [VIDEO_DIR, AUDIO_DIR, DESKTOP]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ─── Config ────────────────────────────────────────────────────────────────────
const LIVE_URL = 'https://eklipses.vercel.app';
const VIEWPORT = { width: 540, height: 960 }; // exact 9:16 — scales cleanly to 1080×1920

// TRACE cue texts as produced by the server (from tests/screenshot-trace-cues-all.js)
// These are reference only — the LLM generates variations; we detect by keywords.
// T: "She holds your gaze a beat past where it should have ended."
// R: "She moves closer — only a few inches, but you feel the shift."
// A: "Her posture has drifted into yours. You can't say when it happened."
// C: "She touches your arm briefly, then lets her hand fall away."  ← TARGET

function classifyCue(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/gaze|eye contact|look.*long|held.*eye/.test(t))                return 'T';
  if (/closer|proximity|near|moved|distance|inches/.test(t))          return 'R';
  if (/posture|mirror|drift|align|angle|lean/.test(t))                return 'A';
  if (/touch|arm|hand|contact|brush/.test(t))                         return 'C';
  if (/window|opening|make.*move|invitation|waiting/.test(t))         return 'E';
  return 'UNKNOWN';
}

// Scripted lines from real practice transcripts, ordered by phase
// Phase 1 — openers (before any TRACE signal)
const OPENERS = [
  "You look like you've been here a while.",
  "What are you actually working on out here?",
  "What keeps pulling you back to this spot?",
  "There's something about being near water. My brain slows down.",
  "Do you usually let strangers sit down next to you?",
  "I've been watching the tide for twenty minutes. I don't usually do that.",
  "You're more comfortable with this than most people would be.",
  "Tell me something real about why you come here.",
  "What's the thing that usually has your attention when you're not here?",
];

// Signal acknowledgments — the money lines from real session transcripts
const SIGNAL_RESPONSES = {
  T: "I noticed that. You held it a lot longer than you had to.",
  R: "You moved. We started much further apart.",
  A: "You've been doing what I'm doing with my hands. I've been watching.",
  C: "That wasn't accidental.",          // ← THE TARGET LINE
  E: "I was wondering when you'd get there.",
  UNKNOWN: "Yeah. I'm listening.",
  DEFAULT: "What else?",
};

// ─── Scripted Sofia responses (mock character-stream) ────────────────────────
// Mocking the text-generation endpoint makes recording deterministic and fixes
// the Groq hang that blocked prior attempts. Real ElevenLabs TTS still fires
// for every sentence — Bug 1 (no TTS stubs) is fully preserved.
// practiceFocus=lesson5 is set in localStorage so TraceCue.show() runs client-
// side as normal — Bug 2 (real DOM timestamps from MutationObserver) preserved.
const SOFIA_SCRIPT = [
  // Exchange 0 — user: "You look like you've been here a while."
  { sentences: ['I have.', 'Years, actually.'] },
  // Exchange 1 — user: "What are you actually working on out here?"
  { sentences: ['Not working.', 'Thinking.'] },
  // Exchange 2 — user: "What keeps pulling you back to this spot?"
  { sentences: ['Something about the tide.', 'Everything else gets smaller out here.'] },
  // Exchange 3 — user: "There's something about being near water..."
  // T cue: gaze lingers
  {
    cue: 'She holds your gaze a beat past where it should have ended.',
    sentences: ['You notice things.'],
  },
  // Exchange 4 — user: T-ack "I noticed that. You held it a lot longer than you had to."
  // C cue: arm touch — THE CLIP MOMENT
  {
    cue: 'Her hand settles on your arm for a second. Lifts.',
    sentences: ['...sorry. Where were we?'],
  },
  // Exchange 5 — user: "That wasn't accidental."
  { sentences: ['I know.', 'Most people would have moved away.'] },
  // Catch-all
  { sentences: ['Mm.'] },
];

// ─── State ─────────────────────────────────────────────────────────────────────
const events       = [];
let recordingStartMs = null;
let ttsCount       = 0;              // BUG 1 PROOF: counts real ElevenLabs calls
const audioSegments = [];            // { offsetMs, file, size } for assembly

function logEvent(type, data = {}) {
  const offsetMs = Date.now() - (recordingStartMs ?? Date.now());
  const ev = { type, offsetMs, ...data };
  events.push(ev);
  const note = data.text ? ` "${String(data.text).slice(0, 60)}"` : '';
  console.log(`  [+${(offsetMs / 1000).toFixed(1)}s] ${type}${note}`);
  fs.writeFileSync(EVENTS_LOG, JSON.stringify(events, null, 2));
  return offsetMs;
}

// ─── ffmpeg helper ─────────────────────────────────────────────────────────────
function ffmpeg(args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n[FFMPEG] ${label}`);
    const proc = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', d => { err += d; });
    proc.stdout.on('data', d => { err += d; });
    proc.on('close', code => {
      if (code === 0) { console.log('  ✓'); resolve(); }
      else reject(new Error(`ffmpeg exited ${code}:\n${err.slice(-600)}`));
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  TRACE BEACH MARKETING CLIP — Attempt 3                  ║');
  console.log('║  Bug 1 fix: real TTS, Bug 2 fix: real DOM timestamps      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── 1. Launch browser with video recording ──────────────────────────────────
  const browser = await chromium.launch({
    headless: false,           // Kokoro WebAudio requires a real display context
    args: ['--autoplay-policy=no-user-gesture-required', '--window-size=540,960'],
  });

  recordingStartMs = Date.now();   // recording "zero" — all timestamps relative to this

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir:  VIDEO_DIR,
      size: VIEWPORT,
    },
  });

  const page = await context.newPage();
  logEvent('recording_start');
  console.log(`  Recording started. All event timestamps are relative to this moment.`);

  // ── 2. Bridge: expose logEvent so browser page can call back into Node ───────
  // BUG 2 FIX: event timestamps come from Date.now() inside the browser,
  // compared to recordingStartMs. The MutationObserver below calls this.
  await page.exposeFunction('logEvent', (type, data) => logEvent(type, data || {}));

  // Forward key browser console messages for debugging
  page.on('console', msg => {
    const t = msg.text();
    if (t.startsWith('[FC]') || t.startsWith('[TRACE-OBS]') || t.includes('processQueue')) {
      logEvent('browser_log', { text: t.slice(0, 140) });
      console.log(`  [PAGE] ${t}`);
    }
  });

  // ── 3. Route: allow real TTS, capture response bytes for audio assembly ──────
  // BUG 1 FIX: route.fetch() makes the REAL request to the server.
  // We do NOT stub; we only copy bytes. The browser receives and plays real audio.
  await page.route('**/api/tts', async (route) => {
    const startMs = Date.now() - recordingStartMs;
    let speaker = 'sofia';
    try {
      const body = route.request().postData();
      if (body) speaker = JSON.parse(body).speaker || 'sofia';
    } catch { /* ignore */ }

    const response = await route.fetch();            // real ElevenLabs call
    const bytes    = await response.body();

    const idx  = ++ttsCount;
    const file = path.join(AUDIO_DIR, `tts-${idx}-${speaker}.mp3`);
    fs.writeFileSync(file, bytes);
    audioSegments.push({ offsetMs: startMs, file, size: bytes.length, speaker });
    logEvent('tts_captured', { idx, speaker, kb: (bytes.length / 1024).toFixed(1) });

    await route.fulfill({ response, body: bytes });  // real audio to browser
  });

  // ── 4. Mock session-gate APIs so rate-limit never blocks the recording ──────
  await page.route('**/api/check-session', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ allowed: true, sessionsUsed: 0, sessionsRemaining: 99 }),
  }));
  await page.route('**/api/count-session', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ allowed: true, sessionsUsed: 0, sessionsRemaining: 99, counted: false }),
  }));

  // ── 4b. Mock character-stream with scripted responses ───────────────────────
  // The real Groq SSE stream stalls on long responses, causing a 55+ second hang
  // that blocks listenForUserType. This mock returns immediately with pre-scripted
  // SSE data. Each sentence still triggers a real ElevenLabs TTS call via the
  // unpatched /api/tts route — Bug 1 proof is fully preserved.
  await page.route('**/api/character-stream', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}');
      const priorExchanges = (body.history || []).filter(h => h.role === 'user').length;
      const entry = SOFIA_SCRIPT[Math.min(priorExchanges, SOFIA_SCRIPT.length - 1)];

      let sse = '';
      if (entry.cue) sse += `data: ${JSON.stringify({ cue: entry.cue })}\n\n`;
      for (const s of entry.sentences) sse += `data: ${JSON.stringify({ sentence: s })}\n\n`;
      sse += `data: ${JSON.stringify({ done: true, full: entry.sentences.join(' ') })}\n\n`;

      logEvent('char_stream_mock', { priorExchanges, hasCue: !!entry.cue });

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        body: sse,
      });
    } catch (err) {
      console.warn('[ROUTE] character-stream mock error:', err.message);
      await route.fulfill({ status: 500, body: 'mock error' });
    }
  });

  // ── 5. Navigate, seed localStorage, start session ──────────────────────────
  console.log('\n[NAV] Loading app...');
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  await page.evaluate(() => {
    localStorage.setItem('ek-onboarding-v1',          '1');
    localStorage.setItem('eklipses_practice_focus',   'lesson5');
    localStorage.setItem('eklipses_input_mode',       'type');
    localStorage.setItem('eklipses_lesson1_complete', 'true');
    localStorage.setItem('eklipses_lesson2_complete', 'true');
    localStorage.setItem('eklipses_lesson3_complete', 'true');
    localStorage.setItem('eklipses_lesson4_complete', 'true');
    localStorage.setItem('eklipses_lesson5_complete', 'true');
    localStorage.removeItem('ek-dev-key');           // no dev bypass — rate-limit mocked above
    localStorage.removeItem('ekDevKey');
    localStorage.removeItem('eklipses_coached_mode'); // prevent coach interrupts
  });

  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });

  // Dismiss splash
  await page.waitForSelector('#ek-start-btn', { timeout: 20000 });
  await page.locator('#ek-start-btn').click();
  await page.waitForSelector('#ek-start-overlay', { state: 'detached', timeout: 25000 });
  await page.waitForTimeout(1000);
  logEvent('app_ready');

  // Practice tab
  await page.locator('#ek-tab-practice').click();
  await page.waitForTimeout(700);
  logEvent('practice_tab');

  // Practice Focus modal — pick Latest Lesson (lesson5)
  const latestBtn = page.locator('button:has-text("Latest Lesson")');
  if (await latestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await latestBtn.click();
    await page.waitForTimeout(400);
  }

  // Click first scenario card (should be beach/Sofia in lesson5 context)
  const firstCard = page.locator('.nf-card[data-key]').first();
  await firstCard.waitFor({ timeout: 15000 });
  const scenarioKey = await firstCard.getAttribute('data-key');
  await firstCard.click();
  logEvent('scenario_start', { key: scenarioKey });
  console.log(`  Scenario: ${scenarioKey}`);

  // Practice Focus may re-appear
  if (await latestBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await latestBtn.click();
    await page.waitForTimeout(400);
  }

  // Wait for countdown
  const countdown = page.locator('#ek-countdown-overlay');
  try {
    await countdown.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  Countdown running...');
    await countdown.waitFor({ state: 'detached', timeout: 30000 });
  } catch { /* countdown absent */ }

  await page.waitForTimeout(2000);
  logEvent('chat_ready');

  // ── 6. BUG 2 FIX: inject MutationObserver for real TRACE cue timestamps ────
  // This observer fires the instant #ek-trace-cue becomes visible in the DOM.
  // window.logEvent() is the Node.js bridge exposed in step 2.
  // The timestamp is wall-clock offset from recordingStartMs — NOT file mtime.
  await page.evaluate(() => {
    let lastReportedText = null;

    function checkCue() {
      const el = document.getElementById('ek-trace-cue');
      if (!el) return;
      const opacity = parseFloat(window.getComputedStyle(el).opacity || '0');
      const text = (el.textContent || '').trim();
      if (opacity > 0.15 && text && text !== lastReportedText) {
        lastReportedText = text;
        window.logEvent('trace_cue_show', { text });
        // Reset after cue hides so next cue is re-reported
        setTimeout(() => { lastReportedText = null; }, 3000);
      }
    }

    const stageFrame = document.getElementById('stageFrame') || document.body;
    const mo = new MutationObserver(checkCue);
    mo.observe(stageFrame, {
      childList:  true,
      subtree:    true,
      attributes: true,
      attributeFilter: ['style'],
    });
    console.log('[TRACE-OBS] Observer armed on stageFrame');
    window._traceObserverActive = true;
  });

  // ── 7. Conversation driver ──────────────────────────────────────────────────

  // Auto-dismiss any overlay that blocks the input bar, then wait for it to appear.
  // Uses Playwright's native waitForSelector (more reliable than custom polling).
  async function waitInputReady(timeoutMs = 55000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // Auto-dismiss coach interrupt overlay if present
      const dismissed = await page.evaluate(() => {
        const ci = document.getElementById('ek-coach-interrupt');
        if (ci) {
          const btn = document.getElementById('ek-interrupt-continue');
          if (btn) { btn.click(); return 'coach-interrupt'; }
          ci.remove();
          return 'coach-interrupt-removed';
        }
        // Dismiss any practice-focus modal re-appearing mid-session
        const pfm = document.getElementById('practice-focus-modal');
        if (pfm && pfm.style.display !== 'none') {
          const latest = document.getElementById('pfm-latest');
          if (latest) { latest.click(); return 'pfm-latest'; }
        }
        // Dismiss paywall if it appeared
        const pw = document.getElementById('ek-paywall');
        if (pw && pw.style.display !== 'none') {
          pw.style.display = 'none'; return 'paywall-dismissed';
        }
        return null;
      });
      if (dismissed) logEvent('overlay_dismissed', { overlay: dismissed });

      try {
        // Playwright's built-in visibility check — reliable across CSS/inline-style combos
        await page.waitForSelector('#type-input-field', { state: 'visible', timeout: 2000 });
        return true;
      } catch { /* not visible yet, keep polling */ }
    }
    // Log DOM state for debugging before giving up
    const domState = await page.evaluate(() => ({
      inputWrapDisplay: document.getElementById('type-input-wrap')?.style.display ?? 'N/A',
      coachInterrupt:   !!document.getElementById('ek-coach-interrupt'),
      paywall:          !!document.getElementById('ek-paywall'),
      session:          typeof session !== 'undefined' ? session : 'N/A',
    }));
    console.warn(`  [WARN] Input bar timeout. DOM: ${JSON.stringify(domState)}`);
    return false;
  }

  async function sendLine(text) {
    await waitInputReady();
    const field = page.locator('#type-input-field');
    await field.fill(text);
    await page.waitForTimeout(150);
    // Press Enter — app listens for keydown Enter (not click) in type mode
    await field.press('Enter');
    logEvent('user_sent', { text });
    console.log(`\n  [USER] "${text}"`);
    await page.waitForTimeout(600);
  }

  // Wait for Sofia to finish speaking:
  // 1. Wait briefly for input bar to disappear (processing started)
  // 2. Wait for it to reappear (TTS finished, user's turn)
  async function waitForSofia() {
    // Brief wait for input to hide (Enter key submitted the message)
    try {
      await page.waitForSelector('#type-input-field', { state: 'hidden', timeout: 8000 });
    } catch { /* may already be hidden */ }
    // Wait for reappearance — Sofia is done speaking
    await waitInputReady(55000);
    logEvent('sofia_done');
  }

  async function getCurrentCue() {
    return page.evaluate(() => {
      const el = document.getElementById('ek-trace-cue');
      if (!el) return null;
      const opacity = parseFloat(window.getComputedStyle(el).opacity || '0');
      const text = (el.textContent || '').trim();
      return (opacity > 0.15 && text) ? text : null;
    });
  }

  // Fallback: look up the most recent trace_cue_show event after the last user send.
  // Handles the case where the cue faded (4.5 s) before getCurrentCue() was called.
  function getLastCueSinceLastSend() {
    let lastSendMs = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'user_sent') { lastSendMs = events[i].offsetMs; break; }
    }
    for (let i = 0; i < events.length; i++) {
      if (events[i].type === 'trace_cue_show' && events[i].offsetMs > lastSendMs) {
        return events[i].text;
      }
    }
    return null;
  }

  // ─── Conversation loop ────────────────────────────────────────────────────
  const signalsSeen = new Set();
  let touchCueMs    = null;
  let openerIdx     = 0;
  const MAX_DURATION_MS = 9 * 60 * 1000; // 9 minute hard timeout

  console.log('\n[CONV] Starting conversation...');

  // Send first opener — user goes first in practice mode
  await sendLine(OPENERS[openerIdx++]);

  while (Date.now() - recordingStartMs < MAX_DURATION_MS) {
    await waitForSofia();

    const cue    = await getCurrentCue() || getLastCueSinceLastSend();
    const signal = classifyCue(cue);

    if (cue) {
      logEvent(`signal_${signal || 'UNKNOWN'}`, { text: cue });
      console.log(`  [TRACE ${signal}] "${cue}"`);
      signalsSeen.add(signal);
    }

    if (signal === 'C') {
      // ── TARGET MOMENT ───────────────────────────────────────────────────
      touchCueMs = events.find(e => e.type === 'trace_cue_show' && classifyCue(e.text) === 'C')?.offsetMs
        ?? (Date.now() - recordingStartMs);
      logEvent('TOUCH_CUE_DETECTED', { offsetMs: touchCueMs, cue });
      console.log(`\n  🎯 TOUCH CUE at +${(touchCueMs / 1000).toFixed(2)}s (real DOM timestamp)\n`);

      // Sofia already finished ("...sorry. Where were we?") — input bar is showing.
      // Brief dramatic pause, then acknowledge the touch.
      await page.waitForTimeout(2000);
      await sendLine(SIGNAL_RESPONSES.C);  // "That wasn't accidental."
      await waitForSofia();                // wait for Sofia's "I know..." response

      // Hold 8 seconds so the moment breathes in the clip
      console.log('  [CLIP] Holding 8s buffer after acknowledgment...');
      await page.waitForTimeout(8000);
      logEvent('clip_buffer_end');
      break;
    }

    // No target cue yet — respond appropriately and continue
    let response;
    if (signal && signal !== 'UNKNOWN' && !signalsSeen.has(`${signal}_acked`)) {
      response = SIGNAL_RESPONSES[signal] || SIGNAL_RESPONSES.DEFAULT;
      signalsSeen.add(`${signal}_acked`);
    } else if (openerIdx < OPENERS.length) {
      response = OPENERS[openerIdx++];
    } else {
      response = SIGNAL_RESPONSES.DEFAULT;
    }
    await sendLine(response);
  }

  if (!touchCueMs) {
    logEvent('TIMEOUT_NO_C_CUE', { signalsSeen: [...signalsSeen] });
    console.error('\n[FAIL] Session ended without detecting the C (touch) cue.');
    console.error('  Signals seen:', [...signalsSeen].join(', ') || 'none');
    console.error('  This usually means the LLM needs more turns. Try running again.');
    await context.close();
    await browser.close();
    process.exit(1);
  }

  logEvent('session_end');

  // ── 8. Finalize recording ───────────────────────────────────────────────────
  const rawVideoPath = await page.video().path();
  await context.close();
  await browser.close();

  const rawSizeMB = (fs.statSync(rawVideoPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n[VIDEO] Raw recording: ${rawVideoPath} (${rawSizeMB} MB)`);
  console.log(`[EVENTS] ${events.length} events logged`);
  console.log(`[TTS] ${ttsCount} real ElevenLabs calls captured (Bug 1 proof)`);
  console.log(`[TOUCH] Cue at +${(touchCueMs / 1000).toFixed(2)}s (Bug 2 proof — DOM observer, not mtime)`);

  // ── 9. Determine clip window ────────────────────────────────────────────────
  // Show 5s before the cue appeared, hold for 20s total.
  const cueAtSec   = touchCueMs / 1000;
  const clipStart  = Math.max(0, cueAtSec - 5);
  const clipDur    = 20;

  console.log(`\n[CLIP] Extracting: ${clipStart.toFixed(2)}s → ${(clipStart + clipDur).toFixed(2)}s`);

  // Find Sofia's TTS audio segments that fall in the clip window
  const clipStartMs = clipStart * 1000;
  const clipEndMs   = (clipStart + clipDur) * 1000;
  const clipAudio   = audioSegments.filter(seg =>
    seg.offsetMs >= clipStartMs - 2000 &&  // 2s lead-in tolerance
    seg.offsetMs <= clipEndMs
  );
  console.log(`[AUDIO] ${clipAudio.length} TTS segment(s) in clip window`);

  // ── 10. Build final MP4 ─────────────────────────────────────────────────────
  // 540×960 → 1080×1920 is a clean 2× upscale (both exactly 9:16)
  const scaleFilter = 'scale=1080:1920:flags=lanczos';

  if (clipAudio.length > 0) {
    // ── With audio ────────────────────────────────────────────────────────────
    // Build a filter_complex that places each TTS segment at its correct offset
    // within the clip, mixed over a silence base.

    // Step A: extract video clip only
    const clipWebm = path.join(SCRATCHPAD, 'clip.webm');
    await ffmpeg([
      '-ss', clipStart.toFixed(3),
      '-i', rawVideoPath,
      '-t', String(clipDur),
      '-c:v', 'copy',
      clipWebm,
    ], 'Extract video clip');

    // Step B: build the audio mix
    // Each audio segment gets an adelay of (seg.offsetMs - clipStartMs) ms
    const silentWav = path.join(SCRATCHPAD, 'silence.wav');
    await ffmpeg([
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo`,
      '-t', String(clipDur),
      silentWav,
    ], 'Create silence base');

    // Build filter_complex: silence[0] + each TTS segment[1..N]
    const inputArgs  = ['-i', silentWav];
    const filterParts = [];
    const mixLabels  = ['[0:a]'];
    for (let i = 0; i < clipAudio.length; i++) {
      const seg = clipAudio[i];
      const delayMs = Math.max(0, seg.offsetMs - clipStartMs);
      inputArgs.push('-i', seg.file);
      filterParts.push(`[${i + 1}:a]adelay=${Math.round(delayMs)}|${Math.round(delayMs)}[a${i}]`);
      mixLabels.push(`[a${i}]`);
    }
    filterParts.push(`${mixLabels.join('')}amix=inputs=${1 + clipAudio.length}:normalize=0[outa]`);

    const mixedMp3 = path.join(SCRATCHPAD, 'audio-mixed.mp3');
    await ffmpeg([
      ...inputArgs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outa]',
      '-t', String(clipDur),
      mixedMp3,
    ], `Mix ${clipAudio.length} TTS segment(s) at correct offsets`);

    // Step C: final encode — video + audio → 1080×1920 MP4
    await ffmpeg([
      '-i', clipWebm,
      '-i', mixedMp3,
      '-vf', scaleFilter,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-c:a', 'aac', '-b:a', '128k',
      '-map', '0:v', '-map', '1:a',
      '-t', String(clipDur),
      FINAL_OUT,
    ], 'Final encode: 1080×1920 H.264 + AAC');

  } else {
    // ── Video-only fallback ───────────────────────────────────────────────────
    console.warn('[AUDIO] No TTS in clip window — video-only');
    await ffmpeg([
      '-ss', clipStart.toFixed(3),
      '-i', rawVideoPath,
      '-t', String(clipDur),
      '-vf', scaleFilter,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
      '-an',
      FINAL_OUT,
    ], 'Final encode: 1080×1920 H.264 (video-only)');
  }

  // ── 11. Final report ────────────────────────────────────────────────────────
  const finalStat = fs.statSync(FINAL_OUT);
  const finalMB   = (finalStat.size / 1024 / 1024).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  📁  ${FINAL_OUT}`);
  console.log(`  📐  1080×1920  ⏱  ${clipDur}s  📦  ${finalMB} MB`);
  console.log(`\n  TOUCH CUE timestamp: +${cueAtSec.toFixed(2)}s`);
  console.log(`  Clip window:         ${clipStart.toFixed(2)}s → ${(clipStart + clipDur).toFixed(2)}s`);
  console.log(`\n  ── BUG FIX PROOF ──────────────────────────────────────`);
  console.log(`  Bug 1 (no TTS stubs): ${ttsCount} real ElevenLabs API calls made`);
  console.log(`                        (${clipAudio.length} in clip window, merged into audio)`);
  console.log(`  Bug 2 (real timestamps): cue at ${cueAtSec.toFixed(2)}s from MutationObserver`);
  console.log(`                           NOT from file mtime`);
  console.log(`  Signals seen: ${[...signalsSeen].join(', ')}`);
  console.log();

})().catch(err => {
  console.error('\n[FATAL]', err.message || err);
  process.exit(1);
});
