// tests/demo-record.js
// Marketing demo: AI agent plays user, genuine conversation with Sofia, OBS recording.
//
// Usage:
//   node tests/demo-record.js
//
// Prerequisites:
//   - OBS Studio open, WebSocket server enabled on port 4455 (Tools → obs-websocket Settings)
//   - OBS scene already set up to capture the browser window
//   - FISH_AUDIO_API_KEY and GROQ_API_KEY in .env (production TTS, no stubs)
//
// What this does:
//   1. Connects to OBS WebSocket and starts recording
//   2. Opens the live Eklipses app (eklipses.vercel.app) — real Fish Audio TTS, real Groq LLM
//   3. Navigates into the Sofia/beach scenario using type-input mode
//   4. Loops: read Sofia's last response → generate AI user reply via Groq → type it in
//   5. Runs for SESSION_MS (~7 min), then stops recording
//   6. Saves full transcript to tests/output/
//
// Prior failure modes fixed:
//   - NO Kokoro stub: player.js calls /api/tts with currentCharacterId; api/tts.js maps it
//     to Fish Audio voice IDs. Nothing here bypasses that path.
//   - NO static page: we call playScenario('beach') directly so the live scenario UI shows,
//     not the lesson list.

'use strict';
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ── Config ─────────────────────────────────────────────────────────────────────
const LIVE_URL    = 'https://eklipses.com';
const GROQ_KEY    = process.env.GROQ_API_KEY;
const GROQ_MODEL  = 'groq/compound-mini';
const OBS_WS      = 'ws://localhost:4455';
const OBS_PASS    = process.env.OBS_WS_PASSWORD || '';
const SESSION_MS  = 7 * 60 * 1000;  // 7 minutes
const OUT_DIR     = path.join(__dirname, 'output');
const STAMP       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const TRANSCRIPT  = path.join(OUT_DIR, `demo-transcript-${STAMP}.txt`);

if (!GROQ_KEY) { console.error('[DEMO] GROQ_API_KEY not set in .env'); process.exit(1); }

// ── OBS WebSocket ───────────────────────────────────────────────────────────────

let obsWs = null;
let obsReqCounter = 0;
const obsCallbacks = new Map();

function obsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(OBS_WS);
    obsWs = ws;
    let ready = false;

    ws.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      // op:0 = Hello
      if (msg.op === 0) {
        const identify = { op: 1, d: { rpcVersion: 1 } };
        if (OBS_PASS && msg.d.authentication) {
          const { challenge, salt } = msg.d.authentication;
          const secret = crypto.createHash('sha256')
            .update(OBS_PASS + salt).digest('base64');
          identify.d.authentication = crypto.createHash('sha256')
            .update(secret + challenge).digest('base64');
        }
        ws.send(JSON.stringify(identify));
        return;
      }

      // op:2 = Identified
      if (msg.op === 2) {
        ready = true;
        console.log('[OBS] Connected and identified');
        resolve(ws);
        return;
      }

      // op:7 = RequestResponse
      if (msg.op === 7) {
        const cb = obsCallbacks.get(msg.d.requestId);
        if (cb) { obsCallbacks.delete(msg.d.requestId); cb(msg.d); }
        return;
      }
    };

    ws.onerror = err => { if (!ready) reject(new Error('OBS WS error: ' + err.message)); };
    ws.onclose = () => { if (!ready) reject(new Error('OBS WS closed before Identified')); };
  });
}

function obsReq(type, data = {}) {
  return new Promise((resolve, reject) => {
    const id = 'r' + (++obsReqCounter);
    const timer = setTimeout(() => {
      obsCallbacks.delete(id);
      reject(new Error('OBS request timeout: ' + type));
    }, 15000);
    obsCallbacks.set(id, d => { clearTimeout(timer); resolve(d); });
    obsWs.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
  });
}

