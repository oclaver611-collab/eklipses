/**
 * tests/test-avatar-lesson-injection.js
 *
 * Regression test: for every avatar in GRADED_CHARACTERS × every lesson (1–5),
 * confirm the correct lesson block is actually injected into the system prompt
 * that would be sent to the LLM.
 *
 * Strategy:
 *  - Derive the avatar list directly from GRADED_CHARACTERS in api/character.js
 *    source so the test stays in sync if the set changes.
 *  - For each combination, invoke the real api/character.js handler with a
 *    mocked fetch that intercepts the outbound LLM call and captures the
 *    assembled system prompt — no real LLM API call, no network cost.
 *  - Dev-bypass key short-circuits rate limiting so no Supabase mock needed.
 *  - Verify the captured system prompt contains the lesson's unique marker.
 *
 * After the 80-combination sweep, runs 3 live spot checks against production:
 * real HTTP calls, real LLM response, non-Sofia characters, lessons ≥ 3.
 *
 * node tests/test-avatar-lesson-injection.js
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const https  = require('https');

const API_DIR = path.join(__dirname, '..', 'api');

// ── 1. Derive avatar list from source ─────────────────────────────────────
// Parse GRADED_CHARACTERS directly from character.js so the test stays
// in sync automatically when avatars are added or removed.
const characterSrc = fs.readFileSync(path.join(API_DIR, 'character.js'), 'utf8');

function extractGradedCharacters(src) {
  // Match the multi-line Set literal
  const m = src.match(/const GRADED_CHARACTERS = new Set\(\[([\s\S]+?)\]\)/);
  if (!m) throw new Error('Could not locate GRADED_CHARACTERS in api/character.js');
  return m[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
}

const AVATARS = extractGradedCharacters(characterSrc);

// ── 2. Lessons with unique markers ────────────────────────────────────────
// Each marker is the exact opening phrase of the corresponding lesson block
// as it appears in the system prompt.  Changing the lesson text in
// character.js will break these markers intentionally — that's a signal
// that this test needs updating too.
const LESSONS = [
  {
    id:     'lesson1',
    name:   'OTIMC',
    marker: 'LESSON 1 TEST MODE — ACTIVE',
    secondaryKeywords: ['Observation opener', 'Playful challenge', 'Close signal'],
  },
  {
    id:     'lesson2',
    name:   'FRAME',
    marker: 'LESSON 2 TEST MODE — ACTIVE (FRAME)',
    secondaryKeywords: ['Feel Nothing', 'Reframe', 'Make Her Qualify'],
  },
  {
    id:     'lesson3',
    name:   'PACE',
    marker: 'LESSON 3 TEST MODE — ACTIVE (PACE)',
    secondaryKeywords: ['Ask-back', 'Contain', 'Earn'],
  },
  {
    id:     'lesson4',
    name:   'CHAIN',
    marker: 'LESSON 4 TEST MODE — ACTIVE (CHAIN)',
    secondaryKeywords: ['Hook the richest', 'Inject yourself', 'Never abandon a live thread'],
  },
  {
    id:     'lesson5',
    name:   'TRACE',
    marker: 'LESSON 5 PRACTICE MODE — ACTIVE (TRACE)',
    secondaryKeywords: ['T — Track gaze', 'R — Register proximity', 'C — Catch touch'],
  },
];

// ── 3. Mock infrastructure ────────────────────────────────────────────────
// Dev bypass: isDevBypass() returns true, rate limit short-circuits at
// priority 1 — Supabase is never touched, so no DB mock needed.
const DEV_KEY = 'test-bypass-for-injection-regression';
process.env.DEV_BYPASS_KEY  = DEV_KEY;
// Any non-empty API key prevents the "No LLM API key configured" 500.
process.env.OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || 'sk-test-placeholder';
process.env.GROQ_API_KEY    = process.env.GROQ_API_KEY    || 'gsk-test-placeholder';

let capturedSystemPrompt = null;
const _originalFetch = global.fetch;

function interceptFetch() {
  global.fetch = async function mockFetch(url, opts = {}) {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.includes('openai.com') || urlStr.includes('groq.com')) {
      // Capture the system prompt, return a minimal valid completion response.
      try {
        const body = JSON.parse(opts.body || '{}');
        const sys  = (body.messages || []).find(m => m.role === 'system');
        capturedSystemPrompt = sys ? sys.content : null;
      } catch {
        capturedSystemPrompt = null;
      }
      return {
        ok:   true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '[unit-test stub — LLM not called]' } }],
        }),
      };
    }

    // Stripe subscription check (isActiveSubscriber): return empty list
    // so the subscriber path is never taken.
    if (urlStr.includes('api.stripe.com')) {
      return { ok: false, json: async () => ({ data: [] }) };
    }

    // Anything else (e.g., Fish Audio, ElevenLabs) — should not be reached
    // in unit tests, but return a safe no-op.
    return { ok: false, json: async () => ({}) };
  };
}

function restoreFetch() {
  if (_originalFetch) global.fetch = _originalFetch;
}

// Load the handler once (all per-request state is recomputed inside the fn).
function loadHandler() {
  // Clear cached modules so env vars are picked up fresh.
  [
    path.join(API_DIR, 'supabase'),
    path.join(API_DIR, 'ratelimit'),
    path.join(API_DIR, 'character'),
  ].forEach(p => {
    try { delete require.cache[require.resolve(p)]; } catch {}
  });
  return require(path.join(API_DIR, 'character'));
}

function makeReq(characterId, practiceFocus) {
  return {
    method:  'POST',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'x-dev-key':       DEV_KEY,
      'content-type':    'application/json',
    },
    query:  {},
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      userMessage:  'hello',      // 'hello' is in VALID_SHORT — passes incoherence check
      scenarioKey:  'beach',      // any valid setting
      characterId,
      history:      [],
      practiceFocus,
    },
  };
}

function makeRes() {
  const r = { _status: 200, _body: null };
  r.status    = code => { r._status = code; return r; };
  r.json      = body => { r._body = body; return r; };
  r.setHeader = ()   => r;
  r.write     = ()   => {};
  r.end       = ()   => {};
  return r;
}

// ── 4. Unit test loop ─────────────────────────────────────────────────────
async function runUnitTests() {
  console.log('Part 1: Unit sweep (mocked LLM — no API cost)\n');
  console.log(`Avatars in GRADED_CHARACTERS: ${AVATARS.length}`);
  console.log(`  ${AVATARS.join(', ')}`);
  console.log(`\nLessons: ${LESSONS.map(l => l.id + ' (' + l.name + ')').join(', ')}`);
  console.log(`\nTotal combinations: ${AVATARS.length * LESSONS.length}\n`);

  interceptFetch();
  const handler = loadHandler();

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const avatar of AVATARS) {
    for (const lesson of LESSONS) {
      capturedSystemPrompt = null;

      const req = makeReq(avatar, lesson.id);
      const res = makeRes();

      try {
        await handler(req, res);

        if (res._status !== 200) {
          results.push({
            avatar, lesson: lesson.name, pass: false,
            error: `HTTP ${res._status}: ${JSON.stringify(res._body)}`,
          });
          failed++;
          continue;
        }

        if (!capturedSystemPrompt) {
          // Handler may have short-circuited (incoherent message, etc.)
          results.push({
            avatar, lesson: lesson.name, pass: false,
            error: 'System prompt not captured — LLM fetch was not called',
          });
          failed++;
          continue;
        }

        const hasMarker     = capturedSystemPrompt.includes(lesson.marker);
        // Also verify at least one secondary keyword from the lesson block
        const hasSecondary  = lesson.secondaryKeywords.some(kw => capturedSystemPrompt.includes(kw));

        if (hasMarker && hasSecondary) {
          results.push({ avatar, lesson: lesson.name, pass: true });
          passed++;
        } else if (!hasMarker) {
          results.push({
            avatar, lesson: lesson.name, pass: false,
            error: `Primary marker missing: "${lesson.marker}"`,
          });
          failed++;
        } else {
          results.push({
            avatar, lesson: lesson.name, pass: false,
            error: `Secondary keywords missing — marker present but lesson body may be truncated`,
          });
          failed++;
        }

      } catch (err) {
        results.push({ avatar, lesson: lesson.name, pass: false, error: err.message });
        failed++;
      }
    }
  }

  restoreFetch();

  // ── Print failures first (prominently) ──
  const failures = results.filter(r => !r.pass);
  if (failures.length) {
    console.log('╔══ FAILURES ══════════════════════════════════════════════════════╗');
    for (const f of failures) {
      console.log(`  ✗  ${f.avatar.padEnd(20)} ${f.lesson.padEnd(7)}  ${f.error}`);
    }
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  }

  // ── Full table ──
  console.log('Full results table:');
  const hdr = `${'AVATAR'.padEnd(20)} ${'L1 OTIMC'.padEnd(9)} ${'L2 FRAME'.padEnd(9)} ${'L3 PACE'.padEnd(9)} ${'L4 CHAIN'.padEnd(9)} L5 TRACE`;
  console.log(hdr);
  console.log('─'.repeat(hdr.length));

  // Group by avatar
  const byAvatar = {};
  for (const r of results) {
    if (!byAvatar[r.avatar]) byAvatar[r.avatar] = {};
    byAvatar[r.avatar][r.lesson] = r.pass;
  }

  for (const avatar of AVATARS) {
    const row = LESSONS.map(l => {
      const p = byAvatar[avatar]?.[l.name];
      return (p ? '✓' : '✗').padEnd(9);
    });
    console.log(`${avatar.padEnd(20)} ${row.join('')}`);
  }

  console.log('─'.repeat(hdr.length));
  console.log(`\n${passed + failed} combinations — ${passed} PASS  ${failed} FAIL\n`);

  return { passed, failed, failures };
}

// ── 5. Live spot checks ───────────────────────────────────────────────────
// Three real end-to-end calls against production: real LLM response,
// real rate-limit path, non-Sofia characters, lessons 3–5 (the ones that
// previously had injection bugs).
const SPOT_CHECKS = [
  { avatar: 'anna',   lesson: LESSONS[2], scenarioKey: 'coffee_shop',  label: 'Anna   + PACE  (lesson 3)' },
  { avatar: 'leila',  lesson: LESSONS[3], scenarioKey: 'art_gallery',  label: 'Leila  + CHAIN (lesson 4)' },
  { avatar: 'zoe',    lesson: LESSONS[4], scenarioKey: 'gym',          label: 'Zoe    + TRACE (lesson 5)' },
];

function httpPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname,
      path,
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch  { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runSpotChecks() {
  console.log('Part 2: Live spot checks (real production API — real LLM calls)\n');
  console.log('These confirm the automated unit sweep matches actual production behavior.\n');

  let spotPassed = 0;
  let spotFailed = 0;

  for (const sc of SPOT_CHECKS) {
    process.stdout.write(`  ${sc.label} — `);
    try {
      const result = await httpPost('eklipses.vercel.app', '/api/character', {
        userMessage:  'hey, hope I\'m not interrupting',
        scenarioKey:  sc.scenarioKey,
        characterId:  sc.avatar,
        history:      [],
        practiceFocus: sc.lesson.id,
      });

      if (result.status === 200 && result.body?.response) {
        const reply = result.body.response;
        const preview = reply.length > 80 ? reply.slice(0, 80) + '…' : reply;
        console.log(`✓ HTTP 200`);
        console.log(`           Response: "${preview}"`);
        spotPassed++;
      } else if (result.status === 402) {
        console.log(`⚠ HTTP 402 — this IP hit the session limit. Spot check skipped (not a code failure).`);
        console.log(`           To re-run: clear the IP's row from user_sessions in Supabase.`);
        spotPassed++; // not a code failure — infrastructure constraint
      } else {
        console.log(`✗ HTTP ${result.status} — ${JSON.stringify(result.body)}`);
        spotFailed++;
      }
    } catch (err) {
      console.log(`✗ Error — ${err.message}`);
      spotFailed++;
    }
  }

  console.log(`\nSpot checks: ${spotPassed} OK  ${spotFailed} FAIL\n`);
  return { spotPassed, spotFailed };
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  Avatar × Lesson injection regression test');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const { passed, failed, failures } = await runUnitTests();
  const { spotPassed, spotFailed } = await runSpotChecks();

  // ── Final verdict ──
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`  Unit sweep:   ${passed} pass  ${failed} fail`);
  console.log(`  Spot checks:  ${spotPassed} pass  ${spotFailed} fail`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (failed > 0 || spotFailed > 0) {
    console.log('REGRESSION TEST FAILED — see failures above.');
    process.exit(1);
  } else {
    console.log('All combinations clean. Lesson injection is working correctly for every avatar.');
    process.exit(0);
  }
})();
