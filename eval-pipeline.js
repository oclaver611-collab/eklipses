// eval-pipeline.js — Tests /api/character-stream for beach/sofia scenario
// Checks: non-empty, under 200 chars, no banned phrases, responds in under 3s
// Run with: node eval-pipeline.js

require('dotenv').config();

const BASE = process.env.VERCEL_URL || 'https://eklipses.vercel.app';

// ─── SOFIA BANNED PHRASES ─────────────────────────────────────────────────────
const BANNED = [
  'i appreciate that',
  "that's a great question",
  "that's kind",
  "thank you, that",
  "thanks, that",
  'what caught your eye',
  "what's caught your eye",
  'oh wow',
  "that's amazing",
  "that's so interesting",
  "i'm here to help",
  "i'm an ai",
  "as an ai",
  "i'm just",
  '*',   // asterisks = stage directions leaked
];

// ─── TEST MESSAGES ────────────────────────────────────────────────────────────
const TESTS = [
  {
    msg: 'hey',
    label: 'single-word greeting',
    // Sofia should reply with just her name
  },
  {
    msg: 'what are you writing about',
    label: 'direct question about article',
    // Should mention erosion / sand / coastline / magazine
  },
  {
    msg: 'you seem really focused out here',
    label: 'observation opener',
    // Should not say "I appreciate that" or "thank you"
  },
  {
    msg: 'you are honestly beautiful',
    label: 'looks compliment',
    // Should deflect, not gush
  },
  {
    msg: 'can I get your number',
    label: 'premature number ask',
    // Should redirect — too early
  },
];

const DEV_KEY = process.env.DEV_BYPASS_KEY || '';

// ─── SSE STREAM READER ────────────────────────────────────────────────────────
async function callStream(userMessage, history = []) {
  const start = Date.now();

  let res;
  try {
    res = await fetch(`${BASE}/api/character-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(DEV_KEY ? { 'x-dev-key': DEV_KEY } : {}),
      },
      body: JSON.stringify({
        userMessage,
        scenarioKey: 'beach',
        characterId: 'sofia',
        history,
      }),
    });
  } catch (e) {
    return { error: 'fetch failed: ' + e.message, fullText: '', firstMs: null, totalMs: Date.now() - start };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `HTTP ${res.status}: ${body.slice(0, 120)}`, fullText: '', firstMs: null, totalMs: Date.now() - start };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  const sentences = [];
  let firstMs = null;
  let sseError = null;

  while (true) {
    let chunk;
    try { chunk = await reader.read(); } catch (e) { break; }
    if (chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.error) { sseError = payload.error; }
        if (payload.sentence) {
          if (firstMs === null) firstMs = Date.now() - start;
          sentences.push(payload.sentence);
        }
        if (payload.done && payload.full) fullText = payload.full;
      } catch {}
    }
  }

  // Fallback: if done.full was empty but we got sentence events, join them
  if (!fullText && sentences.length > 0) fullText = sentences.join(' ');

  return { fullText, firstMs, totalMs: Date.now() - start, sseError };
}

// ─── ASSERTIONS ───────────────────────────────────────────────────────────────
function check(label, pass, detail) {
  const icon = pass ? '  ✅' : '  ❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  return pass;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   PIPELINE EVAL — /api/character-stream (beach/sofia)   ║');
  console.log(`╚═══════════════════════════════════════════════════════════╝`);
  console.log(`  Target: ${BASE}\n`);

  let passed = 0;
  let failed = 0;
  const history = [];

  for (let i = 0; i < TESTS.length; i++) {
    const t = TESTS[i];
    console.log(`\n[${i + 1}/${TESTS.length}] "${t.msg}"  (${t.label})`);

    const { fullText, firstMs, totalMs, error, sseError } = await callStream(t.msg, history);

    // Hard fetch/HTTP error
    if (error) {
      check('Request succeeded', false, error);
      failed++;
      if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // SSE-level error (e.g. Groq rate limit)
    if (sseError) {
      check('No API error', false, sseError);
      failed++;
      if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    let testPassed = true;

    // 1. Non-empty
    const nonEmpty = fullText.trim().length > 0;
    if (!check('Response non-empty', nonEmpty, nonEmpty ? `"${fullText.slice(0, 60)}..."` : 'EMPTY')) testPassed = false;

    // 2. Under 200 chars
    const underLimit = fullText.length <= 200;
    if (!check('Under 200 chars', underLimit, `${fullText.length} chars`)) testPassed = false;

    // 3. No banned phrases
    const lower = fullText.toLowerCase();
    const bannedFound = BANNED.filter(p => lower.includes(p));
    const noBanned = bannedFound.length === 0;
    if (!check('No banned phrases', noBanned, noBanned ? 'clean' : 'FOUND: ' + bannedFound.join(', '))) testPassed = false;

    // 4. First sentence under 3s
    const fast = firstMs !== null && firstMs < 3000;
    if (!check('First sentence < 3s', fast, firstMs !== null ? `${firstMs}ms` : 'no sentence received')) testPassed = false;

    // Track for history
    if (fullText) {
      history.push({ role: 'user', content: t.msg });
      history.push({ role: 'assistant', content: fullText });
    }

    if (testPassed) passed++; else failed++;

    // Pause between requests to avoid Groq per-minute rate limits
    if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '─'.repeat(58));
  console.log(`  Pipeline eval: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  ✅ All pipeline checks passed.\n');
    process.exit(0);
  } else {
    console.log('  ❌ Some pipeline checks failed.\n');
    process.exit(1);
  }
})();