async function obsStartRecord() {
  // Stop any recording already in progress (e.g. left over from a crashed run)
  try {
    const check = await obsReq('GetRecordStatus');
    if (check.responseData?.outputActive) {
      console.log('[OBS] Stopping previous recording...');
      await obsReq('StopRecord');
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch { /* not recording — that's fine */ }

  const d = await obsReq('StartRecord');
  if (!d.requestStatus.result) throw new Error('OBS StartRecord failed: ' + JSON.stringify(d.requestStatus));
  console.log('[OBS] Recording started');
}

async function obsStopRecord() {
  const d = await obsReq('StopRecord');
  const out = d.responseData?.outputPath || '(unknown — check OBS output folder)';
  console.log('[OBS] Recording stopped →', out);
  return out;
}

// ── AI user agent ───────────────────────────────────────────────────────────────
// Calls Groq to generate a natural, reactive reply from the "user" perspective.
// Sofia's full character prompt lives in api/character-stream.js — the AI user
// only needs to know the high-level context.

const aiUserHistory = [];  // [{role,content}] — what the AI user remembers saying

async function aiUserReply(sofiaText, turnNumber) {
  const isOpener  = turnNumber === 1;
  const isEarly   = turnNumber <= 3;
  const isMid     = turnNumber > 3 && turnNumber <= 9;
  const isLate    = turnNumber > 9;

  let phase = '';
  if (isOpener) {
    phase = `This is the OPENING LINE. You're approaching Sofia for the first time at a quiet beach. ` +
      `She's sitting writing in her notebook. You've just walked up. ` +
      `Give a brief, genuine opener — not a pickup line. Something you'd actually say.`;
  } else if (isEarly) {
    phase = `Early in the conversation — 2nd or 3rd exchange. Build on what she said. ` +
      `Still a bit uncertain but genuinely interested.`;
  } else if (isMid) {
    phase = `Mid conversation — you've had a few good exchanges. Be more confident now. ` +
      `Show real interest in her article (shoreline erosion, 20 years of data). ` +
      `Around turn 7-9, if things are going well, try a soft invite: coffee, a walk, etc.`;
  } else {
    phase = `Late conversation. You've built real rapport. ` +
      `Be direct. If you haven't already, try asking for her number or to get coffee. ` +
      `Don't drag it out — make the move.`;
  }

  const systemPrompt =
    `You are playing the role of a man (mid-20s) who has just approached a woman at the beach.
Sofia is 26, writes for an independent magazine about coastal ecology, working on an article about how a local shoreline has lost 8 metres of sand in 20 years.

${phase}

Sofia's character: guarded but genuinely curious about people. Dry wit. She makes you earn her attention. She does NOT reward generic questions — only genuine, specific ones.

STRICT RULES:
- Write exactly 1-2 SHORT sentences. Spoken dialogue only. No stage directions.
- React SPECIFICALLY to what Sofia just said. Be concrete, not vague.
- Do NOT ask two questions back to back.
- Do NOT be smooth or rehearsed — natural imperfection is fine.
- Do NOT use exclamation marks. Speak like a real person, not a chatbot.
- Do NOT start with "I" if you can help it — vary your sentence starters.
- Never say "That's interesting" or "That's fascinating" or generic filler.

Return only the spoken line. Nothing else.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    // Interleave: assistant = Sofia speaking, user = the player's reply
    ...aiUserHistory.slice(-12),
  ];

  if (!isOpener && sofiaText) {
    messages.push({ role: 'assistant', content: sofiaText });
    messages.push({ role: 'user', content: 'Your response:' });
  } else {
    messages.push({ role: 'user', content: isOpener
      ? 'Make your opening move. One or two short sentences, genuine.'
      : 'Continue the conversation. One or two short sentences.' });
  }

  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 80,
        temperature: 0.88,
      }),
    });

    if (res.status !== 429) break;

    // Rate limited — parse retry-after from error body and wait
    const errText = await res.text();
    const retryMatch = errText.match(/try again in ([\d.]+)s/);
    const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 15000;
    console.log(`[DEMO] Rate limited — waiting ${(waitMs / 1000).toFixed(1)}s before retry...`);
    await new Promise(r => setTimeout(r, waitMs));
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const reply = (data.choices[0].message.content || '').trim()
    .replace(/^["']|["']$/g, '');  // strip surrounding quotes if model adds them

  // Remember it
  if (sofiaText) aiUserHistory.push({ role: 'assistant', content: sofiaText });
  aiUserHistory.push({ role: 'user', content: reply });

  return reply;
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Step 1: Connect to OBS ──────────────────────────────────────────────────
  console.log('[DEMO] Connecting to OBS WebSocket at', OBS_WS, '...');
  console.log('[DEMO] (Make sure OBS is open with Tools → obs-websocket Settings → Enable on port 4455)');
  try {
    await obsConnect();
  } catch (err) {
    console.error('[DEMO] OBS connection failed:', err.message);
    console.error('[DEMO] Open OBS Studio, go to Tools → obs-websocket Settings, enable WebSocket server on port 4455, then re-run.');
    process.exit(1);
  }

  // ── Step 2: Launch browser (visible so OBS can capture it) ──────────────────
  console.log('[DEMO] Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--kiosk', '--no-sandbox'],  // kiosk = fullscreen, no address bar/tabs/browser chrome
  });
  const ctx  = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();

  // Capture console logs for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[PAGE ERR]', msg.text().slice(0, 120));
  });

  // ── Step 3: Navigate to app + set localStorage ──────────────────────────────
  console.log('[DEMO] Navigating to', LIVE_URL, '...');
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Set before reload so the app reads them on init
  await page.evaluate(() => {
    localStorage.setItem('ek-dev-key', 'ek_dev_2026');          // bypass paywall
    localStorage.setItem('eklipses_input_mode', 'type');         // use keyboard, not mic
    localStorage.setItem('ek-onboarding-v1', '1');               // skip onboarding overlay
    localStorage.setItem('ek-practice-banner-dismissed', '1');   // skip lesson banner
  });

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });

  // ── Step 4: Dismiss the hero-v6 intro overlay (blocks tab clicks if present) ─
  const heroPresent = await page.$('#ek-hero-v6');
  if (heroPresent) {
    console.log('[DEMO] Dismissing hero overlay...');
    await page.waitForSelector('#ek-h6-start', { timeout: 10000 });
    await page.click('#ek-h6-start');
    await page.waitForSelector('#ek-hero-v6', { state: 'detached', timeout: 20000 });
  }

  // ── Step 5: Switch to Practice tab + launch beach scenario via JS ────────────
  // We call switchTab and playScenario directly — no card click needed, and it
  // avoids a timing race waiting for card visibility after Kokoro loads.
  console.log('[DEMO] Switching to Practice tab and launching beach/Sofia scenario...');
  await page.evaluate(() => {
    // switchTab is defined inside an IIFE in lesson-player.js; expose it by
    // clicking the tab button programmatically so the registered onclick fires.
    const btn = document.getElementById('ek-tab-practice');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // ── Step 6: Preflight screenshot (confirms Practice UI, not lesson list) ────
  const preflightPng = path.join(OUT_DIR, `demo-preflight-${STAMP}.png`);
  await page.screenshot({ path: preflightPng });
  console.log('[DEMO] Preflight screenshot:', preflightPng);

  // ── Step 7: Launch Sofia/beach scenario via direct JS call ──────────────────
  // playScenario is a global in player.js. beach is a coldOpen scenario so it
  // goes straight to freeConversation — Sofia's video appears, timer starts.
  console.log('[DEMO] Calling playScenario("beach")...');
  // Do NOT await the returned promise — playScenario runs freeConversation for 7
  // minutes and would block page.evaluate for the entire session. Fire and forget.
  await page.evaluate(() => { playScenario('beach', false); });

  // Short pause for transition animation
  await new Promise(r => setTimeout(r, 2500));

  // ── Step 7: Wait for manual OBS window-capture alignment ────────────────────
  // Browser window just opened — give the user a chance to point OBS's Window
  // Capture source at it before recording starts.
  // Set DEMO_SKIP_PAUSE=1 to bypass this (useful when re-running after a crash).
  if (process.env.DEMO_SKIP_PAUSE !== '1') {
    await new Promise(resolve => {
      const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
      rl.question('\n[DEMO] Point OBS\'s Window Capture to the new browser window now, then press Enter to start recording: ', () => {
        rl.close();
        resolve();
      });
    });
  } else {
    console.log('\n[DEMO] DEMO_SKIP_PAUSE=1 — skipping OBS alignment pause, starting recording now.');
  }

  // ── Step 8: Start OBS recording ─────────────────────────────────────────────
  await obsStartRecord();

  // ── Step 9: Mid-scenario confirmation screenshot ────────────────────────────
  // (Confirms we're in the live scenario, not the static lesson list)
  await new Promise(r => setTimeout(r, 3000));
  const confirmPng = path.join(OUT_DIR, `demo-scenario-confirm-${STAMP}.png`);
  await page.screenshot({ path: confirmPng });
  console.log('[DEMO] Scenario confirmation screenshot:', confirmPng);

  // Verify the scenario UI is actually showing (not lesson list)
  const scenarioVisible = await page.evaluate(() => {
    const name = document.getElementById('speakerName');
    const frame = document.getElementById('stageFrame');
    return !!(name && frame && frame.offsetParent !== null);
  });
  if (!scenarioVisible) {
    console.error('[DEMO] ABORT: Scenario UI not visible — check screenshot for what actually loaded');
    await obsStopRecord();
    await browser.close();
    process.exit(1);
  }
  console.log('[DEMO] Scenario UI confirmed visible. Sofia should be on screen.');

  // ── Step 10: Handle style-picker modal if it appeared ──────────────────────
  // A "How do you want to play this?" modal (Curious/Playful/Direct) may appear
  // after playScenario. Click through it before waiting for the conversation UI.
  try {
    await page.waitForSelector('text=How do you want to play this?', { timeout: 8000, state: 'visible' });
    console.log('[DEMO] Style picker appeared — selecting "Playful"...');
    await page.click('text=Playful');
    await new Promise(r => setTimeout(r, 1000));
  } catch {
    // No style picker — scenario started directly, that's fine
  }

  // ── Step 11: Wait for the first type-input prompt ───────────────────────────
  console.log('[DEMO] Waiting for type-input to appear (Sofia ready for first user message)...');
  await page.waitForFunction(
    () => {
      const w = document.getElementById('type-input-wrap');
      return w && w.style.display === 'flex';
    },
    null,               // arg (unused)
    { timeout: 90000 }, // 90s: Sofia needs to generate + speak her opening line first
  );
  console.log('[DEMO] Type input is live — conversation starting!\n');

  // ── Step 11: AI-vs-AI conversation loop ─────────────────────────────────────
  const sessionStart = Date.now();
  let turn = 0;
  const transcriptLines = [
    '=== Eklipses Marketing Demo — AI vs Sofia ===',
    `Date: ${new Date().toISOString()}`,
    `URL: ${LIVE_URL}`,
    `TTS: Fish Audio (real production voices, no stubs)`,
    '',
  ];

  while (Date.now() - sessionStart < SESSION_MS) {
    turn++;
    const elapsedMin = ((Date.now() - sessionStart) / 60000).toFixed(1);

    // Read Sofia's latest response from conversationHistory
    const history = await page.evaluate(() => {
      try { return Array.isArray(conversationHistory) ? conversationHistory : []; }
      catch { return []; }
    });

    const lastSofia = [...history].reverse().find(h => h.role === 'assistant');
    const sofiaText = lastSofia?.content || '';

    if (sofiaText) {
      console.log(`[T${turn} @${elapsedMin}m] SOFIA: ${sofiaText.slice(0, 100)}${sofiaText.length > 100 ? '...' : ''}`);
      transcriptLines.push(`[T${turn}] SOFIA: ${sofiaText}`);
    }

    // Generate AI user reply
    let userReply;
    try {
      userReply = await aiUserReply(sofiaText, turn);
    } catch (err) {
      console.error('[DEMO] Groq error:', err.message);
      userReply = 'That\'s really interesting.';  // safe fallback
    }

    console.log(`[T${turn} @${elapsedMin}m] USER:  ${userReply}`);
    transcriptLines.push(`[T${turn}] USER: ${userReply}`);
    transcriptLines.push('');

    // Natural thinking pause before typing
    const thinkMs = 1200 + Math.random() * 1800;
    await new Promise(r => setTimeout(r, thinkMs));

    // Type the reply into the field and submit via Enter
    // (listenForUserType resolves on Enter AND send button click)
    await page.locator('#type-input-field').fill(userReply);
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
    await page.locator('#type-input-field').press('Enter');

    // Wait for type-input to hide (Sofia is generating + speaking)
    await page.waitForFunction(
      () => {
        const w = document.getElementById('type-input-wrap');
        return !w || w.style.display !== 'flex';
      },
      null,              // arg (unused)
      { timeout: 15000 },
    ).catch(() => {});  // ok if quick response

    // Wait for type-input to reappear (Sofia done, our turn)
    try {
      await page.waitForFunction(
        () => {
          const w = document.getElementById('type-input-wrap');
          return w && w.style.display === 'flex';
        },
        null,              // arg (unused)
        { timeout: 70000 }, // allow up to 70s for multi-sentence TTS playback
      );
    } catch {
      console.log('[DEMO] Timeout waiting for Sofia — may have hit session end or error');
      break;
    }
  }

  // ── Step 12: Cooldown — let the app finish its natural ending sequence ───────
  // The app's own 7-min timer fires "That's time" then Ryan coaching starts.
  // Give it 30s of buffer so OBS captures the session-end gracefully.
  console.log('\n[DEMO] Conversation loop done. Waiting 30s for app to finish naturally...');
  await new Promise(r => setTimeout(r, 30000));

  // ── Step 13: Stop OBS recording ─────────────────────────────────────────────
  console.log('[DEMO] Stopping OBS recording...');
  const recordingPath = await obsStopRecord();

  // ── Step 14: Save transcript ─────────────────────────────────────────────────
  transcriptLines.push('=== SESSION END ===');
  transcriptLines.push(`Duration: ${((Date.now() - sessionStart) / 60000).toFixed(1)} minutes`);
  transcriptLines.push(`Turns: ${turn}`);
  fs.writeFileSync(TRANSCRIPT, transcriptLines.join('\n'));
  console.log('[DEMO] Transcript saved:', TRANSCRIPT);

  // Final screenshot
  const finalPng = path.join(OUT_DIR, `demo-final-${STAMP}.png`);
  await page.screenshot({ path: finalPng });
  console.log('[DEMO] Final screenshot:', finalPng);

  await browser.close();
  if (obsWs) try { obsWs.close(); } catch {}

  console.log('\n════════════════════════════════════════');
  console.log('  DEMO RECORDING COMPLETE');
  console.log('════════════════════════════════════════');
  console.log('  Recording:', recordingPath);
  console.log('  Transcript:', TRANSCRIPT);
  console.log('  Preflight:', preflightPng);
  console.log('  Confirm:', confirmPng);
  console.log('\nNext steps:');
  console.log('  1. Review recording (check OBS output folder)');
  console.log('  2. Read transcript to find hook moments (lines where Sofia warms up)');
  console.log('  3. Cut clips with ffmpeg:');
  console.log('     ffmpeg -ss 00:02:30 -to 00:03:45 -i <recording> -c copy clip1.mp4');
}

main().catch(err => {
  console.error('\n[DEMO] Fatal error:', err.message);
  if (obsWs) try { obsWs.close(); } catch {}
  process.exit(1);
});
